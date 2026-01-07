@echo off
REM Rubik Analytics - Docker Start Script (Windows)
REM Starts all services using Docker Compose

setlocal enabledelayedexpansion

cd /d "%~dp0"

echo ===========================================
echo   Rubik Analytics - Docker Start
echo ===========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    pause
    exit /b 1
)

REM Check if docker-compose is available
docker-compose version >nul 2>&1
if %errorlevel% equ 0 (
    set COMPOSE_CMD=docker-compose
) else (
    docker compose version >nul 2>&1
    if %errorlevel% equ 0 (
        set COMPOSE_CMD=docker compose
    ) else (
        echo [ERROR] docker-compose is not installed. Please install Docker Desktop.
        pause
        exit /b 1
    )
)

REM Check if .env file exists
if not exist .env (
    echo [INFO] .env file not found. Creating from .env.example...
    if exist .env.example (
        copy .env.example .env >nul
        echo [WARNING] Please edit .env file with your configuration before starting!
        echo [WARNING] Especially update JWT_SECRET_KEY, JWT_SYSTEM_SECRET_KEY, and ENCRYPTION_KEY
        pause
    )
)

echo [INFO] Building and starting services...
%COMPOSE_CMD% up -d --build

if %errorlevel% neq 0 (
    echo [ERROR] Failed to start services
    pause
    exit /b 1
)

echo.
echo ===========================================
echo   Services Started
echo ===========================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo API Docs: http://localhost:8000/docs
echo.
echo To view logs: %COMPOSE_CMD% logs -f
echo To stop:      %COMPOSE_CMD% down
echo.
pause

