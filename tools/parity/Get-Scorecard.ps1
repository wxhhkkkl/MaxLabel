<#
.SYNOPSIS
  LabelShop 复刻相似度记分卡：一条命令看清"离达标还有多远"。

.DESCRIPTION
  汇总五类事实（全部从落盘证据读，不做主观判断）：
    1. 功能清单覆盖：parity/matrix.md 按章节的 已实现/部分/待核 统计
    2. 差异台账：parity/diffs.md 里 DIFF-* 行的收口状态（✅ / 未收口）
    3. 门禁：tools/loop/last-gates.md 的结论 + 最后一个全绿提交
    4. 证据存量：真机参考截图 / 复刻版截图 / 并排对照图 数量
    5. 队列：tools/loop/round-focus.md 的任务项与对应 DIFF 是否已收口

.EXAMPLE
  powershell -File tools/parity/Get-Scorecard.ps1
  powershell -File tools/parity/Get-Scorecard.ps1 -Markdown parity/SCORECARD.md
#>
[CmdletBinding()]
param(
  [string]$Repo = 'D:\workspace\maxlabel',
  [string]$Markdown
)

$ErrorActionPreference = 'Continue'
$Repo = (Resolve-Path -LiteralPath $Repo).Path
$lines = New-Object System.Collections.ArrayList
function Emit([string]$s = '') { [void]$lines.Add($s); Write-Host $s }

Emit "# LabelShop 复刻相似度记分卡"
Emit ''
Emit "- 时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$head = (& git -C $Repo rev-parse --short HEAD 2>$null)
$branch = (& git -C $Repo rev-parse --abbrev-ref HEAD 2>$null)
Emit "- 分支/HEAD：``$branch`` / ``$head``"
$statePath = Join-Path $Repo 'tools\loop\state.json'
if (Test-Path -LiteralPath $statePath) {
  $st = Get-Content -LiteralPath $statePath -Raw -Encoding UTF8 | ConvertFrom-Json
  Emit "- 循环：已完成 $($st.round) 轮；最后全绿提交 ``$($st.lastGoodSha.Substring(0, [Math]::Min(8, $st.lastGoodSha.Length)))``；连续失败 $($st.consecutiveFail)；连续零进展 $($st.noProgress)"
}
Emit ''

# ---------- 1. 清单覆盖 ----------
Emit '## 1. 功能清单覆盖（parity/matrix.md）'
$matrix = Join-Path $Repo 'parity\matrix.md'
if (Test-Path -LiteralPath $matrix) {
  $rows = Get-Content -LiteralPath $matrix -Encoding UTF8 | Where-Object { $_ -match '^\|\s*[A-E]-\d+\s*\|' }
  $stats = @{}
  foreach ($r in $rows) {
    $c = $r.Trim().Trim('|') -split '\|' | ForEach-Object { $_.Trim() }
    $sec = $c[0].Substring(0, 1)
    if (-not $stats.ContainsKey($sec)) { $stats[$sec] = @{ total = 0; done = 0; part = 0; todo = 0; none = 0 } }
    $stats[$sec].total++
    switch ($c[4]) {
      '已实现' { $stats[$sec].done++ }
      '部分' { $stats[$sec].part++ }
      '未实现' { $stats[$sec].none++ }
      default { $stats[$sec].todo++ }
    }
  }
  $names = @{ A = '界面与操作习惯'; B = '编辑器对象能力'; C = '数据源与数据库'; D = '打印链路'; E = '其他' }
  Emit ''
  Emit '| 章节 | 总数 | 已实现 | 部分 | 未实现 | 待核 | 覆盖(已实现+部分) |'
  Emit '| --- | --- | --- | --- | --- | --- | --- |'
  $tDone = 0; $tPart = 0; $tAll = 0; $tNone = 0; $tTodo = 0
  foreach ($s in @('A', 'B', 'C', 'D', 'E')) {
    if (-not $stats.ContainsKey($s)) { continue }
    $v = $stats[$s]
    $cov = [int](100.0 * ($v.done + $v.part) / [Math]::Max(1, $v.total))
    Emit ("| {0} {1} | {2} | {3} | {4} | {5} | {6} | {7}% |" -f $s, $names[$s], $v.total, $v.done, $v.part, $v.none, $v.todo, $cov)
    $tDone += $v.done; $tPart += $v.part; $tAll += $v.total; $tNone += $v.none; $tTodo += $v.todo
  }
  Emit ("| **合计** | **{0}** | **{1}** | **{2}** | **{3}** | **{4}** | **{5}%** |" -f $tAll, $tDone, $tPart, $tNone, $tTodo, [int](100.0 * ($tDone + $tPart) / [Math]::Max(1, $tAll)))
  Emit ''
  Emit "- 说明：`已实现` 指有可复现证据（测试/截图/命令）；`部分` 指入口与结构已对齐但有已知差异或未验证项；`未实现` 应为 0。"
} else { Emit '- 缺少 parity/matrix.md' }
Emit ''

