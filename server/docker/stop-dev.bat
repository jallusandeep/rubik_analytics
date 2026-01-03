@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Rubik Analytics - Stop Docker Dev Mode
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

echo [INFO] Stopping dev containers...
%DOCKER_CMD% -f docker-compose.dev.yml down

if !errorlevel! equ 0 (
    echo.
    echo [SUCCESS] Dev containers stopped.
) else (
    echo.
    echo [WARNING] Some containers may not have stopped properly.
)

echo.
pause

