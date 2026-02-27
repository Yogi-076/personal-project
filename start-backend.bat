@echo off
echo ========================================
echo VAPT Framework - Backend Server Setup
echo ========================================
echo.

cd /d "%~dp0server"

echo [1/3] Installing backend dependencies...
call npm.cmd install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [2/3] Checking Wapiti installation...
where wapiti >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: Wapiti not found in PATH
    echo Please install Wapiti: pip install wapiti3
    echo The scanner will use mock data until Wapiti is installed.
    echo.
)

echo [3/3] Starting backend server on port 3001...
echo.
echo ========================================
echo Backend server is starting...
echo API will be available at: http://localhost:3001
echo Press Ctrl+C to stop the server
echo ========================================
echo.

node index.js
