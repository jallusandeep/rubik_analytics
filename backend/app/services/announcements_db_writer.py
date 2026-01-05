"""
Database Writer Service for Corporate Announcements
Single-threaded writer that reads from queue and writes to DuckDB
"""
import logging
import duckdb
import os
from typing import Dict, Any, Optional
from queue import Queue, Empty
from threading import Thread, Event
from datetime import datetime, timezone
from app.core.config import settings

logger = logging.getLogger(__name__)


class AnnouncementsDBWriter:
    """
    Database writer for Corporate Announcements
    
    Responsibilities:
    - Read from FIFO queue
    - Write to DuckDB in transactions
    - Enforce uniqueness on announcement_id
    - Ignore duplicates silently
    - Single writer thread (no concurrent writes)
    """
    
    def __init__(self, message_queue: Queue):
        """
        Initialize database writer
        
        Args:
            message_queue: FIFO queue with parsed announcement messages
        """
        self.message_queue = message_queue
        self.running = False
        self.stop_event = Event()
        self.writer_thread: Optional[Thread] = None
        self.db_path = self._get_db_path()
        self._init_database()
    
    def _get_db_path(self) -> str:
        """Get path to announcements DuckDB database"""
        data_dir = os.path.abspath(settings.DATA_DIR)
        db_dir = os.path.join(data_dir, "Company Fundamentals")
        os.makedirs(db_dir, exist_ok=True)
        db_path = os.path.join(db_dir, "corporate_announcements.duckdb")
        return db_path
    
    def _init_database(self):
        """Initialize database schema"""
        try:
            conn = duckdb.connect(self.db_path)
            
            # Create table with required schema
            conn.execute("""
                CREATE TABLE IF NOT EXISTS corporate_announcements (
                    announcement_id VARCHAR PRIMARY KEY,
                    symbol VARCHAR,
                    exchange VARCHAR,
                    headline VARCHAR,
                    description TEXT,
                    category VARCHAR,
                    announcement_datetime TIMESTAMP,
                    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    attachment_id VARCHAR,
                    symbol_nse VARCHAR,
                    symbol_bse VARCHAR,
                    raw_payload TEXT
                )
            """)
            
            # Create indexes for efficient queries
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_announcements_datetime 
                ON corporate_announcements(announcement_datetime DESC)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_announcements_received_at 
                ON corporate_announcements(received_at DESC)
            """)
            
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_announcements_symbol 
                ON corporate_announcements(symbol)
            """)
            
            conn.commit()
            conn.close()
            logger.info(f"Initialized announcements database at {self.db_path}")
            
        except Exception as e:
            logger.error(f"Error initializing announcements database: {e}", exc_info=True)
            raise
    
    def start(self):
        """Start the database writer in background thread"""
        if self.running:
            logger.warning("Database writer already running")
            return
        
        self.running = True
        self.stop_event.clear()
        self.writer_thread = Thread(target=self._run_writer, daemon=True)
        self.writer_thread.start()
        logger.info("Started announcements database writer")
    
    def stop(self):
        """Stop the database writer"""
        if not self.running:
            return
        
        logger.info("Stopping announcements database writer")
        self.running = False
        self.stop_event.set()
        
        if self.writer_thread:
            self.writer_thread.join(timeout=5)
        
        logger.info("Announcements database writer stopped")
    
    def _run_writer(self):
        """Main writer loop"""
        batch = []
        batch_size = 10
        batch_timeout = 1.0  # seconds
        
        while self.running and not self.stop_event.is_set():
            try:
                # Try to get message from queue (with timeout)
                try:
                    message = self.message_queue.get(timeout=batch_timeout)
                    batch.append(message)
                except Empty:
                    # Timeout - process batch if any messages
                    if batch:
                        self._write_batch(batch)
                        batch = []
                    continue
                
                # If batch is full, write immediately
                if len(batch) >= batch_size:
                    self._write_batch(batch)
                    batch = []
                
            except Exception as e:
                logger.error(f"Error in writer loop: {e}", exc_info=True)
                # Clear batch on error to avoid retrying bad data
                batch = []
        
        # Write remaining batch on shutdown
        if batch:
            self._write_batch(batch)
    
    def _write_batch(self, batch: list):
        """Write batch of announcements to database"""
        if not batch:
            return
        
        conn = None
        try:
            conn = duckdb.connect(self.db_path)
            
            inserted = 0
            duplicates = 0
            errors = 0
            
            for message in batch:
                try:
                    # VALIDATION: Skip messages with no announcement_id
                    announcement_id = message.get("announcement_id")
                    if not announcement_id:
                        errors += 1
                        logger.debug("Skipping message with no announcement_id")
                        continue
                    
                    # VALIDATION: Skip blank announcements (no headline and no description)
                    headline = message.get("headline")
                    description = message.get("description")
                    if not headline and not description:
                        errors += 1
                        logger.debug(f"Skipping blank announcement: {announcement_id}")
                        continue
                    
                    # Skip if headline is just "-" or empty
                    if headline and headline.strip() in ["-", "", "null", "None"]:
                        errors += 1
                        logger.debug(f"Skipping announcement with invalid headline: {announcement_id}")
                        continue
                    
                    # Parse announcement_datetime
                    announcement_datetime = None
                    if message.get("announcement_datetime"):
                        try:
                            # Try to parse various datetime formats
                            dt_str = message["announcement_datetime"]
                            if isinstance(dt_str, str):
                                # Try ISO format first
                                try:
                                    announcement_datetime = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
                                except:
                                    # Try other formats
                                    for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']:
                                        try:
                                            announcement_datetime = datetime.strptime(dt_str, fmt)
                                            break
                                        except:
                                            continue
                            
                            if announcement_datetime and announcement_datetime.tzinfo is None:
                                announcement_datetime = announcement_datetime.replace(tzinfo=timezone.utc)
                        except Exception as e:
                            logger.debug(f"Could not parse announcement_datetime: {e}")
                            announcement_datetime = None
                    
                    # Parse received_at
                    received_at = datetime.now(timezone.utc)
                    if message.get("received_at"):
                        try:
                            received_at = datetime.fromisoformat(message["received_at"].replace('Z', '+00:00'))
                        except:
                            pass
                    
                    # Validate announcement_id exists
                    announcement_id = message.get("announcement_id")
                    if not announcement_id:
                        errors += 1
                        logger.warning("Skipping message with no announcement_id")
                        continue
                    
                    # Check for duplicate BEFORE inserting (more efficient)
                    existing = conn.execute("""
                        SELECT announcement_id FROM corporate_announcements 
                        WHERE announcement_id = ?
                    """, [announcement_id]).fetchone()
                    
                    if existing:
                        duplicates += 1
                        continue  # Skip duplicate
                    
                    # Parse announcement_datetime
                    announcement_datetime = None
                    if message.get("announcement_datetime"):
                        try:
                            # Try to parse various datetime formats
                            dt_str = message["announcement_datetime"]
                            if isinstance(dt_str, str):
                                # Try ISO format first
                                try:
                                    announcement_datetime = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
                                except:
                                    # Try other formats
                                    for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']:
                                        try:
                                            announcement_datetime = datetime.strptime(dt_str, fmt)
                                            break
                                        except:
                                            continue
                            
                            if announcement_datetime and announcement_datetime.tzinfo is None:
                                announcement_datetime = announcement_datetime.replace(tzinfo=timezone.utc)
                        except Exception as e:
                            logger.debug(f"Could not parse announcement_datetime: {e}")
                            announcement_datetime = None
                    
                    # Parse received_at
                    received_at = datetime.now(timezone.utc)
                    if message.get("received_at"):
                        try:
                            received_at = datetime.fromisoformat(message["received_at"].replace('Z', '+00:00'))
                        except:
                            pass
                    
                    # Insert new announcement
                    conn.execute("""
                        INSERT INTO corporate_announcements (
                            announcement_id,
                            symbol,
                            exchange,
                            headline,
                            description,
                            category,
                            announcement_datetime,
                            received_at,
                            attachment_id,
                            symbol_nse,
                            symbol_bse,
                            raw_payload
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, [
                        announcement_id,
                        message.get("symbol"),
                        message.get("exchange"),
                        headline,
                        description,
                        message.get("category"),
                        announcement_datetime,
                        received_at,
                        message.get("attachment_id"),
                        message.get("symbol_nse"),
                        message.get("symbol_bse"),
                        message.get("raw_payload")
                    ])
                    
                    inserted += 1
                    
                except Exception as e:
                    errors += 1
                    logger.error(f"Error writing announcement {message.get('announcement_id')}: {e}")
                    logger.debug(f"Message: {message}")
            
            conn.commit()
            
            if inserted > 0 or duplicates > 0 or errors > 0:
                logger.debug(f"Wrote batch: {inserted} inserted, {duplicates} duplicates, {errors} errors")
            
        except Exception as e:
            logger.error(f"Error writing batch to database: {e}", exc_info=True)
            if conn:
                try:
                    conn.rollback()
                except:
                    pass
        finally:
            if conn:
                conn.close()

