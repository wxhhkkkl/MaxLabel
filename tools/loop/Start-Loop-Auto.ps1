<#
.SYNOPSIS
  额度自动切换监管器：codex ↔ claude 自动接力。

.DESCRIPTION
  `Start-Loop.ps1` 一次只驱动一个 agent；额度耗尽时驱动器会放 `HALT` 并退出，需要人工换 agent 再起。
  本脚本把那一步自动化：

    - 发现「当前没有循环在跑」时，才用指定 agent 起 `Start-Loop.ps1`（**正在跑的循环不动**，等它自己退出后再接管）
    - 循环退出后读 `tools/loop/state.json` 的 `stopReason`：
        * 命中额度/限流 → 把该 agent 标记为「到下一个重置点（默认 14:00）前不可用」，删掉 `HALT`，
          换另一个 agent 接着跑；两个都受限就睡到重置点再继续（重置后优先 codex）
        * 有 `HALT` 但不是额度问题（秒退/工装故障等）→ **不自动重启**，写日志等人处理
        * 没有 `HALT`（正常跑到轮次上限）→ 自动用本脚本的上限继续（最多续 `-MaxNormalRestarts` 次）
    - 出现 `tools/loop/STOP` 文件 → 立即退出，什么都不删

  运行状态（当前 agent、两个 agent 各自的冷却截止时间）写在 `%TEMP%\maxlabel-loop-auto\agent.json`，
  **不往仓库里塞文件**（否则会污染驱动器「工作区是否干净」的零进展判定）。
  日志写在 `tools/loop/logs/auto-switch-<时间戳>.log`（该目录已在 .gitignore 里）。

.EXAMPLE
  # 后台长跑：codex 跑到没额度自动换 claude，14:00 重置后再换回 codex
  powershell -File tools\loop\Start-Loop-Auto.ps1 -BatchRounds 12 -MaxTotalRounds 240 -StartAgent codex

.EXAMPLE
  # 只看它现在会怎么做，不起任何进程
  powershell -File tools\loop\Start-Loop-Auto.ps1 -DryRun
#>
[CmdletBinding()]
param(
  [string]$Repo = 'D:\workspace\maxlabel',
  [int]$BatchRounds = 12,
  [int]$MaxTotalRounds = 240,
  [int]$FullUiEveryN = 10,
  [ValidateSet('codex', 'claude')][string]$StartAgent = 'codex',
  [int]$QuotaResetHour = 14,
  [int]$PollSeconds = 45,
  [int]$MaxNormalRestarts = 3,
  [switch]$DryRun
)

$ErrorActionPreference = 'Continue'
$Repo = (Resolve-Path -LiteralPath $Repo).Path
$LoopDir = Join-Path $Repo 'tools\loop'
$LogDir = Join-Path $LoopDir 'logs'
$StateDir = Join-Path $env:TEMP 'maxlabel-loop-auto'
$AgentStatePath = Join-Path $StateDir 'agent.json'
New-Item -ItemType Directory -Force -Path $LogDir, $StateDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logPath = Join-Path $LogDir "auto-switch-$stamp.log"

function Log([string]$m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m
  Write-Host $line
  Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}

