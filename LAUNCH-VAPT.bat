@echo off
setlocal
cd /d "%~dp0"

title VAPT Framework Launcher

echo ===================================================
echo   VAPT SECURITY FRAMEWORK - PROFESSIONAL LAUNCHER
echo ===================================================
echo.
echo [1/5] Cleaning up existing processes...
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM python.exe /T >nul 2>&1
timeout /t 2 >nul

echo [2/5] Starting Backend Server (Port 3001)...
start "VAPT_Backend_3001" cmd /k "title VAPT Backend && call start-backend.bat"

echo [3/5] Starting Pluto AI Gateway (Port 18789)...
:: Ensure we call the dedicated AI launcher which handles its own env vars
start "VAPT_AI_Gateway" cmd /k "title VAPT AI Gateway && call start-pluto.bat"

echo [4/5] Starting Frontend Interface (Port 8080)...
:: Using dev:frontend to prevent backend duplication
start "VAPT_Frontend_Interface" cmd /k "title VAPT Frontend && npm run dev:frontend"

echo.
echo [5/5] Waiting for services to initialize...
timeout /t 12

echo ===================================================
echo   SYSTEM READY
echo   Local:   http://localhost:8080/scanner
echo   Network: http://192.168.0.121:8080/scanner
echo ===================================================
echo.
echo NOTE: If other laptops cannot connect, ensure port 3001
echo and 8080 are allowed in your Windows Firewall.
echo.
echo Opening Dashboard...
start http://localhost:8080/scanner

pause
