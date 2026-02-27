@echo off
echo ========================================
echo Starting Pluto AI (Moltbot) Backend
echo ========================================
echo.

:: Ensure we are in the moltbot directory
:: Ensure we are in the moltbot directory
cd /d "%~dp0moltbot"

echo Current directory: %CD%
echo.

if not exist "node_modules" (
    echo Installing Moltbot dependencies...
    echo This may take a few minutes...
    call npm install
)

:: Explicitly set State Directory to local data folder to avoid confusion
set "MOLTBOT_STATE_DIR=%~dp0moltbot_data"
echo Using State Directory: %MOLTBOT_STATE_DIR%

echo Starting Moltbot Gateway on port 18789...
echo.

:: Set Google API Key for Strix
set "GEMINI_API_KEY=AIzaSyCQLk19t0hthmA7t-ZKBA9E-_TPR1wVTks"

:: Run Moltbot with required flags and Node options
:: Launch the Persistent Agent (in background/new window) to handle "main" session
echo Starting Agent Process (Session: main)...
start "Moltbot_Agent_Main" cmd /c "node scripts/run-node.mjs agent --json --mode rpc --agent main"

:: Run Moltbot Gateway
node scripts/run-node.mjs gateway --port 18789 --allow-unconfigured --token moltbot