function Get-LoopState {
  $p = Join-Path $LoopDir 'state.json'
  if (-not (Test-Path -LiteralPath $p)) { return $null }
  try { return (Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

function Get-AgentState {
  if (-not (Test-Path -LiteralPath $AgentStatePath)) { return $null }
  try { return (Get-Content -LiteralPath $AgentStatePath -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

function Save-AgentState($agent, $codexUntil, $claudeUntil) {
  $o = [pscustomobject]@{
    agent = $agent
    codexBlockedUntil = $codexUntil
    claudeBlockedUntil = $claudeUntil
    updatedAt = (Get-Date).ToString('s')
  }
  ($o | ConvertTo-Json -Compress) | Set-Content -LiteralPath $AgentStatePath -Encoding UTF8
}

function Get-RunningLoop {
  # 注意：不要匹配到本脚本自己（本脚本名是 Start-Loop-Auto.ps1，正则里带 \.ps1 不会命中）
  $hits = Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and ($_.CommandLine -match 'Run-ParityLoop\.ps1|Start-Loop\.ps1') }
  return @($hits)
}

function Get-NextReset {
  $now = Get-Date
  $t = Get-Date -Hour $QuotaResetHour -Minute 0 -Second 0
  if ($t -le $now) { $t = $t.AddDays(1) }
  return $t
}

function Parse-Time($s) {
  if (-not $s) { return $null }
  try { return [datetime]::Parse($s) } catch { return $null }
}

$quotaPattern = '额度|限流|quota|rate.?limit|usage limit|429'

# ---- 载入/初始化 agent 状态 ----
$agent = $StartAgent
$codexUntil = $null
$claudeUntil = $null
$prev = Get-AgentState
if ($prev) {
  if ($prev.agent) { $agent = [string]$prev.agent }
  $codexUntil = Parse-Time $prev.codexBlockedUntil
  $claudeUntil = Parse-Time $prev.claudeBlockedUntil
  Log "接续上次状态：agent=$agent，codex 冷却至=$codexUntil，claude 冷却至=$claudeUntil"
}

Log "额度自动切换监管器启动：批次 $BatchRounds 轮 / 总上限 $MaxTotalRounds 轮 / 起始 agent=$agent / 重置点=${QuotaResetHour}:00$(if ($DryRun) { '（DryRun：不起进程）' })"
Log "仓库：$Repo；日志：$logPath"

$normalRestarts = 0
while ($true) {
  if (Test-Path -LiteralPath (Join-Path $LoopDir 'STOP')) { Log '发现 STOP 文件，监管器退出（不删任何状态）'; break }

  $running = Get-RunningLoop
  if ($running.Count -gt 0) {
    Log ("已有循环在跑（pid {0}），{1} 秒后再看" -f ($running[0].ProcessId), $PollSeconds)
    if ($DryRun) { break }
    Start-Sleep -Seconds $PollSeconds
    continue
  }

  $st = Get-LoopState
  $round = 0
  if ($st -and $st.round) { $round = [int]$st.round }
  if ($round -ge $MaxTotalRounds) { Log "已达到总轮次上限（$round ≥ $MaxTotalRounds），监管器退出"; break }

  # ---- 选 agent：自己被冷却就换另一个；两个都冷却就睡到重置点 ----
  $now = Get-Date
  $mine = if ($agent -eq 'codex') { $codexUntil } else { $claudeUntil }
  if ($mine -and $mine -gt $now) {
    $other = if ($agent -eq 'codex') { 'claude' } else { 'codex' }
    $otherUntil = if ($other -eq 'codex') { $codexUntil } else { $claudeUntil }
    if ($otherUntil -and $otherUntil -gt $now) {
      $wake = if ($mine -lt $otherUntil) { $mine } else { $otherUntil }
      Log "两个 agent 都在冷却（$agent→$mine，$other→$otherUntil），睡到 $wake（${QuotaResetHour}:00 额度重置）"
      if ($DryRun) { break }
      while ((Get-Date) -lt $wake) {
        if (Test-Path -LiteralPath (Join-Path $LoopDir 'STOP')) { Log '睡眠期间发现 STOP，退出'; return }
        Start-Sleep -Seconds 60
      }
      # 重置点到了：清空冷却，重新以首选 agent 开始
      $codexUntil = $null; $claudeUntil = $null
      $agent = $StartAgent
      Save-AgentState $agent $codexUntil $claudeUntil
      Log "额度重置点已到，冷却清空，改用 $agent 继续"
    } else {
      Log "$agent 仍在冷却（至 $mine），换成 $other 继续"
      $agent = $other
    }
  }

  if ($DryRun) {
    Log "[DryRun] 会执行：Start-Loop.ps1 -BatchRounds $BatchRounds -MaxTotalRounds $MaxTotalRounds -Agent $agent（当前 round=$round）"
    break
  }

  Save-AgentState $agent $codexUntil $claudeUntil
  Log "=== 启动监管器：agent=$agent，当前 round=$round ==="
  $childArgs = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $LoopDir 'Start-Loop.ps1'),
    '-BatchRounds', "$BatchRounds", '-MaxTotalRounds', "$MaxTotalRounds", '-Agent', $agent, '-Repo', $Repo,
    '-FullUiEveryN', "$FullUiEveryN")
  $child = Start-Process -FilePath 'powershell' -ArgumentList $childArgs -WorkingDirectory $Repo -PassThru -NoNewWindow
  # ---- 主动切回首选 agent（round-95 修）：只在"监管器退出后"才判断是不够的 ----
  # 监管器一批 12 轮、可能连续跑几小时；若期间首选 agent（codex）的额度冷却到期（例如 14:00 重置），
  # 旧逻辑要等它自己跑完 12 轮才可能切回 → 用户会看到"codex 额度一直闲着"。
  # 所以这里改成轮询看护：**首选 agent 一旦可用，就放 STOP 让当前监管器在轮次边界优雅退出**，然后切回它。
  $switchDeadline = $null
  while (-not $child.HasExited) {
    Start-Sleep -Seconds 30
    if ($switchDeadline) {
      if ((Get-Date) -gt $switchDeadline) { Log '等待当前监管器退出超时（45 分钟），继续等它自己结束'; $switchDeadline = $null }
      continue
    }
    $prefUntil = if ($StartAgent -eq 'codex') { $codexUntil } else { $claudeUntil }
    $nowW = Get-Date
    $prefReady = ((-not $prefUntil) -or ($prefUntil -le $nowW))
    if ($agent -ne $StartAgent -and $prefReady) {
      Log "首选 agent（$StartAgent）额度已可用（冷却=$prefUntil）→ 放 STOP，等当前 $agent 监管器在轮次边界退出后切回"
      Set-Content -LiteralPath (Join-Path $LoopDir 'STOP') -Value "自动切回 $StartAgent（$(Get-Date -Format s)）" -Encoding UTF8
      $switchDeadline = (Get-Date).AddMinutes(45)
    }
  }
  $child.WaitForExit()
  Log "监管器退出：exit=$($child.ExitCode)"
  Start-Sleep -Seconds 5

  $st2 = Get-LoopState
  $reason = ''
  if ($st2 -and $st2.stopReason) { $reason = [string]$st2.stopReason }
  $haltPath = Join-Path $LoopDir 'HALT'
  $halt = Test-Path -LiteralPath $haltPath
  $roundNow = 0
  if ($st2 -and $st2.round) { $roundNow = [int]$st2.round }
  Log "状态：round=$roundNow，HALT=$halt，stopReason=$reason"

  $isQuota = $false
  if ($reason -match $quotaPattern) { $isQuota = $true }
  if (-not $isQuota -and $halt) {
    $haltText = Get-Content -LiteralPath $haltPath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if ($haltText -match $quotaPattern) { $isQuota = $true }
  }

  if ($isQuota) {
    Log "额度/限流耗尽 → 标记 $agent 冷却到下一个重置点（${QuotaResetHour}:00），换另一个 agent 继续"
    if ($agent -eq 'codex') { $codexUntil = Get-NextReset } else { $claudeUntil = Get-NextReset }
    $agent = if ($agent -eq 'codex') { 'claude' } else { 'codex' }
    Save-AgentState $agent $codexUntil $claudeUntil
    if ($halt) { Remove-Item -LiteralPath $haltPath -Force; Log '已删除 HALT，准备用新 agent 续跑' }
    continue
  }

  if ($halt) {
    Log '循环因「非额度」原因停机（HALT 存在：疑似秒退/工装故障/人工停机），不自动重启，等人处理'
    break
  }

  # 没有 HALT：正常跑到自己的轮次上限
  if ($roundNow -ge $MaxTotalRounds) { Log '已达到总轮次上限，监管器退出'; break }
  $normalRestarts++
  if ($normalRestarts -gt $MaxNormalRestarts) { Log "连续正常退出 $normalRestarts 次仍未推进到上限，停止（请人工检查）"; break }
  Log "循环正常退出但未达本脚本上限（round=$roundNow < $MaxTotalRounds），第 $normalRestarts 次续跑，agent 保持 $agent"
}

Log '额度自动切换监管器结束'
