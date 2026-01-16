@echo off
REM Open Analytics - Stop All Servers
REM Stops both backend and frontend servers cleanly

setlocal enabledelayedexpansion

cd /d "%~dp0\..\.."

echo ========================================
echo Open Analytics - Stopping All Servers
echo ========================================
echo.

REM Stop backend (port 8000)
echo [INFO] Stopping backend server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000') do (
    set "PORT_PID=%%a"
        if not "!PORT_PID!"=="" (
            echo [INFO] Attempting graceful stop for PID !PORT_PID!...
            taskkill /PID !PORT_PID! >nul 2>&1
            ping 127.0.0.1 -n 3 >nul
            taskkill /PID !PORT_PID! /F >nul 2>&1
        )
)

REM Stop frontend (port 3000)
echo [INFO] Stopping frontend server...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    set "PORT_PID=%%a"
        if not "!PORT_PID!"=="" (
            echo [INFO] Attempting graceful stop for PID !PORT_PID!...
            taskkill /PID !PORT_PID! >nul 2>&1
            ping 127.0.0.1 -n 3 >nul
            taskkill /PID !PORT_PID! /F >nul 2>&1
        )
)

REM Kill any Python processes that might be locking database files
echo [INFO] Checking for processes locking database files...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq python.exe" /FO LIST 2^>nul ^| findstr "PID"') do (
    set PID_VAL=%%a
    set PID_VAL=!PID_VAL: =!
    if not "!PID_VAL!"=="" (
        taskkill /PID !PID_VAL! /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Killed Python process (PID: !PID_VAL!)
        )
    )
)
ping 127.0.0.1 -n 2 >nul

REM Kill any Node processes
echo [INFO] Checking for Node processes...
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST 2^>nul ^| findstr "PID"') do (
    set PID_VAL=%%a
    set PID_VAL=!PID_VAL: =!
    if not "!PID_VAL!"=="" (
        taskkill /PID !PID_VAL! /F >nul 2>&1
        if !errorlevel! equ 0 (
            echo [OK] Killed Node process (PID: !PID_VAL!)
        )
    )
)
ping 127.0.0.1 -n 2 >nul

REM Verify ports are free
echo.
echo [INFO] Verifying ports are free...
netstat -ano | findstr :8000 >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Port 8000 may still be in use
) else (
    echo [OK] Port 8000 is free
)

netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Port 3000 may still be in use
) else (
    echo [OK] Port 3000 is free
)

REM Proactive cleanup of WAL files is REMOVED as it causes data loss on forceful DuckDB shutdown.
REM del /s /q "data\*.wal" >nul 2>&1
echo [OK] Stopped cleanly.

echo.
echo ========================================
echo All servers stopped
echo ========================================
echo.
