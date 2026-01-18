
import duckdb
import logging
import os
from .config import IPO_DB_PATH, IPO_TABLE, IPO_DATA_DIR, BSE_IPO_DB_PATH, BSE_TABLE, GMP_IPO_DB_PATH, GMP_TABLE

# ... (keep existing functions) ...

# GMP Functions

def ensure_gmp_schema():
    """
    Ensures the GMP IPO data directory and table exist.
    """
    try:
        with duckdb.connect(GMP_IPO_DB_PATH) as conn:
             conn.execute(f"CREATE SEQUENCE IF NOT EXISTS seq_gmp_id START 1;")
             
             # Create Table
             query = f"""
             CREATE TABLE IF NOT EXISTS {GMP_TABLE} (
                 id BIGINT DEFAULT nextval('seq_gmp_id') PRIMARY KEY,
                 ipo_name TEXT,
                 gmp TEXT,
                 ipo_price TEXT,
                 expected_listing_gain TEXT,
                 review TEXT,
                 gmp_updated_date TEXT,
                 ipo_type TEXT,
                 scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
             );
             """
             conn.execute(query)
             logger.info(f"GMP IPO DB Schema initialized at {GMP_IPO_DB_PATH}")

    except Exception as e:
        logger.error(f"GMP IPO DB Schema Creation Error: {e}")

def insert_gmp_data(data_list):
    """
    Inserts a list of GMP IPO dictionaries into the database.
    """
    if not data_list:
        return

    try:
        with duckdb.connect(GMP_IPO_DB_PATH) as conn:
            for item in data_list:
                # Upsert Logic based on IPO Name
                ipo_name = item.get("ipo_name")
                
                if not ipo_name:
                    continue

                # Check if exists
                existing = conn.execute(
                    f"SELECT id FROM {GMP_TABLE} WHERE ipo_name=?", 
                    (ipo_name,)
                ).fetchone()

                if existing:
                    # Update
                    update_query = f"""
                    UPDATE {GMP_TABLE} SET
                        gmp=?, ipo_price=?, expected_listing_gain=?,
                        review=?, gmp_updated_date=?, ipo_type=?,
                        scraped_at=CURRENT_TIMESTAMP
                    WHERE ipo_name=?
                    """
                    conn.execute(update_query, (
                        item.get("gmp"),
                        item.get("ipo_price"),
                        item.get("expected_listing_gain"),
                        item.get("review"),
                        item.get("gmp_updated_date"),
                        item.get("ipo_type"),
                        ipo_name
                    ))
                else:
                    # Insert
                    insert_query = f"""
                    INSERT INTO {GMP_TABLE} (
                        ipo_name, gmp, ipo_price, expected_listing_gain,
                        review, gmp_updated_date, ipo_type
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """
                    conn.execute(insert_query, (
                        ipo_name,
                        item.get("gmp"),
                        item.get("ipo_price"),
                        item.get("expected_listing_gain"),
                        item.get("review"),
                        item.get("gmp_updated_date"),
                        item.get("ipo_type")
                    ))
            
            logger.info(f"Processed {len(data_list)} records (Upsert) into {GMP_TABLE}")

    except Exception as e:
        logger.error(f"Failed to insert GMP IPO data: {e}")

def get_gmp_stats():
    """
    Returns stats for GMP IPOs.
    """
    try:
        if not os.path.exists(GMP_IPO_DB_PATH):
             return {"total": 0}

        with duckdb.connect(GMP_IPO_DB_PATH, read_only=True) as conn:
            try:
                total_count = conn.execute(f"SELECT COUNT(*) FROM {GMP_TABLE}").fetchone()[0]
            except duckdb.CatalogException:
                return {"total": 0}

            return {
                "total": total_count
            }
    except Exception as e:
        logger.error(f"Error fetching GMP stats: {e}")
        return {"total": 0}

