<#
.SYNOPSIS
  长跑监管器：反复启动 Run-ParityLoop.ps1，直到出现 HALT 文件或达到总轮次上限。

.DESCRIPTION
  Run-ParityLoop.ps1 每次运行只跑 N 轮就退出（便于人工检查）。本监管器把"批次"串起来：
    - 每批之间 sleep 一小会儿，然后自动开下一批，Codex 会从 state.json 接着编号
    - 出现 tools/loop/HALT 文件 → 本轮结束后停止（优雅退出）
    - 出现 tools/loop/STOP 文件 → 交给 Run-ParityLoop.ps1 自己优雅停止
    - 达到 -MaxTotalRounds 或累计失败批次上限 → 停止并写日志
  所有输出写入 tools/loop/logs/supervisor-<时间戳>.log，同时回显。

.EXAMPLE
  # 后台长跑：先跑到 60 轮为止
  powershell -File tools/loop/Start-Loop.ps1 -BatchRounds 12 -MaxTotalRounds 60
#>
[CmdletBinding()]
param(
  [int]$BatchRounds = 12,
  [int]$MaxTotalRounds = 48,
  [int]$BatchTimeoutMinutes = 90,
  [int]$CooldownSeconds = 20,
  [int]$MaxFailedBatches = 2,
  [int]$FullUiEveryN = 10,
  [string]$Repo = 'D:\workspace\maxlabel',
  [ValidateSet('codex','claude')][string]$Agent = 'codex',
  [string]$AgentModel,
  [switch]$DryRun
)

$ErrorActionPreference = 'Continue'
$Repo = (Resolve-Path -LiteralPath $Repo).Path
$LoopDir = Join-Path $Repo 'tools\loop'
$LogDir = Join-Path $LoopDir 'logs'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$supLog = Join-Path $LogDir "supervisor-$stamp.log"

function Log([string]$m) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m
  Write-Host $line
  if (-not $DryRun) { Add-Content -LiteralPath $supLog -Value $line -Encoding UTF8 }
}

Log "监管器启动：批次 $BatchRounds 轮 / 总上限 $MaxTotalRounds 轮 / 单批超时 $BatchTimeoutMinutes 分钟 / 每 $FullUiEveryN 轮跑一次全量 UI$(if ($DryRun) { '（DryRun 预检，不会真的开批次）' })"
Log "仓库：$Repo"

$driver = Join-Path $LoopDir 'Run-ParityLoop.ps1'
if (-not (Test-Path -LiteralPath $driver)) { Log "缺 $driver，退出"; exit 2 }

$statePath = Join-Path $LoopDir 'state.json'
function Get-Round {
  if (-not (Test-Path -LiteralPath $statePath)) { return 0 }
  try { return [int]((Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json).round) } catch { return 0 }
}

$failedBatches = 0
$batches = 0
if ($DryRun) {
  $round = Get-Round
  Log "[DryRun] 驱动脚本存在：$driver"
  Log "[DryRun] 日志目录可写：$LogDir（supervisor 日志将写入 supervisor-<时间戳>.log）"
  Log "[DryRun] 当前 state.json round = $round；下一批将跑 $BatchRounds 轮，直到 round $([Math]::Min($MaxTotalRounds, $round + $BatchRounds))"
  Log "[DryRun] HALT 文件是否存在：$(Test-Path -LiteralPath (Join-Path $LoopDir 'HALT'))；STOP：$(Test-Path -LiteralPath (Join-Path $LoopDir 'STOP'))"
  Log "[DryRun] 轮次上限检查：$(if ($round -ge $MaxTotalRounds) { '已达到上限，实跑会立即退出' } else { '未达上限，实跑会开新批次' })"
  Log "[DryRun] 预检完成，未启动任何批次"
  exit 0
}

while ($true) {
  if (Test-Path -LiteralPath (Join-Path $LoopDir 'HALT')) { Log '发现 HALT 文件，监管器退出'; break }
  $round = Get-Round
  if ($round -ge $MaxTotalRounds) { Log "已达到总轮次上限（$round ≥ $MaxTotalRounds），退出"; break }

  $batches++
  Log "=== 第 $batches 批开始（当前已完成 $round 轮）==="
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $driverArgs = @('-Rounds', $BatchRounds, '-StallMinutes', '20', '-Agent', $Agent, '-FullUiEveryN', $FullUiEveryN)
  if ($AgentModel) { $driverArgs += @('-AgentModel', $AgentModel) }
  $out = & powershell -NoProfile -ExecutionPolicy Bypass -File $driver @driverArgs 2>&1 | Out-String
  $sw.Stop()
  Add-Content -LiteralPath $supLog -Value $out -Encoding UTF8
  $code = $LASTEXITCODE
  $after = Get-Round
  Log "第 $batches 批结束：exit=$code，本轮推进到 $after 轮，用时 $([int]$sw.Elapsed.TotalMinutes) 分钟"

  # 失败批次判定：这一批几乎没有推进，且 exit 非 0
  if ($code -ne 0 -and ($after - $round) -le 0) {
    $failedBatches++
    Log "空转批次计数：$failedBatches / $MaxFailedBatches"
    if ($failedBatches -ge $MaxFailedBatches) { Log '连续空转批次过多，监管器停止（请人工检查）'; break }
  } else {
    $failedBatches = 0
  }

  if (Test-Path -LiteralPath (Join-Path $LoopDir 'STOP')) { Log '发现 STOP 文件，监管器退出'; break }
  if (Test-Path -LiteralPath (Join-Path $LoopDir 'HALT')) { Log '发现 HALT 文件，监管器退出'; break }
  Log "冷却 $CooldownSeconds 秒后进入下一批…"
  Start-Sleep -Seconds $CooldownSeconds
}

Log '监管器结束'
