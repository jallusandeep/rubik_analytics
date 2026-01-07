@echo off
REM Rubik Analytics - Docker Stop Script (Windows)
REM Stops all services

setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ===========================================
echo   Rubik Analytics - Docker Stop
echo ===========================================
echo.

REM Check if docker-compose is available
docker-compose version >nul 2>&1
if %errorlevel% equ 0 (
    set COMPOSE_CMD=docker-compose
) else (
    docker compose version >nul 2>&1
    if %errorlevel% equ 0 (
        set COMPOSE_CMD=docker compose
    ) else (
        echo [ERROR] docker-compose is not installed.
        pause
        exit /b 1
    )
)

echo [INFO] Stopping services...
%COMPOSE_CMD% down

echo.
echo [OK] All services stopped
echo.
pause