def get_gmp_data(limit=100):
    """
    Fetch recent GMP IPO data for UI display.
    """
    try:
        if not os.path.exists(GMP_IPO_DB_PATH):
             return []

        with duckdb.connect(GMP_IPO_DB_PATH, read_only=True) as conn:
            query = f"""
            SELECT 
                ipo_name, gmp, ipo_price, expected_listing_gain,
                review, gmp_updated_date, ipo_type, scraped_at
            FROM {GMP_TABLE}
            ORDER BY scraped_at DESC
            LIMIT ?
            """
            rows = conn.execute(query, [limit]).fetchall()
            
            result = []
            for row in rows:
                result.append({
                    "ipo_name": row[0],
                    "gmp": row[1],
                    "ipo_price": row[2],
                    "expected_listing_gain": row[3],
                    "review": row[4],
                    "gmp_updated_date": row[5],
                    "ipo_type": row[6],
                    "scraped_at": row[7].strftime("%Y-%m-%d %H:%M:%S") if row[7] else None
                })
            return result
    except Exception as e:
        logger.error(f"Error fetching GMP data: {e}")
        return []

# BSE Functions

def ensure_bse_schema():
    """
    Ensures the BSE IPO data directory and table exist.
    """
    try:
        with duckdb.connect(BSE_IPO_DB_PATH) as conn:
             conn.execute(f"CREATE SEQUENCE IF NOT EXISTS seq_bse_id START 1;")
             
             # Create Table
             query = f"""
             CREATE TABLE IF NOT EXISTS {BSE_TABLE} (
                 id BIGINT DEFAULT nextval('seq_bse_id') PRIMARY KEY,
                 security_name TEXT,
                 exchange_platform TEXT,
                 start_date TEXT,
                 end_date TEXT,
                 offer_price TEXT,
                 face_value TEXT,
                 issue_type TEXT,
                 status TEXT,
                 scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
             );
             """
             conn.execute(query)
             logger.info(f"BSE IPO DB Schema initialized at {BSE_IPO_DB_PATH}")

    except Exception as e:
        logger.error(f"BSE IPO DB Schema Creation Error: {e}")

def insert_bse_data(data_list):
    """
    Inserts a list of BSE IPO dictionaries into the database.
    """
    if not data_list:
        return

    try:
        with duckdb.connect(BSE_IPO_DB_PATH) as conn:
            for item in data_list:
                # Upsert Logic based on Security Name
                security_name = item.get("Security Name")
                
                if not security_name:
                    continue

                # Check if exists
                existing = conn.execute(
                    f"SELECT id FROM {BSE_TABLE} WHERE security_name=?", 
                    (security_name,)
                ).fetchone()

                if existing:
                    # Update
                    update_query = f"""
                    UPDATE {BSE_TABLE} SET
                        exchange_platform=?, start_date=?, end_date=?,
                        offer_price=?, face_value=?, issue_type=?, status=?,
                        scraped_at=CURRENT_TIMESTAMP
                    WHERE security_name=?
                    """
                    conn.execute(update_query, (
                        item.get("Exchange Platform"),
                        item.get("Start Date"),
                        item.get("End Date"),
                        item.get("Offer Price (₹)"),
                        item.get("Face Value (₹)"),
                        item.get("Type of Issue"),
                        item.get("Issue Status"),
                        security_name
                    ))
                else:
                    # Insert
                    insert_query = f"""
                    INSERT INTO {BSE_TABLE} (
                        security_name, exchange_platform, start_date, end_date,
                        offer_price, face_value, issue_type, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """
                    conn.execute(insert_query, (
                        security_name,
                        item.get("Exchange Platform"),
                        item.get("Start Date"),
                        item.get("End Date"),
                        item.get("Offer Price (₹)"),
                        item.get("Face Value (₹)"),
                        item.get("Type of Issue"),
                        item.get("Issue Status")
                    ))
            
            logger.info(f"Processed {len(data_list)} records (Upsert) into {BSE_TABLE}")

    except Exception as e:
        logger.error(f"Failed to insert BSE IPO data: {e}")

