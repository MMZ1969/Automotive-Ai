@echo off
title AutoAI reports
rem Double-click to run the read-only AutoAI reports. Results go to
rem C:\automotive-ai\backend\reports\ for Claude to read. Nothing is changed in the database.
cd /d C:\automotive-ai\backend
if not exist reports mkdir reports
echo.
echo   Running AutoAI reports, about 30 seconds...
echo.
echo   [1/4] Activity report
call node activity-report.js > reports\activity_latest.txt 2>&1
echo   [2/4] Signup quality
call node signup-quality.js > reports\signup-quality-console.txt 2>&1
echo   [3/4] Reachable users
call node reachable-users.js > reports\reachable-users-console.txt 2>&1
echo   [4/4] Recent mechanics
call node check-mechanic.js --recent > reports\recent-mechanics.txt 2>&1
echo %date% %time% > reports\last-run.txt
echo.
echo   Done. Tell Claude: "reports done"
echo.
pause
