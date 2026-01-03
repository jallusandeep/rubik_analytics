@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Rubik Analytics - View Dev Logs
echo ========================================
echo.

cd /d "%~dp0"

:: Detect Docker Compose Command
set DOCKER_CMD=

docker compose version >nul 2>&1
if !errorlevel! equ 0 (
    set DOCKER_CMD=docker compose
) else (
    docker-compose --version >nul 2>&1
    if !errorlevel! equ 0 (
        set DOCKER_CMD=docker-compose
    ) else (
        echo [ERROR] Docker Compose not found!
        pause
        exit /b 1
    )
)

echo [INFO] Showing backend logs (Press Ctrl+C to exit)...
echo.

%DOCKER_CMD% -f docker-compose.dev.yml logs -f backend

