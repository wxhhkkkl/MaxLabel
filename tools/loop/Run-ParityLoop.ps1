<#
.SYNOPSIS
  LabelShop 复刻 parity 循环驱动器：反复调用 Codex CLI，每轮后由本脚本独立跑验收门禁。

.DESCRIPTION
  设计要点（针对"Codex 写一会儿就停下来"的问题）：
    - 每轮都是新的 codex exec 会话，读同一份持久状态（parity/matrix.md、parity/backlog.md、
      tools/loop/last-gates.md、parity/FAILURES.md），不依赖上下文记忆。
    - 门禁由本脚本（验收方）执行，不采信 Codex 自述；失败写入 parity/FAILURES.md 供下一轮修。
    - 连续 3 轮门禁失败 → 回滚到上一个门禁全绿的提交（改动 stash 保留，可找回）。
    - 连续 3 轮"零进展"（HEAD 未变、工作区干净、matrix/backlog 未更新）→ 自动停止并报告。
    - 创建 tools/loop/STOP 文件可优雅停止；tools/loop/PAUSE 可让它跑完当前轮后停下。

.EXAMPLE
  powershell -File tools/loop/Run-ParityLoop.ps1 -Rounds 8
  powershell -File tools/loop/Run-ParityLoop.ps1 -Rounds 20 -SkipUi -RoundTimeoutMinutes 60
#>
[CmdletBinding()]
param(
  [int]$Rounds = 10,
  [int]$RoundTimeoutMinutes = 45,
  [switch]$SkipUi,
  [switch]$NoRollback,
  [string]$Repo = 'D:\workspace\maxlabel',
  [string]$CodexExe
)

$ErrorActionPreference = 'Continue'
$Repo = (Resolve-Path -LiteralPath $Repo).Path
$LoopDir = Join-Path $Repo 'tools\loop'
$LogDir = Join-Path $LoopDir 'logs'
$AppDir = Join-Path $Repo 'app'
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (-not $CodexExe) {
  $cand = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin') -Filter 'codex.exe' -Recurse -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $cand) { throw '找不到 codex.exe，请用 -CodexExe 指定' }
  $CodexExe = $cand.FullName
}
Write-Host "[loop] codex: $CodexExe"
Write-Host "[loop] repo : $Repo"

$promptPath = Join-Path $LoopDir 'round-prompt.md'
if (-not (Test-Path -LiteralPath $promptPath)) { throw "缺少轮次提示词: $promptPath" }
$basePrompt = Get-Content -LiteralPath $promptPath -Raw -Encoding UTF8

# ---------------- 状态 ----------------
$statePath = Join-Path $LoopDir 'state.json'
$state = [ordered]@{ round = 0; lastGoodSha = ''; consecutiveFail = 0; noProgress = 0; stopReason = '' }
if (Test-Path -LiteralPath $statePath) {
  try {
    $loaded = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
    foreach ($k in @('round', 'lastGoodSha', 'consecutiveFail', 'noProgress', 'stopReason')) {
      if ($null -ne $loaded.$k) { $state[$k] = $loaded.$k }
    }
  } catch { Write-Host "[loop] state.json 解析失败，重新开始计数：$($_.Exception.Message)" }
}
function Save-State {
  $state | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $statePath -Encoding UTF8
}
if (-not $state.lastGoodSha) {
  $state.lastGoodSha = (& git -C $Repo rev-parse HEAD).Trim()
  Save-State
}

# ---------------- 工具函数 ----------------
function Get-HeadSha { return (& git -C $Repo rev-parse HEAD).Trim() }
function Get-DirtyCount { return (@(& git -C $Repo status --porcelain)).Count }
function Get-FileHashSafe {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return 'missing' }
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA1).Hash
}

# ---------------- 门禁 ----------------
$gates = @(
  @{ name = 'typecheck';         cmd = 'npm run typecheck' },
  @{ name = 'test:architecture'; cmd = 'npm run test:architecture' },
  @{ name = 'test:editor';       cmd = 'npm run test:editor' },
  @{ name = 'test:geometry';     cmd = 'npm run test:geometry' },
  @{ name = 'test:history';      cmd = 'npm run test:history' },
  @{ name = 'test:print';        cmd = 'npm run test:print' },
  @{ name = 'test:render';       cmd = 'npm run test:render' },
  @{ name = 'test:workspace';    cmd = 'npm run test:workspace' },
  @{ name = 'build';             cmd = 'npm run build' }
)
if (-not $SkipUi) { $gates += @{ name = 'test:ui'; cmd = 'npm run test:ui' } }

