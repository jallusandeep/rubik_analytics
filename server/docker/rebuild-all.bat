@echo off
echo ========================================
echo Rebuilding All Docker Containers
echo ========================================
echo.

echo Stopping production containers...
cd /d "%~dp0"
docker-compose down

echo Stopping development containers...
docker-compose -f docker-compose.dev.yml down

echo.
echo Rebuilding production images...
docker-compose build --no-cache

echo.
echo Rebuilding development images...
docker-compose -f docker-compose.dev.yml build --no-cache

echo.
echo Starting production containers...
docker-compose up -d

echo.
echo Starting development containers...
docker-compose -f docker-compose.dev.yml up -d

echo.
echo ========================================
echo Docker containers rebuilt and started!
echo ========================================
echo.
echo Production containers status:
docker-compose ps

echo.
echo Development containers status:
docker-compose -f docker-compose.dev.yml ps

pause

