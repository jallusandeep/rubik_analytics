# Quick Start - Docker Dev Mode

## Windows Batch Files (Easiest)

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

## Manual Commands

### Start Development Environment

```bash
cd server/docker
docker compose -f docker-compose.dev.yml up -d
```

### View Logs

```bash
docker compose -f docker-compose.dev.yml logs -f backend
```

### Stop Services

```bash
docker compose -f docker-compose.dev.yml down
```

### Rebuild (Only When Needed)

**When `requirements.txt` changes:**
```bash
docker compose -f docker-compose.dev.yml up -d --build
```

**Code-only changes:** Just save your file - auto-reload handles it!

## What Happens

1. ✅ Code changes sync instantly (bind mount)
2. ✅ Backend auto-reloads on `.py` file changes
3. ✅ No manual restart needed
4. ✅ Logs show reload events

## Full Documentation

See [README-DEV.md](./README-DEV.md) for complete documentation.

