@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0app"

echo ============================================
echo   MaxLabel 一键启动
echo ============================================
echo   默认：开发模式（最新代码）
echo   打包版：start-maxlabel.bat packaged
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 Node.js。请先安装 Node.js 22 或更高版本。
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [错误] 未找到 npm。请重新安装 Node.js（含 npm）。
  pause
  exit /b 1
)

if /I "%~1"=="packaged" goto packaged

if not exist "node_modules" (
  echo [1/2] 首次运行，安装依赖（可能需要几分钟）...
  call npm install
  if errorlevel 1 goto failed
)

echo [2/2] 启动开发模式（热更新，使用当前工作区代码）...
set "ELECTRON_RUN_AS_NODE="
call npm run dev
if errorlevel 1 goto failed
goto end

:packaged
if not exist "release\win-unpacked\MaxLabel.exe" (
  echo [错误] 未找到 release\win-unpacked\MaxLabel.exe
  echo 请先构建并打包，或直接双击本脚本使用默认开发模式。
  pause
  exit /b 1
)
echo 启动已打包版本...
start "" "release\win-unpacked\MaxLabel.exe"
goto end

:failed
echo.
echo [失败] 启动失败，请查看上面的错误信息。
pause
exit /b 1

:end
endlocal
