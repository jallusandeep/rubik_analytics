@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Rubik Analytics - Start Docker Dev Mode
echo ========================================
echo.
echo This will start Docker with auto-reload enabled.
echo Code changes will automatically restart the backend.
echo.

cd /d "%~dp0"

:: -----------------------------------------------------------------------------
:: 1. Detect Docker Compose Command
:: -----------------------------------------------------------------------------
echo [INFO] Detecting Docker Compose version...
set DOCKER_CMD=

docker compose version >nul 2>&1
if !errorlevel! equ 0 (
    set DOCKER_CMD=docker compose
    echo [INFO] Using 'docker compose' ^(V2^)
) else (
    docker-compose --version >nul 2>&1
    if !errorlevel! equ 0 (
        set DOCKER_CMD=docker-compose
        echo [INFO] Using 'docker-compose' ^(V1^)
    ) else (
        echo [ERROR] Neither 'docker compose' nor 'docker-compose' found!
        echo Please allow Docker Desktop to finish starting or install Docker Compose.
        pause
        exit /b 1
    )
)

:: -----------------------------------------------------------------------------
:: 2. Stop Local Windows Servers (Port Conflicts)
:: -----------------------------------------------------------------------------
echo.
echo [INFO] Stopping existing local servers to free ports...
if exist ..\windows\stop-all.bat (
    call ..\windows\stop-all.bat >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: -----------------------------------------------------------------------------
:: 3. Check Docker Engine Status
:: -----------------------------------------------------------------------------
echo.
echo [INFO] Checking Docker Engine status...

set /a retries=0
:RETRY_LOOP
docker info >nul 2>&1
if %errorlevel% equ 0 goto DOCKER_READY

set /a retries+=1
if !retries! geq 5 (
    echo [ERROR] Docker Engine is NOT running!
    echo Please start Docker Desktop and wait for the engine to start.
    pause
    exit /b 1
)
echo [WAIT] Waiting for Docker to start... (Attempt !retries!/5)
timeout /t 5 /nobreak >nul
goto RETRY_LOOP

:DOCKER_READY
echo [OK] Docker is running.

:: -----------------------------------------------------------------------------
:: 4. Stop Existing Dev Containers
:: -----------------------------------------------------------------------------
echo.
echo [INFO] Stopping existing dev containers...
%DOCKER_CMD% -f docker-compose.dev.yml down >nul 2>&1

:: -----------------------------------------------------------------------------
:: 5. Start Dev Containers
:: -----------------------------------------------------------------------------
echo.
echo [INFO] Starting Docker containers in DEV MODE...
echo [INFO] Auto-reload is ENABLED - code changes will trigger automatic restart
echo.

echo [EXEC] %DOCKER_CMD% -f docker-compose.dev.yml up -d
%DOCKER_CMD% -f docker-compose.dev.yml up -d

if !errorlevel! neq 0 (
    echo.
    echo [ERROR] Docker failed to start. Check the output above for details.
    pause
    exit /b 1
)

:: -----------------------------------------------------------------------------
:: 6. Wait for Services to Start
:: -----------------------------------------------------------------------------
echo.
echo [INFO] Waiting for services to start...
timeout /t 5 /nobreak >nul

:: -----------------------------------------------------------------------------
:: 7. Show Container Status
:: -----------------------------------------------------------------------------
echo.
echo [INFO] Container status:
%DOCKER_CMD% -f docker-compose.dev.yml ps

:: -----------------------------------------------------------------------------
:: 8. Success
:: -----------------------------------------------------------------------------
echo.
echo ========================================
echo [SUCCESS] Docker Dev Mode Started!
echo ========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
echo.
echo ========================================
echo Auto-Reload Features:
echo ========================================
echo - Edit any .py file in backend/ folder
echo - Save the file
echo - Backend will automatically reload
echo - No manual restart needed!
echo.
echo ========================================
echo Useful Commands:
echo ========================================
echo View logs:     %DOCKER_CMD% -f docker-compose.dev.yml logs -f backend
echo Stop services: call stop-dev.bat
echo Rebuild:       %DOCKER_CMD% -f docker-compose.dev.yml up -d --build
echo.
echo ========================================
echo Opening logs window...
echo ========================================
echo.
timeout /t 2 /nobreak >nul

:: Open logs in a new window
start "Rubik Backend Dev Logs" cmd /k "%DOCKER_CMD% -f docker-compose.dev.yml logs -f backend"

pause

