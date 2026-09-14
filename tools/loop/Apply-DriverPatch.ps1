# 驱动器补丁：等 Run-ParityLoop.ps1 停止后再执行本脚本
# 改进三件事：
#   1) 单轮超时 45 → 70 分钟（实测 45 分钟常被截断，成果来不及落账）
#   2) 增加「清单软校验」门禁（Check-Matrix.ps1）：只记录 WARN，不触发回滚
#   3) 增加「结算轮」：上一轮超时或清单未更新时，自动补一个只做落账的短轮（15 分钟）
$ErrorActionPreference = 'Stop'
$p = 'D:\workspace\maxlabel\tools\loop\Run-ParityLoop.ps1'
$raw = Get-Content -LiteralPath $p -Raw -Encoding UTF8
$c = $raw -replace "`r`n", "`n"
$fail = @()

function Replace-Once {
  param([string]$Text, [string]$Old, [string]$New, [string]$Tag)
  $n = ([regex]::Matches($Text, [regex]::Escape($Old))).Count
  if ($n -ne 1) { $script:fail += "$Tag 匹配 $n 次（应为 1）"; return $Text }
  Write-Host "[ok] $Tag"
  return $Text.Replace($Old, $New)
}

# ---- 1) 超时默认值 ----
$c = Replace-Once $c '[int]$RoundTimeoutMinutes = 45' '[int]$RoundTimeoutMinutes = 70' '1) 超时默认 70'

# ---- 2a) Invoke-CodexRound 支持覆盖提示词与自定义超时 ----
$c = Replace-Once $c @'
function Invoke-CodexRound {
  param([int]$RoundNo, [string]$OutFile, [string]$ErrFile, [string]$LastMsgFile)
  $extra = @()
'@ @'
function Invoke-CodexRound {
  param([int]$RoundNo, [string]$OutFile, [string]$ErrFile, [string]$LastMsgFile,
        [string]$PromptOverride = '', [int]$TimeoutMinutes = 0)
  $extra = @()
'@ '2a) Invoke-CodexRound 参数'

$c = Replace-Once $c @'
  $focusFile = Join-Path $LoopDir 'round-focus.md'
  $prompt = $basePrompt
  $prompt += "`n`n---`n`n# 本轮（第 $RoundNo 轮）附加指令`n`n"
  if (Test-Path -LiteralPath $focusFile) {
    $focus = (Get-Content -LiteralPath $focusFile -Raw -Encoding UTF8).Trim()
    if ($focus) { $prompt += $focus + "`n" }
  } else {
    $prompt += "按 parity/backlog.md 的优先级自选 3-6 条同模块条目推进。`n"
  }
'@ @'
  $focusFile = Join-Path $LoopDir 'round-focus.md'
  if ($PromptOverride) {
    $prompt = $PromptOverride
  } else {
    $prompt = $basePrompt
    $prompt += "`n`n---`n`n# 本轮（第 $RoundNo 轮）附加指令`n`n"
    if (Test-Path -LiteralPath $focusFile) {
      $focus = (Get-Content -LiteralPath $focusFile -Raw -Encoding UTF8).Trim()
      if ($focus) { $prompt += $focus + "`n" }
    } else {
      $prompt += "按 parity/backlog.md 的优先级自选 3-6 条同模块条目推进。`n"
    }
  }
'@ '2b) 提示词覆盖'

$c = Replace-Once $c @'
  Write-Host "[round $RoundNo] 启动 codex exec（超时 $RoundTimeoutMinutes 分钟）…"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = [System.Diagnostics.Process]::Start($psi)
'@ @'
  $limitMin = if ($TimeoutMinutes -gt 0) { $TimeoutMinutes } else { $RoundTimeoutMinutes }
  Write-Host "[round $RoundNo] 启动 codex exec（超时 $limitMin 分钟）…"
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = [System.Diagnostics.Process]::Start($psi)
'@ '2c) 超时变量'

$c = Replace-Once $c '  if (-not $p.WaitForExit($RoundTimeoutMinutes * 60 * 1000)) {' '  if (-not $p.WaitForExit($limitMin * 60 * 1000)) {' '2d) WaitForExit 用 limitMin'