def get_bse_stats():
    """
    Returns stats for BSE IPOs.
    """
    try:
        if not os.path.exists(BSE_IPO_DB_PATH):
             return {"total": 0, "open": 0}

        with duckdb.connect(BSE_IPO_DB_PATH, read_only=True) as conn:
            try:
                total_count = conn.execute(f"SELECT COUNT(*) FROM {BSE_TABLE}").fetchone()[0]
                # Maybe count open ones? Status based.
                open_count = conn.execute(f"SELECT COUNT(*) FROM {BSE_TABLE} WHERE status ILIKE '%Open%'").fetchone()[0]
            except duckdb.CatalogException:
                return {"total": 0, "open": 0}

            return {
                "total": total_count,
                "open": open_count
            }
    except Exception as e:
        logger.error(f"Error fetching BSE stats: {e}")
        return {"total": 0, "open": 0}

def get_bse_data(limit=100):
    """
    Fetch recent BSE IPO data for UI display.
    """
    try:
        if not os.path.exists(BSE_IPO_DB_PATH):
             return []

        with duckdb.connect(BSE_IPO_DB_PATH, read_only=True) as conn:
            query = f"""
            SELECT 
                security_name, exchange_platform, start_date, end_date,
                offer_price, face_value, issue_type, status, scraped_at
            FROM {BSE_TABLE}
            ORDER BY scraped_at DESC
            LIMIT ?
            """
            rows = conn.execute(query, [limit]).fetchall()
            
            result = []
            for row in rows:
                result.append({
                    "security_name": row[0],
                    "exchange_platform": row[1],
                    "start_date": row[2],
                    "end_date": row[3],
                    "offer_price": row[4],
                    "face_value": row[5],
                    "issue_type": row[6],
                    "status": row[7],
                    "scraped_at": row[8].strftime("%Y-%m-%d %H:%M:%S") if row[8] else None
                })
            return result
    except Exception as e:
        logger.error(f"Error fetching BSE data: {e}")
        return []

from app.services.shared_db import get_shared_db

logger = logging.getLogger(__name__)

def ensure_schema():
    """
    Ensures the IPO data directory and table exist.
    """
    # 1. Ensure directory exists
    try:
        os.makedirs(IPO_DATA_DIR, exist_ok=True)
    except Exception as e:
        logger.error(f"Failed to create IPO data directory {IPO_DATA_DIR}: {e}")
        return

    # 2. Ensure Schema
    try:
        db = get_shared_db()
        
        # Connect specifically to the IPO duckdb file attached to the shared connection
        # Or more simply, since shared_db manages connections, we might need to attach this specific DB
        # However, shared_db usually manages a main DB. 
        # For simplicity and isolation as per user request ("store this under data/scrapper/IPO/nse duckdb"), 
        # we will use a separate connection for this specific isolated DB file to avoid attaching/detaching complexity 
        # unless shared_db is strictly required for everything.
        # BUT, to avoid file locking if multiple things access it, we should be careful.
        # Given this is a scraper running periodically and a reader (stats), distinct connections might be okay 
        # IF they are short lived. 
        # BETTER: Use shared_db logic if possible or just standard duckdb connect for this isolated file 
        # since it's not the main system DB.
        
        # Let's use a standard connection for this specific file to keep it isolated as requested.
        with duckdb.connect(IPO_DB_PATH) as conn:
             conn.execute(f"CREATE SEQUENCE IF NOT EXISTS seq_ipo_id START 1;")
             
             # Create Table
             query = f"""
             CREATE TABLE IF NOT EXISTS {IPO_TABLE} (
                 id BIGINT DEFAULT nextval('seq_ipo_id') PRIMARY KEY,
                 type TEXT, -- 'CURRENT' or 'UPCOMING'
                 company_name TEXT,
                 symbol TEXT,
                 security_type TEXT,
                 issue_start_date TEXT,
                 issue_end_date TEXT,
                 status TEXT,
                 price_range TEXT,
                 issue_size TEXT,
                 offered_reserved TEXT,
                 bids TEXT,
                 subscription TEXT,
                 scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
             );
             """
             conn.execute(query)
             logger.info(f"IPO DB Schema initialized at {IPO_DB_PATH}")

    except Exception as e:
        logger.error(f"IPO DB Schema Creation Error: {e}")

