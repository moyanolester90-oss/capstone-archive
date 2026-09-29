@echo off
cd /d "%~dp0"
title Capstone Archive - Database Setup
echo ============================================================
echo  Capstone Archive - MySQL database setup (Drizzle ORM)
echo  Make sure MySQL is STARTED in the XAMPP Control Panel first.
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "npx tsx server/scripts/setupDatabase.ts 2>&1 | Tee-Object -FilePath database-setup.log"
echo.
echo Results saved to database-setup.log
pause
