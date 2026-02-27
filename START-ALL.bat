@echo off
echo ========================================
echo VAPT Framework Complete Startup
echo ========================================
echo.
echo This will start BOTH backend and frontend servers
echo.
echo Backend: http://localhost:3001
echo Frontend: http://localhost:8081/scanner
echo.
echo Press any key to continue...
pause >nul

echo.
echo Starting backend server in new window...
start "VAPT Backend" cmd /k "%~dp0start-backend.bat"

timeout /t 3 >nul

echo Starting Pluto AI server in new window...
start "Pluto AI" cmd /k "%~dp0start-pluto.bat"

timeout /t 3 >nul

echo Starting frontend server in new window...
start "VAPT Frontend" cmd /k "%~dp0start-frontend.bat"

echo.
echo ========================================
echo Both servers are starting...
echo.
echo Backend: Check the "VAPT Backend" window
echo Frontend: Check the "VAPT Frontend" window
echo.
echo Wait a few seconds, then navigate to:
echo http://localhost:8081/scanner
echo ========================================
echo.
pause