def insert_ipo_data(data_list):
    """
    Inserts a list of IPO dictionaries into the database.
    """
    if not data_list:
        return

    try:
        with duckdb.connect(IPO_DB_PATH) as conn:
            for item in data_list:
                # Upsert Logic based on Symbol or Company Name (if Symbol missing)
                symbol = item.get("Symbol")
                ipo_type = item.get("Type")
                company_name = item.get("Company Name")
                
                if not ipo_type or (not symbol and not company_name):
                    continue

                # Check if exists
                existing = None
                identifier_field = "symbol"
                identifier_value = symbol
                
                if symbol:
                    # Try finding by Symbol + Type
                    existing = conn.execute(
                        f"SELECT id FROM {IPO_TABLE} WHERE symbol=? AND type=?", 
                        (symbol, ipo_type)
                    ).fetchone()
                
                if not existing and company_name:
                     # Try finding by Company Name + Type (Fallback or primary if symbol missing)
                     existing = conn.execute(
                        f"SELECT id FROM {IPO_TABLE} WHERE company_name=? AND type=?", 
                        (company_name, ipo_type)
                    ).fetchone()
                     if existing:
                         # We found it by company name, use this for update
                         identifier_field = "company_name"
                         identifier_value = company_name

                if existing:
                    # Update
                    # Note: We update everything except the identifier we found it by (mostly)
                    # Use the same identifier field for WHERE clause
                    update_query = f"""
                    UPDATE {IPO_TABLE} SET
                        company_name=?, symbol=?, security_type=?, issue_start_date=?, issue_end_date=?,
                        status=?, price_range=?, issue_size=?, offered_reserved=?, bids=?, 
                        subscription=?, scraped_at=CURRENT_TIMESTAMP
                    WHERE {identifier_field}=? AND type=?
                    """
                    conn.execute(update_query, (
                        item.get("Company Name"),
                        item.get("Symbol"), # Might be None, that's okay
                        item.get("Security Type"),
                        item.get("Issue Start Date"),
                        item.get("Issue End Date"),
                        item.get("Status"),
                        item.get("Price Range"),
                        item.get("Issue Size"),
                        item.get("Offered/Reserved"),
                        item.get("Bids"),
                        item.get("Subscription"),
                        identifier_value,
                        ipo_type
                    ))
                else:
                    # Insert
                    insert_query = f"""
                    INSERT INTO {IPO_TABLE} (
                        type, company_name, symbol, security_type, issue_start_date, issue_end_date,
                        status, price_range, issue_size, offered_reserved, bids, subscription
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """
                    conn.execute(insert_query, (
                        ipo_type,
                        item.get("Company Name"),
                        symbol,
                        item.get("Security Type"),
                        item.get("Issue Start Date"),
                        item.get("Issue End Date"),
                        item.get("Status"),
                        item.get("Price Range"),
                        item.get("Issue Size"),
                        item.get("Offered/Reserved"),
                        item.get("Bids"),
                        item.get("Subscription")
                    ))
            
            logger.info(f"Processed {len(data_list)} records (Upsert) into {IPO_TABLE}")

    except Exception as e:
        logger.error(f"Failed to insert IPO data: {e}")

def get_ipo_stats():
    """
    Returns stats for current and upcoming IPOs from the latest scrape.
    Since we append, we might want to count only the 'latest' or just all?
    Let's counting all valid records might be misleading if we append duplicates.
    Let's assume we want valid active ones.
    For now, let's just count total records of each type to be simple, 
    or maybe distinct company names?
    """
    try:
        # Check if DB file exists
        if not os.path.exists(IPO_DB_PATH):
             return {"current": 0, "upcoming": 0, "total": 0}

        with duckdb.connect(IPO_DB_PATH, read_only=True) as conn:
            # simple count
            try:
                current_count = conn.execute(f"SELECT COUNT(*) FROM {IPO_TABLE} WHERE type='CURRENT'").fetchone()[0]
                upcoming_count = conn.execute(f"SELECT COUNT(*) FROM {IPO_TABLE} WHERE type='UPCOMING'").fetchone()[0]
            except duckdb.CatalogException:
                # Table might not exist yet
                return {"current": 0, "upcoming": 0, "total": 0}

            return {
                "current": current_count,
                "upcoming": upcoming_count,
                "total": current_count + upcoming_count
            }
    except Exception as e:
        logger.error(f"Error fetching IPO stats: {e}")
        return {"current": 0, "upcoming": 0, "total": 0}

