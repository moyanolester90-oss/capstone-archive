@echo off
cd /d "%~dp0"
title Capstone Archive - Fix and Restart

echo ============================================================
echo  Capstone Archive - fixing the Login page crash and restarting
echo ============================================================
echo.
echo Stopping any server currently using port 8080...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8080 ^| findstr LISTENING') do (
  echo   Stopping process %%a
  taskkill /F /PID %%a >nul 2>&1
)

echo.
echo Clearing the stale Vite dependency cache...
if exist node_modules\.vite (
  rmdir /s /q node_modules\.vite
  echo   Cache cleared.
) else (
  echo   No cache folder found, nothing to clear.
)

echo.
echo Starting the server fresh (this window will show the live log)...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run dev 2>&1 | Tee-Object -FilePath server.log"
pause
