@echo off
echo ========================================
echo VAPT Framework Diagnostic Tool
echo ========================================
echo.
echo [1] Checking Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js is NOT installed!
    goto :end
) else (
    echo OK.
)

echo.
echo [2] Checking Python...
python --version
if %errorlevel% neq 0 (
    echo ERROR: Python is NOT installed! Wapiti needs Python.
) else (
    echo OK.
)

echo.
echo [3] Checking Wapiti (Direct Command)...
call wapiti --version
if %errorlevel% neq 0 (
    echo WARNING: 'wapiti' command not found in PATH.
) else (
    echo OK.
)

echo.
echo [4] Checking Wapiti (Python Module)...
python -m wapiti --version
if %errorlevel% neq 0 (
    echo ERROR: 'python -m wapiti' failed. 
    echo Please run: pip install wapiti3
) else (
    echo OK. Fallback execution will work.
)

echo.
echo [5] Checking Ports...
netstat -an | find "3001" >nul
if %errorlevel% equ 0 (
    echo Port 3001 (Backend) is LISTENING (Good).
) else (
    echo Port 3001 is FREE (Server not running).
)

netstat -an | find "8080" >nul
if %errorlevel% equ 0 (
    echo Port 8080 (Frontend) is LISTENING (Good).
) else (
    echo Port 8080 is FREE (Server not running).
)

:end
echo.
echo ========================================
echo Diagnostic Complete.
echo If both servers are running but Scanner fails:
echo 1. Close all terminals
echo 2. Run START-ALL.bat
echo ========================================
pause
