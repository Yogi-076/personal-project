@echo off
echo ========================================
echo   VAPT FRAMEWORK - COMPLETE SCANNER
echo   WITH LIVE TERMINAL OUTPUT
echo ========================================
echo.

echo [1/3] Killing any existing Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

echo.
echo [2/3] Starting Backend API Server...
cd /d "%~dp0server"
start "VAPT Backend" cmd /k "echo VAPT Backend Server && node index.js"
timeout /t 3 >nul

echo.
echo [3/3] Starting Frontend Server...
cd /d "%~dp0"
start "VAPT Frontend" cmd /k "echo VAPT Frontend Server && npm run dev"
timeout /t 3 >nul

echo.
echo ========================================
echo   SERVERS STARTED!
echo ========================================
echo.
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:8080
echo.
echo   Open your browser to:
echo   http://localhost:8080/scanner
echo.
echo   The scanner will show:
echo   ✓ Live terminal output
echo   ✓ Real-time Wapiti execution
echo   ✓ Progress updates
echo   ✓ Professional vulnerability reports
echo.
echo ========================================
pause
