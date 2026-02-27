@echo off
echo ========================================================
echo      AUTO-CONNECT TO GITHUB
echo ========================================================
echo.
echo I cannot log into your account for you (Security Rules).
echo But I can do everything else!
echo.
echo [STEP 1] Go here and click "Create repository":
echo          https://github.com/new
echo.
echo [STEP 2] Copy the URL they give you (ending in .git)
echo.
set /p REPO_URL="[STEP 3] Paste that URL here: "

echo.
echo connecting...
git remote add origin %REPO_URL%
git branch -M main
git push -u origin main

echo.
echo ========================================================
echo DONE! check for errors above.
echo ========================================================
pause
