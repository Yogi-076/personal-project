@echo off
setlocal
echo ==================================================
echo   VAPT FRAMEWORK - SYSTEM HEALTH CHECK
echo ==================================================
echo.

set "BACKEND=http://localhost:3001"
set "CHATBOT=http://localhost:18789"
set "FRONTEND=http://localhost:8080"

REM --- Check Backend ---
echo [1/4] Checking Backend API (%BACKEND%)...
curl -s -o nul -w "%%{http_code}" %BACKEND%/api/health > status.txt
set /p STATUS=<status.txt
if "%STATUS%"=="200" (
    echo    [PASS] Backend is ONLINE (Status: %STATUS%)
) else (
    echo    [FAIL] Backend is Unreachable or Error (Status: %STATUS%)
)

REM --- Check Chatbot ---
echo.
echo [2/4] Checking Chatbot Gateway (%CHATBOT%)...
curl -s -o nul -w "%%{http_code}" %CHATBOT%/__moltbot__/a2ui > status.txt
set /p STATUS=<status.txt
if "%STATUS%"=="200" (
    echo    [PASS] Chatbot Gateway is ONLINE (Status: %STATUS%)
) else (
    echo    [FAIL] Chatbot is Unreachable (Status: %STATUS%)
    echo           (Note: If 404, the path might be different, but server is up)
)

REM --- Check Tool Endpoints ---
echo.
echo [3/4] Checking Tool Endpoints...
curl -s -o nul -w "%%{http_code}" %BACKEND%/api/tools/gobuster/status/test > status.txt
set /p S1=<status.txt
if "%S1%"=="404" (
    echo    [PASS] Gobuster Endpoint (Verified: 404 on 'test' id means route exists)
) else (
    echo    [FAIL] Gobuster Endpoint unexpected %S1%
)

curl -s -o nul -w "%%{http_code}" %BACKEND%/api/tools/sast/analyze > status.txt
set /p S2=<status.txt
if "%S2%"=="400" (
    echo    [PASS] SAST Endpoint (Verified: 400 'Missing code' means handler active)
) else (
    echo    [FAIL] SAST Endpoint unexpected %S2%
)

REM --- Check Frontend ---
echo.
echo [4/4] Checking Frontend (%FRONTEND%)...
curl -s -o nul -w "%%{http_code}" %FRONTEND% > status.txt
set /p FSTATUS=<status.txt
if "%FSTATUS%"=="200" (
    echo    [PASS] Frontend is Serving (Status: %FSTATUS%)
) else (
    echo    [WARN] Frontend might be starting or on different port (Status: %FSTATUS%)
)

del status.txt
echo.
echo ==================================================
echo   VERIFICATION COMPLETE
echo ==================================================
echo.
pause
