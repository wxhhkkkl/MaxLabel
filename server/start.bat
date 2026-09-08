@echo off
rem =====================================================
rem  MaxLabel Cloud Service - Windows startup script
rem  Usage: double-click start.bat, or run "start.bat"
rem  Dependencies are auto-installed on first run.
rem =====================================================
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  ============================================
echo    MaxLabel Cloud Service is starting...
echo  ============================================
echo.

rem ---- 1. Locate Python (common install paths, then py launcher / PATH) ----
set "PY="
if exist "C:\Python312\python.exe" set "PY=C:\Python312\python.exe"
if not defined PY if exist "C:\Python311\python.exe" set "PY=C:\Python311\python.exe"
if not defined PY if exist "C:\Python310\python.exe" set "PY=C:\Python310\python.exe"
if not defined PY if exist "C:\Python39\python.exe" set "PY=C:\Python39\python.exe"
if not defined PY (
  where py >nul 2>nul
  if %errorlevel%==0 set "PY=py -3"
)
if not defined PY (
  where python >nul 2>nul
  if %errorlevel%==0 set "PY=python"
)
if not defined PY (
  echo  [ERROR] Python not found. Install Python 3.10+ and check "Add Python to PATH".
  echo  Download: https://www.python.org/downloads/
  pause
  exit /b 1
)
echo  Using Python: %PY%

rem ---- 2. Check dependencies, install if missing ----
%PY% -c "import fastapi, uvicorn" >nul 2>nul
if errorlevel 1 (
  echo  [FIRST RUN] Installing dependencies...
  %PY% -m pip install -r requirements.txt
  if errorlevel 1 (
    echo  [ERROR] Dependency install failed. Check your network and retry.
    pause
    exit /b 1
  )
  echo  [OK] Dependencies installed.
)

rem ---- 3. Database mode hint ----
%PY% -c "from app import config; print('  DB mode: ' + ('MySQL ' + config.DB_HOST if config.DB_PASSWORD else 'SQLite (local) - set MAXLABEL_DB_PASSWORD in .env to use MySQL'))" 2>nul

rem ---- 4. Detect LAN IP for display ----
set "LANIP="
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -First 1 -ExpandProperty IPAddress)" 2^>nul') do set "LANIP=%%i"

rem ---- 4. Start service ----
echo.
echo  Server:   http://0.0.0.0:8420
echo  Local:    http://127.0.0.1:8420/   (this computer)
if defined LANIP echo  LAN:      http://%LANIP%:8420/   (clients + admin console on network)
echo  Press Ctrl+C to stop.
echo.
%PY% -m uvicorn app.main:app --host 0.0.0.0 --port 8420

pause
