<#
  循环自愈看门狗（round-155 新增）—— 解决"没人看着就整夜空转"的问题。

  背景（真实事故）：2026-09-22 20:21，额度监管器因为一个 bug（把"批次正常结束"当成异常重启）永久停机，
  并留下一句"请人工检查"就退出了 ✗；而那一夜没有人运行（目标被暂停），于是 **13 小时零推进、codex/claude 一次都没调用** ✗。

  本脚本每 5 分钟自检一次：
    - 有 `tools/loop/STOP`（人工暂停）→ 什么都不做 ✓（尊重人工意图）
    - 额度监管器（Start-Loop-Auto.ps1）在跑 → 正常 ✓
    - 监管器不在 → 立刻按 codex 优先重新拉起 ✓，并写日志 ✓
  用法（后台常驻）：
    Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',
      'D:\workspace\maxlabel\tools\loop\Ensure-Loop.ps1' -WindowStyle Hidden
#>
[CmdletBinding()]
param(
  [string]$Repo = 'D:\workspace\maxlabel',
  [int]$IntervalSeconds = 300,
  [switch]$Once
)

$ErrorActionPreference = 'Continue'
$loopDir = Join-Path $Repo 'tools\loop'
$logDir = Join-Path $loopDir 'logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("ensure-loop-{0}.log" -f (Get-Date -Format 'yyyyMMdd'))

function Log($m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m
  Add-Content -LiteralPath $log -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-Switcher {
  @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match 'Start-Loop-Auto\.ps1') })
}

# 心跳判定：监管器每轮都会刷新 %TEMP%\maxlabel-loop-auto\switcher-heartbeat.txt。
# 这比查进程稳 —— 实测在**计划任务/非交互**上下文里 WMI 会偶发返回空 ✗，看门狗误判并重复拉起（出现过两个监管器并存 ✗）。
function Test-SwitcherAlive {
  $hb = Join-Path $env:TEMP 'maxlabel-loop-auto\switcher-heartbeat.txt'
  if (Test-Path -LiteralPath $hb) {
    $age = (Get-Date) - (Get-Item -LiteralPath $hb).LastWriteTime
    if ($age.TotalMinutes -lt 10) { return $true }
  } else {
    return $null   # 没有心跳文件（旧版本监管器）→ 交给进程查询兜底
  }
  # round-200 双保险：心跳可能因为"监管器正在等一个很长的轮次"而变旧 ✓ ——
  #   只要**监管器进程**还在、或**循环进程（supervisor/driver）**还在跑 ✓，就认为有人看着 ✓，**绝不要**再拉起一个 ✗✗。
  if ((Get-Switcher).Count -gt 0) { return $true }
  $loop = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match 'Run-ParityLoop|Start-Loop\.ps1') })
  if ($loop.Count -gt 0) { return $true }
  return $false
}

Log "自愈看门狗启动：每 $IntervalSeconds 秒自检一次；仓库=$Repo"
while ($true) {
  if (Test-Path -LiteralPath (Join-Path $loopDir 'STOP')) {
    Log '发现 STOP（人工暂停中）→ 不干预'
  } else {
    $alive = Test-SwitcherAlive
    if ($alive -eq $true) {
      Log '心跳新鲜（<10 分钟）→ 监管器在跑 ✓'
    } elseif ($alive -eq $false) {
      Log '心跳过期（≥10 分钟）→ 监管器已停，拉起（codex 优先）'
      $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $loopDir 'Start-Loop-Auto.ps1'),
        '-BatchRounds', '12', '-MaxTotalRounds', '240', '-StartAgent', 'codex', '-Repo', $Repo)
      Start-Process -FilePath 'powershell' -ArgumentList $args -WorkingDirectory $Repo -WindowStyle Hidden
      Start-Sleep -Seconds 15
      Log ("拉起结果：监管器进程数 {0}" -f (Get-Switcher).Count)
    } else {
      # 没有心跳文件（例如监管器是旧版本启动的）→ 退回进程查询，且**两次确认**，避免 WMI 偶发空结果导致重复拉起 ✗
      $sw = Get-Switcher
      if ($sw.Count -gt 0) {
        Log ("监管器在跑（pid {0}）✓（无心跳文件，用进程查询判定）" -f $sw[0].ProcessId)
      } else {
        Start-Sleep -Seconds 20
        $sw = Get-Switcher
        if ($sw.Count -gt 0) {
          Log ("复检发现监管器其实在跑（pid {0}）→ 不重复拉起" -f $sw[0].ProcessId)
        } else {
          Log '两次进程查询都没有监管器 → 拉起（codex 优先）'
          $args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $loopDir 'Start-Loop-Auto.ps1'),
            '-BatchRounds', '12', '-MaxTotalRounds', '240', '-StartAgent', 'codex', '-Repo', $Repo)
          Start-Process -FilePath 'powershell' -ArgumentList $args -WorkingDirectory $Repo -WindowStyle Hidden
          Start-Sleep -Seconds 15
          Log ("拉起结果：监管器进程数 {0}" -f (Get-Switcher).Count)
        }
      }
    }
  }
  if ($Once) { break }
  Start-Sleep -Seconds $IntervalSeconds
}
Log '自愈看门狗退出'
