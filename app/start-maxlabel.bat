@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================
echo   MaxLabel launcher
echo ============================================
echo   Default: development mode (latest code)
echo   Packaged: start-maxlabel.bat packaged
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 22 or newer.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm not found. Reinstall Node.js with npm.
  pause
  exit /b 1
)

if /I "%~1"=="packaged" goto packaged

if not exist "node_modules" (
  echo [1/2] Installing dependencies. This may take a few minutes...
  call npm install
  if errorlevel 1 goto failed
)

echo [2/2] Starting development mode with the current workspace code...
set "ELECTRON_RUN_AS_NODE="
call npm run dev
if errorlevel 1 goto failed
goto end

:packaged
if not exist "release\win-unpacked\MaxLabel.exe" (
  echo [ERROR] release\win-unpacked\MaxLabel.exe not found.
  echo Build/package first, or run this script without arguments for dev mode.
  pause
  exit /b 1
)
echo Starting packaged build...
start "" "release\win-unpacked\MaxLabel.exe"
goto end

:failed
echo.
echo [FAILED] Startup failed. Check the error output above.
pause
exit /b 1

:end
endlocal
