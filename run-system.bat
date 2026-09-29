@echo off
cd /d "%~dp0"
title Capstone Archive Server
powershell -NoProfile -ExecutionPolicy Bypass -Command "npm run dev 2>&1 | Tee-Object -FilePath server.log"
pause