function Invoke-Gates {
  param([string]$RoundLabel, [string]$LogFile)
  $lines = @()
  $failed = @()
  foreach ($g in $gates) {
    Write-Host "[gate] $($g.name) …"
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $out = & cmd /c "cd /d `"$AppDir`" && $($g.cmd) 2>&1" | Out-String
    $code = $LASTEXITCODE
    $sw.Stop()
    $tail = ($out -split "`r?`n" | Where-Object { $_.Trim() -ne '' } | Select-Object -Last 25) -join "`n"
    $status = if ($code -eq 0) { 'PASS' } else { 'FAIL' }
    $lines += "[$status] $($g.name) (exit=$code, $([int]$sw.Elapsed.TotalSeconds)s)"
    $lines += $tail
    $lines += ''
    if ($code -ne 0) {
      $failed += [pscustomobject]@{ name = $g.name; exit = $code; tail = $tail }
      Write-Host "[gate] $($g.name) 失败 (exit=$code)"
    } else {
      Write-Host "[gate] $($g.name) 通过 ($([int]$sw.Elapsed.TotalSeconds)s)"
    }
  }
  $summary = @()
  $summary += "# 门禁结果（$RoundLabel）"
  $summary += ''
  $summary += "- 时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  $summary += "- HEAD：$(Get-HeadSha)"
  $summary += "- 结论：$(if ($failed.Count -eq 0) { '全部通过' } else { "失败 $($failed.Count) 项: $(($failed | ForEach-Object { $_.name }) -join ', ')" })"
  $summary += ''
  $summary += ($lines -join "`n")
  $text = $summary -join "`n"
  Set-Content -LiteralPath $LogFile -Value $text -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $LoopDir 'last-gates.md') -Value $text -Encoding UTF8
  return [pscustomobject]@{ failed = $failed; text = $text }
}

# ---------------- 运行一轮 Codex ----------------
function Invoke-CodexRound {
  param([int]$RoundNo, [string]$OutFile, [string]$ErrFile, [string]$LastMsgFile)
  $extra = @()
  # 可选：tools/loop/round-images.txt 每行一个图片路径，会作为附件喂给 Codex（视觉对照用）
  $imgList = Join-Path $LoopDir 'round-images.txt'
  if (Test-Path -LiteralPath $imgList) {
    foreach ($p in (Get-Content -LiteralPath $imgList -Encoding UTF8)) {
      $t = $p.Trim()
      if ($t -and (Test-Path -LiteralPath $t)) { $extra += @('-i', $t) }
    }
  }
  $focusFile = Join-Path $LoopDir 'round-focus.md'
  $prompt = $basePrompt
  $prompt += "`n`n---`n`n# 本轮（第 $RoundNo 轮）附加指令`n`n"
  if (Test-Path -LiteralPath $focusFile) {
    $focus = (Get-Content -LiteralPath $focusFile -Raw -Encoding UTF8).Trim()
    if ($focus) { $prompt += $focus + "`n" }
  } else {
    $prompt += "按 parity/backlog.md 的优先级自选 3-6 条同模块条目推进。`n"
  }

  $argList = @('exec', '--dangerously-bypass-approvals-and-sandbox', '-C', $Repo, '-o', $LastMsgFile)
  $argList += $extra
  $argList += '-'

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $CodexExe
  $psi.Arguments = ($argList | ForEach-Object { if ($_ -match '\s') { '"' + $_ + '"' } else { $_ } }) -join ' '
  $psi.WorkingDirectory = $Repo
  $psi.UseShellExecute = $false
  $psi.RedirectStandardInput = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.StandardOutputEncoding = [Text.Encoding]::UTF8
  $psi.StandardErrorEncoding = [Text.Encoding]::UTF8
  # 必须显式指定：否则 .NET Framework 默认用系统 ANSI 写 stdin，中文提示词会变成乱码
  $psi.StandardInputEncoding = New-Object Text.UTF8Encoding($false)

  Write-Host "[round $RoundNo] 启动 codex exec（超时 $RoundTimeoutMinutes 分钟）…"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = [System.Diagnostics.Process]::Start($psi)
  $p.StandardInput.Write($prompt)
  $p.StandardInput.Close()
  $outTask = $p.StandardOutput.ReadToEndAsync()
  $errTask = $p.StandardError.ReadToEndAsync()
  $timedOut = $false
  if (-not $p.WaitForExit($RoundTimeoutMinutes * 60 * 1000)) {
    $timedOut = $true
    try { $p.Kill() } catch {}
    Write-Host "[round $RoundNo] 超时，已终止 codex"
  }
  $sw.Stop()
  $stdout = ''
  $stderr = ''
  try { $stdout = $outTask.Result } catch {}
  try { $stderr = $errTask.Result } catch {}
  Set-Content -LiteralPath $OutFile -Value $stdout -Encoding UTF8
  Set-Content -LiteralPath $ErrFile -Value $stderr -Encoding UTF8
  $exit = if ($timedOut) { 124 } else { $p.ExitCode }
  Write-Host "[round $RoundNo] codex 结束 exit=$exit，用时 $([int]$sw.Elapsed.TotalMinutes) 分钟"
  return [pscustomobject]@{ exit = $exit; timedOut = $timedOut; minutes = [int]$sw.Elapsed.TotalMinutes }
}

