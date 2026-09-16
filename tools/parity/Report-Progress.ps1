# 进度快照（验收方用）：一条命令产出可汇报的紧凑状态
# 用法：powershell -File tools/parity/Report-Progress.ps1 [-Markdown]
param([switch]$Markdown)

$ErrorActionPreference = 'Continue'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $Repo

function Get-Round {
  try { (Get-Content tools\loop\state.json -Raw | ConvertFrom-Json).round } catch { '?' }
}
function Get-State {
  try { Get-Content tools\loop\state.json -Raw | ConvertFrom-Json } catch { $null }
}

$st = Get-State
$round = Get-Round

# 矩阵统计
$rows = Get-Content parity\matrix.md -Encoding UTF8 | Where-Object { $_ -match '^\| [ABCDE]-\d+ \|' }
$stat = @{}
foreach ($r in $rows) {
  $c = $r.Trim().Trim('|') -split '\|' | ForEach-Object { $_.Trim() }
  $sec = $c[0].Substring(0,1)
  if (-not $stat[$sec]) { $stat[$sec] = @{ total = 0; done = 0; part = 0; none = 0; todo = 0 } }
  $stat[$sec].total++
  switch ($c[4]) {
    '已实现' { $stat[$sec].done++ }
    '部分'   { $stat[$sec].part++ }
    '未实现' { $stat[$sec].none++ }
    '待核'   { $stat[$sec].todo++ }
  }
}
$tot = @{ total = 0; done = 0; part = 0; none = 0; todo = 0 }
foreach ($k in $stat.Keys) { foreach ($f in 'total','done','part','none','todo') { $tot[$f] += $stat[$k][$f] } }
$cover = if ($tot.total) { [math]::Round(100.0 * ($tot.done + $tot.part) / $tot.total, 0) } else { 0 }

# 差异台账
$diffs = Get-Content parity\diffs.md -Encoding UTF8
$diffsOpen = 0
foreach ($m in [regex]::Matches(($diffs -join "`n"), '(?m)^## DIFF-(\d+)')) {
  $start = $m.Index
  $next = ($diffs -join "`n").IndexOf("`n## ", $start + 3)
  $block = if ($next -gt 0) { ($diffs -join "`n").Substring($start, $next - $start) } else { ($diffs -join "`n").Substring($start) }
  # 收口判据：出现 ✅ 或「已收口」，且不出现「未收口」
  $closed = (($block -match '✅') -or ($block -match '已收口')) -and ($block -notmatch '未收口')
  if (-not $closed) { $diffsOpen++ }
}

# 最近门禁
$lastGate = '（无）'
$g = Get-ChildItem tools\loop\logs -File -Filter 'round-*-gates.md' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($g) { $lastGate = "$($g.BaseName): " + ((Select-String -Path $g.FullName -Pattern '结论：(.+)').Matches.Groups[1].Value) }

# 证据家底
$ev = [ordered]@{
  原版取证图 = (Get-ChildItem parity\reference\labelshop -Filter '*.png' -ErrorAction SilentlyContinue | Measure-Object).Count
  复刻截图   = (Get-ChildItem parity\reference\maxlabel -Filter '*.png' -ErrorAction SilentlyContinue | Measure-Object).Count
  并排对照图 = (Get-ChildItem parity\review -Filter '*.png' -ErrorAction SilentlyContinue | Measure-Object).Count
  UI脚本     = (Get-ChildItem app\scripts -Filter 'ui-v*.cjs' -ErrorAction SilentlyContinue | Measure-Object).Count
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("进度快照  $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
[void]$sb.AppendLine("轮次: round $round   停止原因: '$($st.stopReason)'   连续失败: $($st.consecutiveFail)")
[void]$sb.AppendLine("矩阵: 共 $($tot.total) 条 → 已实现 $($tot.done) / 部分 $($tot.part) / 未实现 $($tot.none) / 待核 $($tot.todo)   覆盖 $cover%")
foreach ($k in 'A','B','C','D','E') {
  if ($stat[$k]) {
    $s = $stat[$k]
    $cv = [math]::Round(100.0 * ($s.done + $s.part) / $s.total, 0)
    [void]$sb.AppendLine("  $k : 共 $($s.total) → 已实现 $($s.done) / 部分 $($s.part) / 未实现 $($s.none) / 待核 $($s.todo)   $cv%")
  }
}
[void]$sb.AppendLine("未收口差异: $diffsOpen 条")
[void]$sb.AppendLine("最近门禁: $lastGate")
[void]$sb.AppendLine("证据: 原版图 $($ev.'原版取证图') / 复刻图 $($ev.'复刻截图') / 并排 $($ev.'并排对照图') / UI脚本 $($ev.'UI脚本')")
[void]$sb.AppendLine("最近提交: " + ((git log --oneline -3) -join ' ; '))

$text = $sb.ToString()
$out = Join-Path $Repo 'parity\PROGRESS-LATEST.md'
[IO.File]::WriteAllText($out, "```text`n$text``````n", (New-Object Text.UTF8Encoding($false)))
[IO.File]::WriteAllText((Join-Path $Repo 'tools\loop\.last-report'), (Get-Date -Format 'o'), (New-Object Text.UTF8Encoding($false)))
Write-Host $text
Write-Host "已写入 $out"
