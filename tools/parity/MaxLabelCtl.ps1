<#
.SYNOPSIS
  MaxLabel（复刻版）取证器：构建/启动 Electron + CDP 驱动截图。

.DESCRIPTION
  与真机取证器对称：真机用 LabelShopCtl.ps1（坐标/快捷键驱动），
  复刻版用本脚本（DOM 文本驱动），两边截图都进 parity/reference/，供视觉逐项对照。

.EXAMPLE
  powershell -File tools/parity/MaxLabelCtl.ps1 -Action capture
  powershell -File tools/parity/MaxLabelCtl.ps1 -Action run -Scenario tools/parity/scenarios/editor.json
#>
[CmdletBinding()]
param(
  [ValidateSet('capture', 'run', 'build', 'shot', 'close', 'start')]
  [string]$Action = 'capture',
  [string]$Scenario,
  [string]$OutDir,
  [string]$Repo = 'D:\workspace\maxlabel',
  [int]$WaitSeconds = 90,
  [int]$Port = 0,
  [switch]$KeepOpen,
  [switch]$NoBuild
)

$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path -LiteralPath $Repo).Path
$AppDir = Join-Path $Repo 'app'
$ScenDir = Join-Path $Repo 'tools\parity\scenarios'
if (-not $OutDir) { $OutDir = Join-Path $Repo 'parity\reference\maxlabel' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
if ($Port -eq 0) { $Port = Get-Random -Minimum 9410 -Maximum 9489 }

function Get-ElectronPath {
  $p = Join-Path $AppDir 'node_modules\electron\dist\electron.exe'
  if (-not (Test-Path -LiteralPath $p)) { throw "找不到 electron.exe：$p（先在 app 下 npm install）" }
  return $p
}

function Get-CdpPages {
  try {
    return (Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/list" -TimeoutSec 3)
  } catch { return $null }
}

function Start-MaxLabel {
  param([switch]$Force)
  $running = @(Get-Process -Name electron -ErrorAction SilentlyContinue)
  if ($running.Count -gt 0 -and $Force) {
    $running | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 600
  }
  if ($running.Count -gt 0 -and -not $Force) {
    $pages = Get-CdpPages
    if ($pages) { Write-Host '[start] 复用已运行的 MaxLabel'; return }
    $running | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  }
  if (-not (Test-Path -LiteralPath (Join-Path $AppDir 'out\main\index.js'))) {
    throw '缺少构建产物 app/out/main/index.js，先执行 -Action build'
  }
  $profile = Join-Path ([IO.Path]::GetTempPath()) ("maxlabel-parity-" + [guid]::NewGuid().ToString('N'))
  New-Item -ItemType Directory -Force -Path $profile | Out-Null
  $electron = Get-ElectronPath
  Write-Host "[start] electron 启动，CDP 端口 $Port"
  Start-Process -FilePath $electron -ArgumentList '.', "--remote-debugging-port=$Port", "--user-data-dir=$profile" -WorkingDirectory $AppDir -WindowStyle Hidden -PassThru | Out-Null
  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  while ((Get-Date) -lt $deadline) {
    $pages = Get-CdpPages
    if ($pages -and (@($pages | Where-Object { $_.type -eq 'page' }).Count -gt 0)) {
      Start-Sleep -Seconds 3
      Write-Host '[start] CDP 就绪'
      return
    }
    Start-Sleep -Milliseconds 800
  }
  throw "等待 MaxLabel CDP 就绪超时（${WaitSeconds}s）"
}

function Invoke-Scenario {
  param([string]$ScenarioPath)
  if (-not (Test-Path -LiteralPath $ScenarioPath)) { throw "缺少步骤脚本：$ScenarioPath" }
  $env:MAXLABEL_DEBUG_PORT = "$Port"
  Write-Host "[cdp] 执行步骤脚本 $ScenarioPath"
  $out = & node (Join-Path $Repo 'tools\parity\maxlabel-cdp.cjs') $ScenarioPath $OutDir 2>&1 | Out-String
  Write-Host $out
  Remove-Item Env:MAXLABEL_DEBUG_PORT -ErrorAction SilentlyContinue
}

switch ($Action) {
  'build' {
    Write-Host '[build] npm run build'
    & cmd /c "cd /d `"$AppDir`" && npm run build 2>&1" | Select-Object -Last 15
    if ($LASTEXITCODE -ne 0) { throw "构建失败 exit=$LASTEXITCODE" }
  }
  'start' { Start-MaxLabel -Force }
  'close' {
    Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host '[close] 已关闭 electron'
  }
  'capture' {
    if (-not $NoBuild) { & $PSCommandPath -Action build }
    Start-MaxLabel -Force
    Invoke-Scenario -ScenarioPath (Join-Path $ScenDir 'main.json')
    if (-not $KeepOpen) { Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue }
  }
  'run' {
    if (-not $NoBuild) { & $PSCommandPath -Action build }
    Start-MaxLabel -Force
    $scen = if ($Scenario) { $Scenario } else { Join-Path $ScenDir 'main.json' }
    Invoke-Scenario -ScenarioPath $scen
    if (-not $KeepOpen) { Get-Process -Name electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue }
  }
  'shot' {
    Start-MaxLabel
    Invoke-Scenario -ScenarioPath (Join-Path $ScenDir 'shot-only.json')
  }
}
