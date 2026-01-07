@echo off
echo ========================================
echo Rebuilding Production Docker Containers
echo ========================================
echo.

cd /d "%~dp0"

echo Stopping production containers...
docker-compose down

echo.
echo Rebuilding production images with latest code...
docker-compose build --no-cache

echo.
echo Starting production containers...
docker-compose up -d

echo.
echo ========================================
echo Production containers rebuilt!
echo ========================================
echo.
docker-compose ps

pause

