@echo off
cd /d "%~dp0"
title Capstone Archive - System Check
echo Running type check and automated tests... please wait.
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { \"=== TYPE CHECK ===\"; npx tsc --noEmit 2>&1; \"TYPECHECK EXIT: $LASTEXITCODE\"; \"=== TESTS ===\"; npx vitest run 2>&1; \"TESTS EXIT: $LASTEXITCODE\" } | Tee-Object -FilePath check.log"
echo.
echo Done. Results saved to check.log
timeout /t 5
