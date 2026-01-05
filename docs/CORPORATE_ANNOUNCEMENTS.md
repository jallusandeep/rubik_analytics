# Corporate Announcements Feature

## Overview

The Corporate Announcements feature provides real-time ingestion and display of corporate announcements from TrueData via WebSocket, with storage in DuckDB and a REST API fallback mechanism.

## Architecture

### Components

1. **WebSocket Worker** (`announcements_websocket_worker.py`)
   - Maintains persistent connection to TrueData Corporate Announcements WebSocket
   - Receives real-time announcement messages
   - Parses and validates messages
   - Queues valid announcements for database storage

2. **Database Writer** (`announcements_db_writer.py`)
   - Single-threaded service that reads from message queue
   - Writes announcements to DuckDB in batches
   - Handles duplicate detection and blank entry filtering
   - Ensures data integrity

3. **Announcements Manager** (`announcements_manager.py`)
   - Manages lifecycle of WebSocket workers
   - Controls worker start/stop based on connection status
   - Provides status monitoring

4. **REST API** (`announcements.py`)
   - Serves announcements to frontend
   - Provides search functionality
   - Handles attachment downloads
   - Implements REST API fallback for missing data

### Data Flow

```
TrueData WebSocket → WebSocket Worker → Message Queue → Database Writer → DuckDB
                                                              ↓
                                                         Frontend API
```

## Database Schema

### Table: `corporate_announcements`

```sql
CREATE TABLE corporate_announcements (
    announcement_id VARCHAR PRIMARY KEY,
    symbol VARCHAR,
    symbol_nse VARCHAR,
    symbol_bse VARCHAR,
    exchange VARCHAR,
    headline VARCHAR,
    description TEXT,
    category VARCHAR,
    announcement_datetime TIMESTAMP,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    attachment_id VARCHAR,
    raw_payload TEXT
)
```

### Indexes

- `idx_announcements_datetime` on `announcement_datetime DESC`
- `idx_announcements_received_at` on `received_at DESC`
- `idx_announcements_symbol` on `symbol`

## Configuration

### TrueData Connection

1. **WebSocket URL**: `wss://corp.truedata.in:9092`
   - **Port 9092** is required for Corporate Announcements
   - Port 8086 is for Market Data (NOT announcements)
   - Port 9094 is incorrect and will be overridden

2. **Authentication**: Query parameters
   - Format: `wss://corp.truedata.in:9092?user=<USERNAME>&password=<PASSWORD>`

3. **Connection Setup**:
   - Go to Admin → Connections → TrueData
   - Configure username and password
   - Enable the connection to start WebSocket worker

### Database Location

- **Path**: `{DATA_DIR}/Company Fundamentals/corporate_announcements.duckdb`
- Created automatically on first use

## API Endpoints

### Get Announcements

```http
GET /api/v1/announcements?limit=25&offset=0&search=<query>
```

**Parameters:**
- `limit` (default: 100, max: 1000): Number of results
- `offset` (default: 0): Pagination offset
- `search` (optional): Search in symbol, company name, or headline

**Response:**
```json
{
  "announcements": [
    {
      "announcement_id": "12345",
      "symbol": "RELIANCE",
      "symbol_nse": "RELIANCE",
      "symbol_bse": null,
      "exchange": "NSE",
      "headline": "Board Meeting",
      "description": "Board meeting scheduled...",
      "category": "Board Meeting",
      "announcement_datetime": "2026-01-05T12:00:00",
      "received_at": "2026-01-05T12:00:00Z",
      "attachment_id": "att123",
      "company_name": "Reliance Industries Ltd"
    }
  ],
  "total": 100,
  "limit": 25,
  "offset": 0
}
```

### Get Announcement Status

```http
GET /api/v1/announcements/status
```

**Response:**
```json
{
  "workers": [
    {
      "connection_id": 3,
      "connection_name": "TrueData Production",
      "is_enabled": true,
      "worker_running": true,
      "worker_exists": true,
      "queue_size": 5,
      "connection_status": "CONNECTED",
      "connection_health": "UP"
    }
  ],
  "total_announcements": 1250,
  "latest_announcement": {
    "announcement_id": "12345",
    "headline": "Board Meeting",
    "received_at": "2026-01-05T12:00:00Z"
  },
  "db_writer_running": true,
  "message_queue_size": 2
}
```

### Download Attachment

```http
GET /api/v1/announcements/{announcement_id}/attachment/{attachment_id}
```

**Response:** Binary file stream

