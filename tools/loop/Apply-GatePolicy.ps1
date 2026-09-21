# 应用新的门禁策略：等现有循环优雅退出 → 删 STOP → 用新策略重启自动切换监管器。
#
#   powershell -File tools\loop\Apply-GatePolicy.ps1 -FullUiEveryN 10
#
# 背景（用户 2026-09-21 决定）：全量 UI 回归（79 脚本 ≈40-50 分钟）**每 10 轮跑一次**，
# 或者本轮动了 UI 相关文件（renderer / shared / ui-v*.cjs）时跑；其余轮次只跑快速门禁。
# 该策略实现在 `Run-ParityLoop.ps1` 的 `Resolve-GatePolicy`，本脚本只负责「让在跑的循环换上新脚本」：
#   1) 放 `tools/loop/STOP`（驱动器在**每轮开头**检查，所以会优雅跑完当前轮再退出）
#   2) 等 `Run-ParityLoop / Start-Loop / Start-Loop-Auto` 三类进程全部退出
#   3) 删 STOP，把最后一轮的独立门禁结论记进本脚本日志
#   4) 用 `Start-Process` **脱离会话**重启 `Start-Loop-Auto.ps1`（带 -FullUiEveryN）
[CmdletBinding()]
param(
  [string]$Repo = 'D:\workspace\maxlabel',
  [int]$FullUiEveryN = 10,
  [int]$BatchRounds = 12,
  [int]$MaxTotalRounds = 240,
  [int]$WaitExitMinutes = 100,
  [ValidateSet('codex', 'claude')][string]$StartAgent = 'codex'
)
$ErrorActionPreference = 'Continue'
$Repo = (Resolve-Path -LiteralPath $Repo).Path
$LoopDir = Join-Path $Repo 'tools\loop'
$LogDir = Join-Path $LoopDir 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$logPath = Join-Path $LogDir ("gate-policy-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))

function Log([string]$m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m
  Write-Host $line
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}
function Get-LoopProcs {
  @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match 'Run-ParityLoop\.ps1|Start-Loop\.ps1|Start-Loop-Auto\.ps1') })
}

$stopPath = Join-Path $LoopDir 'STOP'
Log "=== 应用门禁策略：每 $FullUiEveryN 轮一次全量 UI（或本轮改了 UI 相关文件 / 有 FORCE-UI 标记）==="
Set-Content -LiteralPath $stopPath -Value "验收方 $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') 应用新门禁策略：跑完当前轮请优雅退出，随后会带 -FullUiEveryN $FullUiEveryN 重启。" -Encoding UTF8
Log "已放 STOP；等待循环优雅退出（驱动器在每轮开头检查 STOP，最多等 $WaitExitMinutes 分钟）"

$deadline = (Get-Date).AddMinutes($WaitExitMinutes)
while ((Get-Date) -lt $deadline) {
  $procs = Get-LoopProcs
  if ($procs.Count -eq 0) { break }
  Log ("仍在运行 {0} 个：{1}" -f $procs.Count, (($procs | ForEach-Object { $_.ProcessId }) -join ','))
  Start-Sleep -Seconds 30
}
$left = Get-LoopProcs
if ($left.Count -gt 0) {
  Log ("超时仍有 {0} 个循环进程未退出（pid {1}）——不硬杀，保持 STOP，等人处理" -f $left.Count, (($left | ForEach-Object { $_.ProcessId }) -join ','))
  exit 3
}
Log '循环进程已全部退出'

# 记录最后一轮的独立门禁结论（证据留痕）
$g = Get-ChildItem $LogDir -File -Filter 'round-*-gates.md' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($g) {
  $hit = Select-String -Path $g.FullName -Pattern '结论[:：]\s*(.+)' -ErrorAction SilentlyContinue | Select-Object -First 1
  $conc = if ($hit -and $hit.Matches.Count -gt 0) { $hit.Matches[0].Groups[1].Value.Trim() } else { '（未找到结论行）' }
  Log ("最后一轮独立门禁：{0} → {1}" -f $g.BaseName, $conc)
}

Remove-Item -LiteralPath $stopPath -Force -ErrorAction SilentlyContinue
Log '已删 STOP'

$auto = Join-Path $LoopDir 'Start-Loop-Auto.ps1'
$args = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $auto,
  '-Repo', $Repo, '-BatchRounds', "$BatchRounds", '-MaxTotalRounds', "$MaxTotalRounds",
  '-FullUiEveryN', "$FullUiEveryN", '-StartAgent', $StartAgent)
$p = Start-Process -FilePath 'powershell' -ArgumentList $args -WorkingDirectory $Repo -WindowStyle Hidden -PassThru
Log ("已用新策略重启：Start-Loop-Auto.ps1（pid {0}，每 {1} 轮一次全量 UI，批 {2} 轮，上限 {3} 轮，agent {4}）" -f $p.Id, $FullUiEveryN, $BatchRounds, $MaxTotalRounds, $StartAgent)
Log '=== 完成 ==='
