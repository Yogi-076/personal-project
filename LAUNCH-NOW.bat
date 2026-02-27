@echo off
echo ========================================
echo Launching VAPT Framework...
echo ========================================

echo 1. Stopping any existing servers...
taskkill /F /IM node.exe >nul 2>&1

echo 2. Starting Backend (Port 3001)...
start "VAPT Backend" cmd /k "cd server && node index.js"

echo 3. Starting Frontend (Port 8080)...
start "VAPT Frontend" cmd /k "cmd /c npm run dev"

echo.
echo ========================================
echo DONE!
echo Please open: http://localhost:8080/scanner
echo ========================================
timeout /t 5