def get_ipo_data(limit=100):
    """
    Fetch recent IPO data for UI display.
    """
    try:
        if not os.path.exists(IPO_DB_PATH):
             return []

        with duckdb.connect(IPO_DB_PATH, read_only=True) as conn:
            query = f"""
            SELECT 
                type, company_name, symbol, security_type, 
                issue_start_date, issue_end_date, status, 
                price_range, issue_size, offered_reserved, 
                bids, subscription, scraped_at
            FROM {IPO_TABLE}
            ORDER BY scraped_at DESC, issue_start_date DESC
            LIMIT ?
            """
            rows = conn.execute(query, [limit]).fetchall()
            
            result = []
            for row in rows:
                result.append({
                    "type": row[0],
                    "company_name": row[1],
                    "symbol": row[2],
                    "security_type": row[3],
                    "issue_start_date": row[4],
                    "issue_end_date": row[5],
                    "status": row[6],
                    "price_range": row[7],
                    "issue_size": row[8],
                    "offered_reserved": row[9],
                    "bids": row[10],
                    "subscription": row[11],
                    "scraped_at": row[12].strftime("%Y-%m-%d %H:%M:%S") if row[12] else None
                })
            return result
    except Exception as e:
        logger.error(f"Error fetching IPO data: {e}")
        return []

def cleanup_old_data():
    """
    Deletes records older than 24 hours from all IPO-related tables.
    """
    logger.info("Starting cleanup of old IPO data...")
    try:
        # 1. Clean IPO Scraper Data (NSE)
        if os.path.exists(IPO_DB_PATH):
            with duckdb.connect(IPO_DB_PATH) as conn:
                try:
                    # Check if table exists first to avoid errors if DB exists but table doesn't
                    table_exists = conn.execute(f"SELECT count(*) FROM information_schema.tables WHERE table_name = '{IPO_TABLE}'").fetchone()[0] > 0
                    if table_exists:
                        query = f"DELETE FROM {IPO_TABLE} WHERE scraped_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'"
                        conn.execute(query)
                        logger.info(f"Cleaned old records from {IPO_TABLE}")
                except Exception as e:
                     logger.warning(f"Could not clean {IPO_TABLE}: {e}")


        # 2. Clean BSE IPO Data
        if os.path.exists(BSE_IPO_DB_PATH):
            with duckdb.connect(BSE_IPO_DB_PATH) as conn:
                try:
                    table_exists = conn.execute(f"SELECT count(*) FROM information_schema.tables WHERE table_name = '{BSE_TABLE}'").fetchone()[0] > 0
                    if table_exists:
                        query = f"DELETE FROM {BSE_TABLE} WHERE scraped_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'"
                        conn.execute(query)
                        logger.info(f"Cleaned old records from {BSE_TABLE}")
                except Exception as e:
                     logger.warning(f"Could not clean {BSE_TABLE}: {e}")

        # 3. Clean GMP IPO Data
        if os.path.exists(GMP_IPO_DB_PATH):
            with duckdb.connect(GMP_IPO_DB_PATH) as conn:
                try:
                    table_exists = conn.execute(f"SELECT count(*) FROM information_schema.tables WHERE table_name = '{GMP_TABLE}'").fetchone()[0] > 0
                    if table_exists:
                        query = f"DELETE FROM {GMP_TABLE} WHERE scraped_at < CURRENT_TIMESTAMP - INTERVAL '24 hours'"
                        conn.execute(query)
                        logger.info(f"Cleaned old records from {GMP_TABLE}")
                except Exception as e:
                     logger.warning(f"Could not clean {GMP_TABLE}: {e}")

    except Exception as e:
        logger.error(f"Error during data cleanup: {e}")
