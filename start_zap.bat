@echo off
echo Starting OWASP ZAP on port 8090...
cd /d "C:\Program Files\ZAP\Zed Attack Proxy"
zap.bat -daemon -port 8090 -config api.disablekey=true
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Could not start ZAP. Please ensure 'zap.bat' is in your PATH.
    echo You may need to add the ZAP installation directory to your System PATH manually.
    pause
)
