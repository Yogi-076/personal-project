@echo off
echo ========================================
echo VAPT Framework - PERMANENT FIX & START
echo ========================================
echo.
echo This script will:
echo 1. Stop all stuck VAPT processes
echo 2. SCRUB and Re-install frontend dependencies (Fixes blank page/build errors)
echo 3. Start all services fresh
echo.
echo NOTE: This may take a few minutes. Please be patient.
echo.
pause

echo.
echo [1/5] Stopping existing processes...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM python.exe /T >nul 2>&1
echo Done.
echo.

echo [2/5] Cleaning frontend dependencies (Nuclear Option)...
cd /d "%~dp0"
if exist "node_modules" (
    echo Removing node_modules...
    rmdir /s /q node_modules
)
if exist "package-lock.json" (
    echo Removing package-lock.json...
    del package-lock.json
)
echo.

echo [3/5] Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)
echo.

echo [4/5] Verifying Build...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed! The error is:
    call npx vite build
    pause
    exit /b 1
)
echo Build success!
echo.

echo [5/5] Starting All Servers...
echo Starting Backend...
start "VAPT Backend" cmd /k "%~dp0start-backend.bat"
timeout /t 5 >nul

echo Starting Pluto AI...
start "Pluto AI" cmd /k "%~dp0start-pluto.bat"
timeout /t 5 >nul

echo Starting Frontend...
start "VAPT Frontend" cmd /k "%~dp0start-frontend.bat"
echo.
echo ========================================
echo System Fixed and Started!
echo Please wait 30 seconds for everything to come online.
echo Frontend: http://localhost:8080/scanner
echo ========================================
pause
