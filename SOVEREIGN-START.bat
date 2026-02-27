@echo off
setlocal

TITLE Sovereign VAPT Framework - Grand Orchestrator
color 0a

echo ===============================================================================
echo   SOVEREIGN VAPT FRAMEWORK - GRAND ORCHESTRATOR
echo ===============================================================================
echo.
echo [1/3] Initializing Sovereign-VULN Intelligence Engine (Python)...
echo        - Port: 8000
echo        - Database: DuckDB (Vulnerability Cache)
echo.

start "Sovereign-VULN Engine" /min cmd /k "cd server/tools/sovereign-vuln && python main.py"

echo [2/3] Launching VAPT Core Services...
echo        - Backend: Node.js (Port 3001)
echo        - Frontend: Vite/React (Port 5173)
echo.

:: Check if node_modules exists, if not warn user
if not exist "node_modules" (
    echo [WARNING] node_modules not found. You may need to run 'npm install' first.
    pause
)

:: Run the standard dev script which handles backend/frontend concurrency
call npm run dev

endlocal
