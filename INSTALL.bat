@echo off
echo ================================================
echo VAPT Framework - Complete Setup and Installation
echo ================================================
echo.

echo Step 1: Installing Backend Dependencies...
cd /d "%~dp0server"
call npm install express cors body-parser uuid
if %errorlevel% neq 0 (
    echo ERROR: Failed to install backend dependencies
    echo.
    echo Try running this command manually:
    echo   cd server
    echo   npm install
    pause
    exit /b 1
)


echo.
echo Step 1.5: Installing Pluto AI (Moltbot) Dependencies...
cd /d "%~dp0..\moltbot"
if exist "package.json" (
    call npm install
    if %errorlevel% neq 0 (
        echo WARNING: Failed to install Moltbot dependencies. AI features might fail.
    )
) else (
    echo WARNING: Moltbot directory not found at ../moltbot
)

echo.
echo Step 2: Checking for Wapiti installation...
where wapiti >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ========================================
    echo WARNING: Wapiti is not installed!
    echo ========================================
    echo.
    echo The scanner will work in DEMO MODE (mock data).
    echo.
    echo To enable REAL vulnerability scanning:
    echo 1. Install Python 3
    echo 2. Run: pip install wapiti3
    echo 3. Restart this script
    echo.
    echo Press any key to continue with demo mode...
    pause >nul
) else (
    echo ✓ Wapiti is installed and ready!
)

echo.
echo Step 3: Installing Frontend Dependencies...
cd /d "%~dp0"
if not exist "node_modules" (
    call npm install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install frontend dependencies
        pause
        exit /b 1
    )
)

echo.
echo ================================================
echo Installation Complete!
echo ================================================
echo.
echo To start the scanner:
echo   1. Run: start-backend.bat  (in one terminal)
echo   2. Run: start-frontend.bat (in another terminal)
echo   3. Open: http://localhost:8080/scanner
echo.
echo Or simply run: START-ALL.bat
echo.
pause
