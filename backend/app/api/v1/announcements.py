"""
API endpoints for Corporate Announcements
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.permissions import get_current_user
from app.models.user import User
import duckdb
import os
import requests
import logging
import json
from app.core.config import settings
from datetime import datetime, timezone, timedelta
from app.api.v1.symbols import get_symbols_db_path

router = APIRouter()
logger = logging.getLogger(__name__)


def get_announcements_db_path() -> str:
    """Get path to announcements DuckDB database"""
    data_dir = os.path.abspath(settings.DATA_DIR)
    db_dir = os.path.join(data_dir, "Company Fundamentals")
    db_path = os.path.join(db_dir, "corporate_announcements.duckdb")
    return db_path


@router.get("/announcements")
async def get_announcements(
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, description="Search in symbol, company name, or headline"),
    symbol: Optional[str] = Query(None, description="Optional: Fetch announcements for specific symbol if not in DB"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Get corporate announcements from DuckDB with search support
    
    REST API FALLBACK (per master prompt):
    - If symbol parameter provided AND no data exists in DuckDB
    - Call TrueData REST API (getannouncementsforcompanies2)
    - Store results in DuckDB
    - Return fetched data
    
    Data Source: DuckDB ONLY (no TrueData calls on UI request unless symbol specified and no data)
    
    Search fields:
    - Symbol (symbol_nse, symbol_bse)
    - Company name (from symbols DB join)
    - Headline
    
    Returns announcements in reverse chronological order (latest first)
    """
    try:
        db_path = get_announcements_db_path()
        
        if not os.path.exists(db_path):
            # If symbol provided and no DB, try REST API fallback
            if symbol:
                return await _fetch_from_truedata_rest(symbol, limit, offset, db, current_user)
            return {
                "announcements": [],
                "total": 0,
                "limit": limit,
                "offset": offset
            }
        
        conn = duckdb.connect(db_path)
        
        # Attach symbols database for join
        symbols_db_path = get_symbols_db_path()
        if os.path.exists(symbols_db_path):
            try:
                conn.execute(f"ATTACH '{symbols_db_path}' AS symbols_db")
            except:
                pass  # Already attached or error
        
        # Build search condition
        search_condition = ""
        search_params = []
        if search and search.strip():
            search_term = f"%{search.strip().upper()}%"
            search_condition = """
                AND (
                    UPPER(a.symbol_nse) LIKE ? OR
                    UPPER(a.symbol_bse) LIKE ? OR
                    UPPER(a.headline) LIKE ? OR
                    UPPER(s.name) LIKE ?
                )
            """
            search_params = [search_term, search_term, search_term, search_term]
        
        # Get total count with search
        try:
            # Try without join first (in case symbols_db attachment fails)
            try:
                count_query = f"""
                    SELECT COUNT(*)
                    FROM corporate_announcements a
                    WHERE 1=1 {search_condition.replace('s.name', 'a.headline')}
                """
                # Adjust search params for query without join
                count_params = []
                if search and search.strip():
                    search_term = f"%{search.strip().upper()}%"
                    count_params = [search_term, search_term, search_term]
                total_result = conn.execute(count_query, count_params).fetchone()
                total = total_result[0] if total_result else 0
            except:
                # Fallback: simple count
                total_result = conn.execute("SELECT COUNT(*) FROM corporate_announcements").fetchone()
                total = total_result[0] if total_result else 0
        except Exception as count_error:
            # Table doesn't exist or schema mismatch
            logger.error(f"Error counting announcements: {count_error}")
            conn.close()
            return {
                "announcements": [],
                "total": 0,
                "limit": limit,
                "offset": offset
            }
        
        # Get announcements with symbol join
        try:
            # Try with join first
            try:
                query = f"""
                    SELECT 
                        a.announcement_id,
                        COALESCE(a.symbol_nse, a.symbol_bse, a.symbol) as symbol,
                        a.symbol_nse,
                        a.symbol_bse,
                        a.exchange,
                        a.headline,
                        a.description,
                        a.category,
                        a.announcement_datetime,
                        a.received_at,
                        a.attachment_id,
                        COALESCE(s_nse.name, s_bse.name) as company_name
                    FROM corporate_announcements a
                    LEFT JOIN symbols_db.symbols s_nse ON 
                        a.symbol_nse IS NOT NULL 
                        AND a.symbol_nse = s_nse.trading_symbol 
                        AND s_nse.exchange = 'NSE'
                    LEFT JOIN symbols_db.symbols s_bse ON 
                        a.symbol_bse IS NOT NULL 
                        AND a.symbol_bse = s_bse.trading_symbol 
                        AND s_bse.exchange = 'BSE'
                    WHERE 1=1 {search_condition}
                    ORDER BY a.received_at DESC, a.announcement_datetime DESC
                    LIMIT ? OFFSET ?
                """
                announcements = conn.execute(query, search_params + [limit, offset]).fetchall()
            except Exception as join_error:
                # Fallback: query without join if symbols_db not available
                logger.warning(f"Symbols DB join failed, using fallback query: {join_error}")
                fallback_search = ""
                fallback_params = []
                if search and search.strip():
                    search_term = f"%{search.strip().upper()}%"
                    fallback_search = """
                        AND (
                            UPPER(a.symbol_nse) LIKE ? OR
                            UPPER(a.symbol_bse) LIKE ? OR
                            UPPER(a.headline) LIKE ?
                        )
                    """
                    fallback_params = [search_term, search_term, search_term]
                
                query = f"""
                    SELECT 
                        a.announcement_id,
                        COALESCE(a.symbol_nse, a.symbol_bse, a.symbol) as symbol,
                        a.symbol_nse,
                        a.symbol_bse,
                        a.exchange,
                        a.headline,
                        a.description,
                        a.category,
                        a.announcement_datetime,
                        a.received_at,
                        a.attachment_id,
                        NULL as company_name
                    FROM corporate_announcements a
                    WHERE 1=1 {fallback_search}
                    ORDER BY a.received_at DESC, a.announcement_datetime DESC
                    LIMIT ? OFFSET ?
                """
                announcements = conn.execute(query, fallback_params + [limit, offset]).fetchall()
        except Exception as query_error:
            logger.error(f"Error querying announcements: {query_error}", exc_info=True)
            conn.close()
            return {
                "announcements": [],
                "total": 0,
                "limit": limit,
                "offset": offset
            }
        
        conn.close()
        
        # Convert to list of dicts
        result = []
        for ann in announcements:
            try:
                # Extract symbol (prioritize symbol_nse, then symbol_bse, then symbol)
                symbol_value = str(ann[1]) if ann[1] else None
                symbol_nse_value = str(ann[2]) if ann[2] else None
                symbol_bse_value = str(ann[3]) if ann[3] else None
                
                # Use the best available symbol
                display_symbol = symbol_nse_value or symbol_bse_value or symbol_value
                
                result.append({
                    "announcement_id": str(ann[0]) if ann[0] else None,
                    "symbol": display_symbol,  # Show the best available symbol
                    "symbol_nse": symbol_nse_value,
                    "symbol_bse": symbol_bse_value,
                    "exchange": str(ann[4]) if ann[4] else None,
                    "headline": str(ann[5]) if ann[5] else None,
                    "description": str(ann[6]) if ann[6] else None,
                    "category": str(ann[7]) if ann[7] else None,
                    "announcement_datetime": ann[8].isoformat() if ann[8] else None,
                    "received_at": ann[9].isoformat() if ann[9] else None,
                    "attachment_id": str(ann[10]) if ann[10] else None,
                    "company_name": str(ann[11]) if ann[11] else None  # From symbols DB
                })
            except Exception as e:
                logger.error(f"Error formatting announcement: {e}, data: {ann}")
                continue
        
        logger.debug(f"Returning {len(result)} announcements (total: {total})")
        return {
            "announcements": result,
            "total": total,
            "limit": limit,
            "offset": offset
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching announcements: {str(e)}")


@router.get("/announcements/status")
async def get_announcements_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Get status of announcements ingestion system
    """
    from app.services.announcements_manager import get_announcements_manager
    from app.models.connection import Connection
    
    manager = get_announcements_manager()
    
    # Get TrueData connections
    truedata_conns = db.query(Connection).filter(
        Connection.provider == "TrueData"
    ).all()
    
    workers_status = []
    for conn in truedata_conns:
        worker_status = manager.get_worker_status(conn.id)
        worker = manager.workers.get(conn.id) if hasattr(manager, 'workers') else None
        
        workers_status.append({
            "connection_id": conn.id,
            "connection_name": conn.name,
            "is_enabled": conn.is_enabled,
            "worker_running": worker_status.get("running", False),
            "worker_exists": worker is not None,
            "queue_size": worker_status.get("queue_size", 0),
            "connection_status": conn.status,
            "connection_health": conn.health
        })
    
    # Get database stats
    db_path = get_announcements_db_path()
    total_announcements = 0
    latest_announcement = None
    if os.path.exists(db_path):
        try:
            conn = duckdb.connect(db_path)
            try:
                result = conn.execute("SELECT COUNT(*) FROM corporate_announcements").fetchone()
                total_announcements = result[0] if result else 0
                
                # Get latest announcement timestamp
                if total_announcements > 0:
                    latest = conn.execute("""
                        SELECT announcement_id, headline, received_at 
                        FROM corporate_announcements 
                        ORDER BY received_at DESC 
                        LIMIT 1
                    """).fetchone()
                    if latest:
                        latest_announcement = {
                            "announcement_id": latest[0],
                            "headline": latest[1][:50] if latest[1] else None,
                            "received_at": latest[2].isoformat() if latest[2] else None
                        }
            except Exception as e:
                logger.error(f"Error getting database stats: {e}")
            finally:
                conn.close()
        except Exception as e:
            logger.error(f"Error connecting to announcements DB: {e}")
    
    return {
        "workers": workers_status,
        "total_announcements": total_announcements,
        "latest_announcement": latest_announcement,
        "db_writer_running": manager.db_writer is not None and (manager.db_writer.running if manager.db_writer else False),
        "message_queue_size": manager.message_queue.qsize() if hasattr(manager, 'message_queue') else 0
    }


@router.get("/announcements/{announcement_id}/attachment")
async def get_announcement_attachment(
    announcement_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Response:
    """
    Fetch and stream attachment file from TrueData REST API
    
    Never exposes TrueData URL to UI - backend fetches and streams
    """
    try:
        # Get announcement from DB to find attachment_id
        db_path = get_announcements_db_path()
        if not os.path.exists(db_path):
            raise HTTPException(status_code=404, detail="Announcement not found")
        
        conn = duckdb.connect(db_path)
        try:
            result = conn.execute("""
                SELECT attachment_id, symbol_nse, symbol_bse
                FROM corporate_announcements
                WHERE announcement_id = ?
            """, [announcement_id]).fetchone()
            
            if not result:
                raise HTTPException(status_code=404, detail="Announcement not found")
            
            attachment_id = result[0]
            if not attachment_id:
                raise HTTPException(status_code=404, detail="No attachment available")
            
            symbol_nse = result[1]
            symbol_bse = result[2]
            symbol = symbol_nse or symbol_bse
            
        finally:
            conn.close()
        
        # Get TrueData connection
        from app.models.connection import Connection
        truedata_conn = db.query(Connection).filter(
            Connection.provider == "TrueData",
            Connection.is_enabled == True
        ).first()
        
        if not truedata_conn:
            raise HTTPException(status_code=503, detail="TrueData connection not available")
        
        # Get token and fetch attachment
        from app.services.truedata_api_service import get_truedata_api_service
        api_service = get_truedata_api_service(truedata_conn.id, db)
        
        # Try announcementfile2 endpoint first, fallback to announcementfile
        try:
            file_data = api_service.call_corporate_api(
                "announcementfile2",
                params={"announcementid": attachment_id, "symbol": symbol}
            )
        except:
            try:
                file_data = api_service.call_corporate_api(
                    "announcementfile",
                    params={"announcementid": attachment_id, "symbol": symbol}
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to fetch attachment: {str(e)}")
        
        # If file_data is a URL, fetch it
        if isinstance(file_data, dict) and "url" in file_data:
            file_url = file_data["url"]
            response = requests.get(file_url, stream=True, timeout=30)
            response.raise_for_status()
            
            # Determine content type
            content_type = response.headers.get("Content-Type", "application/octet-stream")
            filename = attachment_id
            
            return Response(
                content=response.content,
                media_type=content_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"'
                }
            )
        else:
            # Assume file_data is binary
            return Response(
                content=file_data if isinstance(file_data, bytes) else str(file_data).encode(),
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f'attachment; filename="{attachment_id}"'
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error fetching attachment: {str(e)}")


async def _fetch_from_truedata_rest(
    symbol: str,
    limit: int,
    offset: int,
    db: Session,
    current_user: User
) -> dict:
    """
    REST API Fallback: Fetch announcements from TrueData REST API
    
    Used ONLY when:
    - User requests announcements for a symbol
    - AND no data exists in DuckDB
    
    Rules:
    - One-time fetch only
    - Store results in DuckDB
    - If response is "No data exists": Store empty state, do NOT retry automatically
    """
    try:
        from app.models.connection import Connection
        from app.services.truedata_api_service import get_truedata_api_service
        from app.services.announcements_db_writer import AnnouncementsDBWriter
        from queue import Queue
        
        # Get enabled TrueData connection
        truedata_conn = db.query(Connection).filter(
            Connection.provider == "TrueData",
            Connection.is_enabled == True
        ).first()
        
        if not truedata_conn:
            logger.warning("No enabled TrueData connection for REST API fallback")
            return {
                "announcements": [],
                "total": 0,
                "limit": limit,
                "offset": offset
            }
        
        # Call TrueData REST API
        api_service = get_truedata_api_service(truedata_conn.id, db)
        
        # Use getannouncementsforcompanies2 endpoint
        # Format: from=DDMMYY HH:MM:SS&to=DDMMYY HH:MM:SS
        from datetime import datetime, timedelta
        today = datetime.now()
        from_date = (today - timedelta(days=7)).strftime("%d%m%y 00:00:00")  # Last 7 days
        to_date = today.strftime("%d%m%y 23:59:59")
        
        try:
            response = api_service.call_corporate_api(
                "getannouncementsforcompanies2",
                params={
                    "response": "json",
                    "from": from_date,
                    "to": to_date,
                    "symbol": symbol
                },
                timeout=30
            )
        except Exception as api_error:
            error_msg = str(api_error).lower()
            if "no data" in error_msg or "not found" in error_msg:
                logger.info(f"No announcements found for symbol {symbol} via REST API")
                # Store empty state - don't retry
                return {
                    "announcements": [],
                    "total": 0,
                    "limit": limit,
                    "offset": offset
                }
            raise
        
        # Parse response and store in DB
        if not response or (isinstance(response, dict) and response.get("error")):
            logger.warning(f"TrueData REST API returned error or empty response for {symbol}")
            return {
                "announcements": [],
                "total": 0,
                "limit": limit,
                "offset": offset
            }
        
        # Process and store announcements
        announcements_list = response if isinstance(response, list) else response.get("announcements", [])
        if not announcements_list:
            return {
                "announcements": [],
                "total": 0,
                "limit": limit,
                "offset": offset
            }
        
        # Write to database using the same writer logic
        db_path = get_announcements_db_path()
        temp_queue = Queue()
        writer = AnnouncementsDBWriter(temp_queue)
        
        # Parse each announcement and queue it
        stored_count = 0
        for ann_data in announcements_list:
            # Convert REST API response to our format
            parsed = {
                "announcement_id": str(ann_data.get("id") or ann_data.get("announcement_id") or f"{symbol}_{ann_data.get('date', '')}"),
                "symbol": symbol,
                "symbol_nse": ann_data.get("symbol_nse") or (symbol if "NSE" in str(ann_data.get("exchange", "")).upper() else None),
                "symbol_bse": ann_data.get("symbol_bse") or (symbol if "BSE" in str(ann_data.get("exchange", "")).upper() else None),
                "exchange": ann_data.get("exchange"),
                "headline": ann_data.get("headline") or ann_data.get("subject") or ann_data.get("title"),
                "description": ann_data.get("description") or ann_data.get("news_body") or ann_data.get("body"),
                "category": ann_data.get("category") or ann_data.get("descriptor") or ann_data.get("type"),
                "announcement_datetime": ann_data.get("announcement_datetime") or ann_data.get("tradedate") or ann_data.get("date"),
                "attachment_id": ann_data.get("attachment_id") or ann_data.get("attachment"),
                "received_at": datetime.now(timezone.utc).isoformat(),
                "raw_payload": json.dumps(ann_data)
            }
            temp_queue.put(parsed)
            stored_count += 1
        
        # Write batch to DB
        if stored_count > 0:
            writer._write_batch(list(temp_queue.queue))
            logger.info(f"Stored {stored_count} announcements from REST API for symbol {symbol}")
        
        # Now return from DB (same query as normal flow)
        conn = duckdb.connect(db_path)
        try:
            # Get stored announcements
            result = conn.execute("""
                SELECT 
                    announcement_id, symbol, symbol_nse, symbol_bse, exchange,
                    headline, description, category, announcement_datetime,
                    received_at, attachment_id, NULL as company_name
                FROM corporate_announcements
                WHERE symbol = ? OR symbol_nse = ? OR symbol_bse = ?
                ORDER BY received_at DESC, announcement_datetime DESC
                LIMIT ? OFFSET ?
            """, [symbol, symbol, symbol, limit, offset]).fetchall()
            
            total = conn.execute("""
                SELECT COUNT(*) FROM corporate_announcements
                WHERE symbol = ? OR symbol_nse = ? OR symbol_bse = ?
            """, [symbol, symbol, symbol]).fetchone()[0]
            
            announcements = []
            for ann in result:
                announcements.append({
                    "announcement_id": str(ann[0]) if ann[0] else None,
                    "symbol": str(ann[1]) if ann[1] else None,
                    "symbol_nse": str(ann[2]) if ann[2] else None,
                    "symbol_bse": str(ann[3]) if ann[3] else None,
                    "exchange": str(ann[4]) if ann[4] else None,
                    "headline": str(ann[5]) if ann[5] else None,
                    "description": str(ann[6]) if ann[6] else None,
                    "category": str(ann[7]) if ann[7] else None,
                    "announcement_datetime": ann[8].isoformat() if ann[8] else None,
                    "received_at": ann[9].isoformat() if ann[9] else None,
                    "attachment_id": str(ann[10]) if ann[10] else None,
                    "company_name": None
                })
            
            return {
                "announcements": announcements,
                "total": total,
                "limit": limit,
                "offset": offset
            }
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Error in REST API fallback: {e}", exc_info=True)
        return {
            "announcements": [],
            "total": 0,
            "limit": limit,
            "offset": offset
        }



