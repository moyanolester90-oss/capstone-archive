@echo off
cd /d "%~dp0"
title Capstone Archive - Database Viewer (Drizzle Studio)
echo Opening Drizzle Studio... your browser will open https://local.drizzle.studio
echo (needs an internet connection; close this window to stop it)
echo.
echo Offline alternative: phpMyAdmin at http://localhost/phpmyadmin (start Apache in XAMPP)
echo.
start "" https://local.drizzle.studio
npx drizzle-kit studio
pause
