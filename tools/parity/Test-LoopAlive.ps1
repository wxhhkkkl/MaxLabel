# 循环活性判定：ALIVE（在干活）/ WEDGED（卡死）/ STOPPED（已停）/ IDLE（批次间隙）
# 用法：powershell -File tools/parity/Test-LoopAlive.ps1
$ErrorActionPreference = 'Continue'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $Repo
$me = $PID

$st = Get-Content tools\loop\state.json -Raw | ConvertFrom-Json
$agentProcs = @(Get-Process claude,codex -ErrorAction SilentlyContinue)
$sup = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessId -ne $me -and $_.CommandLine -and $_.CommandLine -match 'Start-Loop' -and $_.CommandLine -notmatch 'Get-CimInstance|Test-LoopAlive' })
$drv = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessId -ne $me -and $_.CommandLine -and $_.CommandLine -match 'Run-ParityLoop' -and $_.CommandLine -notmatch 'Get-CimInstance|Test-LoopAlive' })
$gateProcs = @(Get-Process node,electron -ErrorAction SilentlyContinue)

# 最近写入时间（状态/日志/仓库）
$newest = (Get-ChildItem tools\loop\state.json, tools\loop\logs, parity, app\src, app\scripts -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch 'node_modules' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
$idleMin = if ($newest) { [int]((Get-Date) - $newest.LastWriteTime).TotalMinutes } else { 999 }

$verdict = 'ALIVE'
$why = @()
if (Test-Path tools\loop\HALT) { $verdict = 'STOPPED'; $why += 'HALT 存在' }
elseif (-not $sup -and -not $drv) { $verdict = 'STOPPED'; $why += '监管器与驱动器都不在' }
elseif ($agentProcs.Count -gt 0) { $why += "agent 进程在跑（$($agentProcs[0].ProcessName) pid=$($agentProcs[0].Id)）" }
elseif ($gateProcs.Count -gt 0) { $why += "门禁阶段：node/electron 进程 $($gateProcs.Count) 个在跑" }
elseif ($idleMin -ge 15) { $verdict = 'WEDGED'; $why += "无 agent、无门禁进程，且 $idleMin 分钟无任何写入" }
else { $verdict = 'IDLE'; $why += "批次间隙/落账中（最后写入 $idleMin 分钟前）" }

"判定: $verdict"
"依据: $($why -join '；')"
"轮次: round $($st.round)   停止原因: '$($st.stopReason)'"
"监管器: $(if ($sup) { $sup[0].ProcessId } else { '无' })   驱动器: $(if ($drv) { $drv[0].ProcessId } else { '无' })"
"agent 进程: $(if ($agentProcs) { ($agentProcs | ForEach-Object { "$($_.ProcessName)#$($_.Id)" }) -join ', ' } else { '无' })"
"门禁进程: $(if ($gateProcs) { ($gateProcs | Group-Object ProcessName | ForEach-Object { "$($_.Name)×$($_.Count)" }) -join ', ' } else { '无' })"
"最后写入: $($newest.FullName.Substring($Repo.Length+1)) @ $($newest.LastWriteTime.ToString('HH:mm:ss'))（$idleMin 分钟前）"
"现在: $(Get-Date -Format 'HH:mm:ss')"
if ($verdict -eq 'WEDGED') {
  ''
  '处置建议：终止监管器与驱动器 → 提交台账 → 重启监管器（进度不丢，每轮都有自动提交）'
  '  Stop-Process -Id <驱动器PID>,<监管器PID> -Force'
  '  cd D:\workspace\maxlabel; & tools\loop\Start-Loop.ps1 -Agent claude -BatchRounds 12 -MaxTotalRounds 80'
}