# ---------- 2. 差异台账 ----------
Emit '## 2. 差异台账（parity/diffs.md）'
$diffs = Join-Path $Repo 'parity\diffs.md'
if (Test-Path -LiteralPath $diffs) {
  $all = Get-Content -LiteralPath $diffs -Encoding UTF8
  # 台账里差异有两种写法：表格行（| DIFF-x | ... |）与标题行（## DIFF-x ...）。
  # 两种都要统计；同一编号只要有一处标 ✅ 就算收口（标题里的 ✅ 优先）。
  $statusById = @{}
  for ($i = 0; $i -lt $all.Count; $i++) {
    $line = $all[$i]
    if ($line -match '^\|\s*(DIFF-\d+(?:\.\d+)?)\s*\|') {
      $id = $Matches[1]
      $cells = $line.Trim().Trim('|') -split '\|' | ForEach-Object { $_.Trim() }
      $closedHere = ($cells[$cells.Count - 1] -match '✅') -or ($line -match '✅')
      $title = if ($cells.Count -gt 1) { $cells[1] } else { '' }
      if (-not $statusById.ContainsKey($id)) { $statusById[$id] = @{ closed = $false; title = $title } }
      if ($closedHere) { $statusById[$id].closed = $true }
    } elseif ($line -match '^#{2,4}\s*(DIFF-\d+(?:\.\d+)?)\b(.*)$') {
      $id = $Matches[1]
      $title = $Matches[2].Trim(' ', '—', '-', '：', ':')
      # 看标题与其后 12 行内是否出现 ✅
      $window = @($line) + @($all[($i + 1)..([Math]::Min($all.Count - 1, $i + 12))])
      $closedHere = (($window -join "`n") -match '✅')
      if (-not $statusById.ContainsKey($id)) { $statusById[$id] = @{ closed = $false; title = $title } }
      if ($closedHere) { $statusById[$id].closed = $true }
      if ($title) { $statusById[$id].title = $title }
    }
  }
  $open = @(); $closed = @()
  foreach ($id in ($statusById.Keys | Sort-Object)) {
    $e = $statusById[$id]
    if ($e.closed) { $closed += $id }
    else { $open += "$id $($e.title.Substring(0, [Math]::Min(44, $e.title.Length)))" }
  }
  Emit ''
  Emit "- 已收口：$($closed.Count) 条 $(if ($closed.Count) { '（' + ($closed -join ', ') + '）' })"
  Emit "- **未收口：$($open.Count) 条**"
  foreach ($o in $open) { Emit "  - $o" }
} else { Emit '- 缺少 parity/diffs.md' }
Emit ''

# ---------- 3. 门禁 ----------
Emit '## 3. 门禁（tools/loop/last-gates.md）'
$gates = Join-Path $Repo 'tools\loop\last-gates.md'
if (Test-Path -LiteralPath $gates) {
  $g = Get-Content -LiteralPath $gates -Encoding UTF8
  $conc = ($g | Where-Object { $_ -match '^\- 结论：' } | Select-Object -First 1)
  $when = ($g | Where-Object { $_ -match '^\- 时间：' } | Select-Object -First 1)
  $pass = @($g | Where-Object { $_ -match '^\[PASS\]' }).Count
  $warn = @($g | Where-Object { $_ -match '^\[WARN\]' }).Count
  $fail = @($g | Where-Object { $_ -match '^\[FAIL\]' }).Count
  Emit "- $when"
  Emit "- $conc"
  Emit "- 门禁项：PASS $pass / WARN $warn / FAIL $fail"
} else { Emit '- 还没有门禁记录' }
Emit ''

# ---------- 4. 证据存量 ----------
Emit '## 4. 证据存量'
$ls = @(Get-ChildItem (Join-Path $Repo 'parity\reference\labelshop') -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '_*' })
$ml = @(Get-ChildItem (Join-Path $Repo 'parity\reference\maxlabel') -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -notlike '_*' })
$rv = @(Get-ChildItem (Join-Path $Repo 'parity\review') -File -ErrorAction SilentlyContinue)
Emit "- 真机参考截图/文档：$($ls.Count) 个（$((($ls | Where-Object { $_.Extension -eq '.png' }).Count)) 张 PNG）"
Emit "- 复刻版截图：$($ml.Count) 张"
Emit "- 并排对照图：$($rv.Count) 张（parity/review/）"
$uiTests = @(Get-ChildItem (Join-Path $Repo 'app\scripts') -Filter 'ui-v*.cjs' -ErrorAction SilentlyContinue)
Emit "- CDP 冒烟脚本：$($uiTests.Count) 个（app/scripts/ui-v*.cjs）"
Emit ''

# ---------- 5. 队列 ----------
Emit '## 5. 任务队列（tools/loop/round-focus.md）'
$focus = Join-Path $Repo 'tools\loop\round-focus.md'
if (Test-Path -LiteralPath $focus) {
  $items = Get-Content -LiteralPath $focus -Encoding UTF8 | Where-Object { $_ -match '^## 第 \d+ 项' }
  if ($items.Count -eq 0) { Emit '- 焦点文件未使用队列格式' }
  foreach ($i in $items) { Emit "- $($i -replace '^## ', '')" }
} else { Emit '- 缺少 round-focus.md' }
Emit ''

# ---------- 结论行 ----------
Emit '## 达标判定（对照 parity/README.md 的口径）'
$crit = @()
$crit += "- 功能 parity：P0 条目 100% 有证据 → 当前合计覆盖 $([int](100.0 * ($tDone + $tPart) / [Math]::Max(1, $tAll)))%（未达标）"
$crit += "- 差异台账：未收口 $($open.Count) 条 → $(if ($open.Count -eq 0) { '达标' } else { '未达标' })"
$crit += "- 门禁：$(if ($fail -eq 0) { '全绿' } else { "有 $fail 项失败" })$(if ($warn -gt 0) { "（$warn 项软校验告警）" })"
foreach ($l in $crit) { Emit $l }

if ($Markdown) {
  $out = if ([IO.Path]::IsPathRooted($Markdown)) { $Markdown } else { Join-Path $Repo $Markdown }
  [IO.File]::WriteAllLines($out, $lines, (New-Object Text.UTF8Encoding($false)))
  Write-Host ''
  Write-Host "已写出：$out"
}
