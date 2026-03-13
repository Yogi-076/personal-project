@echo off
echo ========================================
echo VAPT Framework - Frontend Setup
echo ========================================
echo.

cd /d "%~dp0"

echo [1/2] Installing frontend dependencies (if needed)...
if not exist "node_modules" (
    call npm.cmd install
    if %errorlevel% neq 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
)

echo [2/2] Starting frontend development server...
echo.
echo ========================================
echo Frontend is starting...
echo Application will open at: http://localhost:8080
echo Navigate to: http://localhost:8080/scanner
echo Press Ctrl+C to stop the server
echo ========================================
echo.

call npm.cmd run dev:frontend
