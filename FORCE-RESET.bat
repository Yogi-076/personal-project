@echo off
echo [!] STOPPING ALL NODE.JS PROCESSES...
taskkill /F /IM node.exe

echo [!] CHECKING FOR STRAY PORTS (3001)...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3001" ^| find "LISTENING"') do taskkill /f /pid %%a

echo [*] CLEANUP COMPLETE. STARTING SERVER...
npm run dev
pause
