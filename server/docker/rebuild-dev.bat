@echo off
echo ========================================
echo Rebuilding Development Docker Containers
echo ========================================
echo.

cd /d "%~dp0"

echo Stopping development containers...
docker-compose -f docker-compose.dev.yml down

echo.
echo Rebuilding development images with latest code...
docker-compose -f docker-compose.dev.yml build --no-cache

echo.
echo Starting development containers...
docker-compose -f docker-compose.dev.yml up -d

echo.
echo ========================================
echo Development containers rebuilt!
echo ========================================
echo.
docker-compose -f docker-compose.dev.yml ps

pause

