# Docker Development Setup - Auto-Reload Guide

This guide explains how to use Docker with automatic code reloading for Rubik View development.

## Overview

The development Docker setup enables **automatic code reloading** - when you edit Python files, the FastAPI backend automatically restarts without requiring manual Docker restarts or rebuilds.

## Quick Start

### Windows Users (Recommended)

Use the batch files for the easiest experience:

**Start everything:**
```batch
server\docker\start-dev.bat
```

**Stop services:**
```batch
server\docker\stop-dev.bat
```

**View logs:**
```batch
server\docker\logs-dev.bat
```

**Restart services:**
```batch
server\docker\restart-dev.bat
```

The `start-dev.bat` file will:
- ✅ Check Docker is running
- ✅ Stop conflicting local servers
- ✅ Start dev containers
- ✅ Open logs window automatically

### Manual Setup (All Platforms)

#### First Time Setup

1. **Start the development environment:**
   ```bash
   cd server/docker
   docker compose -f docker-compose.dev.yml up -d
   ```

2. **View logs to verify auto-reload is working:**
   ```bash
   docker compose -f docker-compose.dev.yml logs -f backend
   ```

   You should see:
   ```
   ===========================================
     STARTING BACKEND IN DEV MODE
     Auto-reload enabled - watching for changes...
   ===========================================
   ```

#### Daily Development

Once started, you can:
- **Edit any `.py` file** in `backend/` → Save → Changes reflect automatically
- **View logs** to see reload events:
  ```bash
  docker compose -f docker-compose.dev.yml logs -f backend
  ```
- **Stop services:**
  ```bash
  docker compose -f docker-compose.dev.yml down
  ```

## How It Works

### 1. Bind Mounts
The `docker-compose.dev.yml` mounts your local `backend/` directory into the container:
```yaml
volumes:
  - ../../backend:/app/backend
```

This means:
- ✅ Code changes sync instantly
- ✅ No need to rebuild image for code changes
- ✅ Edit files directly in your IDE

### 2. Auto-Reload
The Dockerfile entrypoint detects `DEV_MODE=true` and runs uvicorn with `--reload`:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The `--reload` flag watches for file changes and automatically restarts the server.

### 3. Reload Triggers
Auto-reload triggers on:
- ✅ `.py` file changes (any Python file)
- ✅ API route changes
- ✅ WebSocket handler changes
- ✅ Model/schema changes
- ✅ Service changes

## When to Rebuild

### Code-Only Changes
**NO REBUILD NEEDED** - Just save your file and wait for auto-reload.

### Dependency Changes
If you modify `backend/requirements.txt`, rebuild:
```bash
docker compose -f docker-compose.dev.yml up -d --build
```

### Dockerfile Changes
If you modify `backend.Dockerfile`, rebuild:
```bash
docker compose -f docker-compose.dev.yml up -d --build
```

## DEV vs PROD

### Development (`docker-compose.dev.yml`)
- ✅ Bind mounts for code
- ✅ Auto-reload enabled (`--reload`)
- ✅ Detailed logging
- ✅ Fast iteration

### Production (`docker-compose.yml`)
- ❌ No bind mounts (code baked into image)
- ❌ No auto-reload (uses workers)
- ✅ Optimized for performance
- ✅ Production-ready

**Never use `docker-compose.dev.yml` in production!**

## Logging

### View Backend Logs
```bash
# Follow logs in real-time
docker compose -f docker-compose.dev.yml logs -f backend

# View last 100 lines
docker compose -f docker-compose.dev.yml logs --tail=100 backend
```

### Reload Events
When a file changes, you'll see:
```
INFO:     Detected file change in 'app/api/v1/users.py'. Reloading...
INFO:     Application startup complete.
```

### WebSocket Connections
WebSocket connect/disconnect events are logged (connection acceptance logs are filtered per application settings).

## Troubleshooting

### Changes Not Reflecting

1. **Check bind mount:**
   ```bash
   docker compose -f docker-compose.dev.yml exec backend ls -la /app/backend
   ```
   Should show your files.

2. **Check DEV_MODE:**
   ```bash
   docker compose -f docker-compose.dev.yml exec backend env | grep DEV_MODE
   ```
   Should show `DEV_MODE=true`.

3. **Check logs for errors:**
   ```bash
   docker compose -f docker-compose.dev.yml logs backend
   ```

### Container Won't Start

1. **Check if port 8000 is in use:**
   ```bash
   netstat -ano | findstr :8000  # Windows
   lsof -i :8000                 # Linux/Mac
   ```

2. **Rebuild from scratch:**
   ```bash
   docker compose -f docker-compose.dev.yml down
   docker compose -f docker-compose.dev.yml build --no-cache
   docker compose -f docker-compose.dev.yml up -d
   ```

### Slow Reload

- Ensure you're using `docker-compose.dev.yml` (not production compose)
- Check Docker Desktop resources (CPU/Memory)
- On Windows, ensure WSL2 backend is enabled for better performance

## Docker Compose Watch (Optional)

If your Docker version supports it, the `develop.watch` section in `docker-compose.dev.yml` provides additional file watching:

```yaml
develop:
  watch:
    - action: sync
      path: ../../backend
      target: /app/backend
    - action: rebuild
      path: ../../backend/requirements.txt
```

This is optional - uvicorn's `--reload` is sufficient for most cases.

## Data Persistence

The data directory is mounted as a volume:
```yaml
volumes:
  - ../../data:/app/data
```

This means:
- ✅ DuckDB databases persist between container restarts
- ✅ SQLite auth database persists
- ✅ Logs persist
- ✅ All data survives container recreation

## Best Practices

1. **Always use `docker-compose.dev.yml` for development**
2. **Never commit `.env` files with secrets**
3. **Rebuild only when dependencies change**
4. **Monitor logs during development**
5. **Use production compose for deployment**

## Summary

**For Development:**
```bash
docker compose -f docker-compose.dev.yml up
```

**For Production:**
```bash
docker compose -f docker-compose.yml up
```

**That's it!** Edit code → Save → Auto-reload → Test → Repeat. 🚀