# ---------------- 主循环 ----------------
$matrixPath = Join-Path $Repo 'parity\matrix.md'
$backlogPath = Join-Path $Repo 'parity\backlog.md'
$progressPath = Join-Path $Repo 'parity\progress.md'
$failuresPath = Join-Path $Repo 'parity\FAILURES.md'
if (-not (Test-Path -LiteralPath $progressPath)) {
  Set-Content -LiteralPath $progressPath -Value "# Parity 循环进度`n`n（每轮追加，最新在下方）`n" -Encoding UTF8
}

for ($i = 1; $i -le $Rounds; $i++) {
  if (Test-Path -LiteralPath (Join-Path $LoopDir 'STOP')) {
    $state.stopReason = 'STOP 文件'
    Write-Host '[loop] 发现 STOP 文件，退出'
    break
  }
  $state.round = [int]$state.round + 1
  $roundNo = [int]$state.round
  $roundLabel = "round-{0:D2}" -f $roundNo
  Save-State

  Write-Host ''
  Write-Host "=================== $roundLabel ==================="
  $headBefore = Get-HeadSha
  $matrixBefore = Get-FileHashSafe -Path $matrixPath
  $backlogBefore = Get-FileHashSafe -Path $backlogPath
  $dirtyBefore = Get-DirtyCount

  $codexOut = Join-Path $LogDir "$roundLabel-codex.out.txt"
  $codexErr = Join-Path $LogDir "$roundLabel-codex.err.txt"
  $lastMsg = Join-Path $LogDir "$roundLabel-last-message.txt"
  $gateLog = Join-Path $LogDir "$roundLabel-gates.md"

  $run = Invoke-CodexRound -RoundNo $roundNo -OutFile $codexOut -ErrFile $codexErr -LastMsgFile $lastMsg

  # ---- 独立验收：门禁 ----
  $gateResult = Invoke-Gates -RoundLabel $roundLabel -LogFile $gateLog
  $gatePass = ($gateResult.failed.Count -eq 0)

  # ---- 失败反馈给下一轮 ----
  if (-not $gatePass) {
    $failText = @()
    $failText += "# 门禁失败（$roundLabel）——下一轮必须先修好这里"
    $failText += ''
    $failText += "- 时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    $failText += "- HEAD：$(Get-HeadSha)"
    $failText += ''
    foreach ($f in $gateResult.failed) {
      $failText += "## $($f.name) (exit=$($f.exit))"
      $failText += ''
      $failText += '```'
      $failText += $f.tail
      $failText += '```'
      $failText += ''
    }
    $failText += "完整日志：tools/loop/logs/$roundLabel-gates.md"
    Set-Content -LiteralPath $failuresPath -Value ($failText -join "`n") -Encoding UTF8
    $state.consecutiveFail = [int]$state.consecutiveFail + 1
  } else {
    if (Test-Path -LiteralPath $failuresPath) {
      Set-Content -LiteralPath $failuresPath -Value '' -Encoding UTF8
    }
    $state.consecutiveFail = 0
    $state.lastGoodSha = Get-HeadSha
  }

  # ---- 零进展检测 ----
  $headAfter = Get-HeadSha
  $matrixAfter = Get-FileHashSafe -Path $matrixPath
  $backlogAfter = Get-FileHashSafe -Path $backlogPath
  $dirtyAfter = Get-DirtyCount
  $progressed = ($headAfter -ne $headBefore) -or ($matrixAfter -ne $matrixBefore) -or ($backlogAfter -ne $backlogBefore) -or ($dirtyAfter -gt 0)
  if ($progressed) { $state.noProgress = 0 } else { $state.noProgress = [int]$state.noProgress + 1 }

  # ---- 提交未提交改动（Codex 忘记提交时兜底） ----
  if ($dirtyAfter -gt 0 -and $gatePass) {
    & git -C $Repo add -A | Out-Null
    & git -C $Repo -c user.name='codex' -c user.email='codex@local' commit -m "parity: $roundLabel 自动提交（门禁通过）" | Out-Null
    $headAfter = Get-HeadSha
    $state.lastGoodSha = $headAfter
    Write-Host "[loop] 已自动提交未提交改动"
  }

  # ---- 回滚策略 ----
  if (-not $gatePass -and [int]$state.consecutiveFail -ge 3 -and -not $NoRollback) {
    Write-Host "[loop] 连续 $($state.consecutiveFail) 轮门禁失败，回滚到 $($state.lastGoodSha)"
    & git -C $Repo reset --hard $state.lastGoodSha | Out-Null
    & git -C $Repo stash push -u -m "parity-loop rollback $roundLabel" | Out-Null
    $state.consecutiveFail = 0
    Add-Content -LiteralPath $failuresPath -Value "`n`n[loop] 已回滚到 $($state.lastGoodSha)（改动已 stash 保留）" -Encoding UTF8
  }

  # ---- 记录 ----
  $lastMsgText = ''
  if (Test-Path -LiteralPath $lastMsg) { $lastMsgText = (Get-Content -LiteralPath $lastMsg -Raw -Encoding UTF8).Trim() }
  if ($lastMsgText.Length -gt 2500) { $lastMsgText = $lastMsgText.Substring(0, 2500) + "`n…（截断，全文见 $roundLabel-last-message.txt）" }
  $entry = @()
  $entry += "## $roundLabel  ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))"
  $entry += ''
  $entry += "- codex: exit=$($run.exit)$(if ($run.timedOut) { ' (超时)' } else { '' })，用时 $($run.minutes) 分钟"
  $entry += "- 门禁: $(if ($gatePass) { '全部通过 ✅' } else { "失败: $(($gateResult.failed | ForEach-Object { $_.name }) -join ', ') ❌" })"
  $entry += "- HEAD: $headBefore → $headAfter；有进展: $progressed；连续失败: $($state.consecutiveFail)；连续零进展: $($state.noProgress)"
  $entry += ''
  $entry += '### codex 汇报'
  $entry += ''
  $entry += $lastMsgText
  $entry += ''
  $entry += '---'
  $entry += ''
  Add-Content -LiteralPath $progressPath -Value ($entry -join "`n") -Encoding UTF8
  Save-State

  if ([int]$state.noProgress -ge 3) {
    $state.stopReason = "连续 3 轮零进展（$roundLabel）"
    Write-Host '[loop] 连续 3 轮零进展，停止'
    Save-State
    break
  }
  if (Test-Path -LiteralPath (Join-Path $LoopDir 'PAUSE')) {
    $state.stopReason = 'PAUSE 文件'
    Write-Host '[loop] 发现 PAUSE 文件，停止'
    Save-State
    break
  }
}

Write-Host ''
Write-Host "=================== 循环结束 ==================="
Write-Host "总轮次: $($state.round)；停止原因: $($state.stopReason)；最后全绿提交: $($state.lastGoodSha)"
Save-State