# ---- 3) 门禁：支持 dir 与 soft ----
$c = Replace-Once $c @'
if (-not $SkipUi) { $gates += @{ name = 'test:ui'; cmd = 'npm run test:ui' } }
'@ @'
if (-not $SkipUi) { $gates += @{ name = 'test:ui'; cmd = 'npm run test:ui' } }
# 软门禁：清单记账完整性。失败只记 WARN，不参与回滚判定。
$gates += @{ name = 'parity:matrix'; cmd = 'powershell -NoProfile -ExecutionPolicy Bypass -File tools\parity\Check-Matrix.ps1'; dir = $Repo; soft = $true }
'@ '3a) 清单软门禁'

$c = Replace-Once $c @'
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $out = & cmd /c "cd /d `"$AppDir`" && $($g.cmd) 2>&1" | Out-String
'@ @'
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $runDir = if ($g.dir) { $g.dir } else { $AppDir }
    $out = & cmd /c "cd /d `"$runDir`" && $($g.cmd) 2>&1" | Out-String
'@ '3b) 门禁工作目录'

$c = Replace-Once $c @'
    $status = if ($code -eq 0) { 'PASS' } else { 'FAIL' }
'@ @'
    $status = if ($code -eq 0) { 'PASS' } elseif ($g.soft) { 'WARN' } else { 'FAIL' }
'@ '3c) 门禁状态含 WARN'

$c = Replace-Once $c @'
    if ($code -ne 0) {
      $failed += [pscustomobject]@{ name = $g.name; exit = $code; tail = $tail }
      Write-Host "[gate] $($g.name) 失败 (exit=$code)"
    } else {
'@ @'
    if ($code -ne 0) {
      if (-not $g.soft) { $failed += [pscustomobject]@{ name = $g.name; exit = $code; tail = $tail } }
      $softNote = if ($g.soft) { ' [soft，不影响判定]' } else { '' }
      Write-Host "[gate] $($g.name) 失败 (exit=$code)$softNote"
    } else {
'@ '3d) 软失败不计入 failed'

# ---- 4) 结算轮 ----
$c = Replace-Once $c @'
  # ---- 失败反馈给下一轮 ----
  if (-not $gatePass) {
'@ @'
  # ---- 结算轮：上一轮超时或清单没更新时，补一个只做落账的短轮 ----
  $matrixAfterRun = Get-FileHashSafe -Path $matrixPath
  if ($run.timedOut -or $matrixAfterRun -eq $matrixBefore) {
    $settlePromptPath = Join-Path $LoopDir 'settle-prompt.md'
    if (Test-Path -LiteralPath $settlePromptPath) {
      $why = if ($run.timedOut) { '上一轮超时' } else { '上一轮没有更新 parity/matrix.md' }
      Write-Host "[loop] 触发结算轮（$why）"
      $settlePrompt = Get-Content -LiteralPath $settlePromptPath -Raw -Encoding UTF8
      $sr = Invoke-CodexRound -RoundNo $roundNo -OutFile (Join-Path $LogDir "$roundLabel-settle.out.txt") `
        -ErrFile (Join-Path $LogDir "$roundLabel-settle.err.txt") `
        -LastMsgFile (Join-Path $LogDir "$roundLabel-settle-last.txt") `
        -PromptOverride $settlePrompt -TimeoutMinutes 15
      Write-Host "[loop] 结算轮结束 exit=$($sr.exit)，用时 $($sr.seconds)s"
      $afterSettle = Get-FileHashSafe -Path $matrixPath
      if ($afterSettle -ne $matrixBefore) { Write-Host '[loop] 结算轮更新了清单' } else { Write-Host '[loop] 结算轮未改动清单' }
    } else {
      Write-Host "[loop] 缺 tools/loop/settle-prompt.md，跳过结算轮"
    }
  }

  # ---- 失败反馈给下一轮 ----
  if (-not $gatePass) {
'@ '4) 结算轮'

if ($fail.Count -gt 0) {
  Write-Host ''
  Write-Host "补丁未应用，以下替换未命中：" -ForegroundColor Red
  $fail | ForEach-Object { Write-Host "  - $_" }
  exit 1
}

[IO.File]::WriteAllText($p, $c, (New-Object Text.UTF8Encoding($true)))
Write-Host ''
Write-Host '补丁已全部应用。语法检查：'
$errs = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($p, [ref]$null, [ref]$errs)
if ($errs -and $errs.Count -gt 0) {
  Write-Host "语法错误 $($errs.Count) 处：" -ForegroundColor Red
  $errs | Select-Object -First 5 | ForEach-Object { Write-Host "  $($_.Message)" }
  exit 2
}
Write-Host 'OK：无语法错误'
