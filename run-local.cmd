@echo off
setlocal
cd /d "%~dp0"

echo Starting TeleMed database, synchronizing its configured password, then building and starting the application...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sync-db-password.ps1"
set "RESULT=%ERRORLEVEL%"

if not "%RESULT%"=="0" (
  echo.
  echo TeleMed startup failed. Read the error above.
  exit /b %RESULT%
)

echo.
echo TeleMed is ready. Frontend: http://localhost:8080
echo pgAdmin connection: 127.0.0.1:5433
exit /b 0
