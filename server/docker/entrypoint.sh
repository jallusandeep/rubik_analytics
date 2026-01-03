#!/bin/sh
set -e

# Change to backend directory (bind mount in dev mode will have the code here)
cd /app/backend

# Run database initialization
echo "==========================================="
echo "  INITIALIZING DATABASE..."
echo "==========================================="
python scripts/init/init_auth_database.py

# Check if DEV_MODE is enabled
if [ "$DEV_MODE" = "true" ]; then
    echo "==========================================="
    echo "  STARTING BACKEND IN DEV MODE"
    echo "  Auto-reload enabled - watching for changes..."
    echo "==========================================="
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level info
else
    echo "==========================================="
    echo "  STARTING BACKEND IN PRODUCTION MODE"
    echo "==========================================="
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 --no-access-log
fi

