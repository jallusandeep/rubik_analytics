@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Fix Encryption Key - Recreate Containers
echo ========================================
echo.
echo This will recreate containers to pick up the new encryption key.
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

echo [INFO] Stopping and removing containers...
%DOCKER_CMD% -f docker-compose.dev.yml down

echo.
echo [INFO] Recreating containers with new encryption key...
%DOCKER_CMD% -f docker-compose.dev.yml up -d --force-recreate

if !errorlevel! equ 0 (
    echo.
    echo [SUCCESS] Containers recreated with new encryption key.
    echo.
    echo [INFO] Waiting for services to start...
    timeout /t 5 /nobreak >nul
    echo.
    echo [INFO] Container status:
    %DOCKER_CMD% -f docker-compose.dev.yml ps
    echo.
    echo [NOTE] You may need to re-enter connection credentials
    echo        if they were encrypted with the old (invalid) key.
) else (
    echo.
    echo [ERROR] Failed to recreate containers.
)

echo.
pause

