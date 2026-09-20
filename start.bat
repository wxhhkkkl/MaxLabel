@echo off
setlocal
title MaxLabel Dev Mode

cd /d "%~dp0app"

if exist "package.json" goto start
echo [ERROR] app\package.json was not found.
echo Please keep start.bat in the MaxLabel project root.
pause
exit /b 1

:start
echo Starting MaxLabel development mode...
call npm run dev

if not errorlevel 1 goto done
echo [ERROR] MaxLabel failed to start.
pause

:done
endlocal