## Data Validation

### Blank Entry Filtering

The system automatically filters out:
- Messages with no `announcement_id`
- Messages with no `headline` AND no `description`
- Messages where `headline` is just "-", "", "null", or "None"

### Duplicate Detection

- Duplicates are detected by `announcement_id`
- If duplicate found, the message is skipped (no insertion)
- Check is performed before database write for efficiency

## Symbol Extraction

The parser tries multiple methods to extract symbols:

1. **Direct Fields**: `symbol`, `symbol_nse`, `symbol_bse`, `Symbol`, `SYMBOL`, etc.
2. **Nested Structures**: Checks `nse.symbol`, `bse.symbol` if present
3. **Exchange Inference**: Uses `exchange` field to determine NSE vs BSE
4. **Headline Extraction**: Regex pattern matching for symbol codes in headlines

### Company Name Resolution

Company names are resolved by joining with the symbols database:
- Joins on `symbol_nse` or `symbol_bse` matching `trading_symbol`
- Requires symbols database to be attached
- Falls back to NULL if no match found

## REST API Fallback

If a `symbol` parameter is provided and no data exists in DuckDB:
1. Calls TrueData REST API (`getannouncementsforcompanies2`)
2. Fetches last 7 days of announcements
3. Stores results in DuckDB
4. Returns fetched data

**Note**: This is a one-time fetch. If "No data exists" response is received, empty state is stored and not retried automatically.

## Troubleshooting

### WebSocket Not Connecting

1. **Check Port**: Must use port 9092 (not 8086 or 9094)
2. **Check Credentials**: Verify username/password in connection settings
3. **Check Logs**: Look for connection errors in backend logs
4. **Restart Worker**: Toggle connection OFF then ON

### Messages Not Parsing

1. **Check Logs**: Look for "Sample WebSocket message structure" logs
2. **Verify Format**: Messages should be valid JSON
3. **Check Validation**: Ensure messages have headline or description

### Symbols Not Appearing

1. **Check Database**: Verify symbols are stored in `symbol_nse` or `symbol_bse` columns
2. **Check Symbols DB**: Ensure symbols database is attached and has matching records
3. **Check Parser**: Review logs for symbol extraction attempts
4. **Manual Extraction**: Parser may extract from headlines if not in message

### Duplicates Appearing

1. **Run Cleanup Script**: `python scripts/maintenance/clean_announcements.py`
2. **Check announcement_id**: Ensure unique IDs are being generated
3. **Verify Deduplication**: Check logs for duplicate detection

### Blank Entries

1. **Run Cleanup Script**: `python scripts/maintenance/clean_announcements.py`
2. **Check Validation**: New entries should be filtered automatically
3. **Review Parser**: Ensure validation logic is working

## Maintenance Scripts

### Clean Announcements

```bash
cd backend
python scripts/maintenance/clean_announcements.py
```

**Actions:**
- Removes blank entries (no headline/description)
- Removes duplicate entries (keeps earliest)
- Shows before/after statistics

### Check Announcements

```bash
cd backend
python scripts/maintenance/check_announcements.py
```

**Actions:**
- Shows database statistics
- Lists recent announcements
- Checks for issues

## Monitoring

### Log Messages to Watch

1. **Connection**: `[ANNOUNCEMENTS] ✅ Connected to Corporate Announcements WebSocket`
2. **Messages**: `Received announcement: <id> - <headline>`
3. **Errors**: `Failed to parse announcement message`
4. **Warnings**: `Skipping announcement with no headline or description`

### Status Endpoint

Use `/api/v1/announcements/status` to monitor:
- Worker running status
- Queue sizes
- Total announcements
- Latest announcement timestamp

## Best Practices

1. **Regular Cleanup**: Run cleanup script periodically to remove blanks/duplicates
2. **Monitor Queue**: Watch queue size - if growing, database writer may be slow
3. **Check Logs**: Review parsing errors to identify message format issues
4. **Symbol Database**: Keep symbols database updated for company name resolution
5. **Connection Health**: Monitor connection status and auto-reconnect behavior

## Limitations

1. **Symbol Extraction**: May not always extract symbols if not in message format
2. **Company Names**: Requires symbols database with matching trading_symbols
3. **REST Fallback**: Only triggers when symbol parameter provided and no data exists
4. **WebSocket**: Requires persistent connection - reconnects automatically on failure

## Related Documentation

- [TrueData Connection Guide](./TRUEDATA_CONNECTION.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [API Documentation](./API.md)

