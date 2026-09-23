# 批次验收报告生成器（验收方工装）
#
#   powershell -File tools\parity\Report-Batch.ps1 -FromRound 104 -ToRound 115
#
# 用途：每批（默认 12 轮）结束时，把「证据」汇总成一份报告，避免靠记忆写验收结论：
#   ① 每轮门禁结论 + 门禁策略（快速/全量）+ test:ui 结果行
#   ② 该区间的提交清单（git log）
#   ③ 未收口差异数与最近差异编号（parity/diffs.md）
#   ④ 证据四件套覆盖度（调用 survey-evidence-coverage.cjs）
#   ⑤ 循环自身的异常痕迹：FAILURES.md 是否非空、state.json 的 stopReason / consecutiveFail
# 只读：不写仓库内的台账文件，报告写到 tools/loop/logs/batch-report-<from>-<to>.md
[CmdletBinding()]
param(
  [string]$Repo = 'D:\workspace\maxlabel',
  [Parameter(Mandatory = $true)][int]$FromRound,
  [Parameter(Mandatory = $true)][int]$ToRound
)
$ErrorActionPreference = 'Continue'
$Repo = (Resolve-Path -LiteralPath $Repo).Path
$LogDir = Join-Path $Repo 'tools\loop\logs'
$out = Join-Path $LogDir ("batch-report-{0}-{1}.md" -f $FromRound, $ToRound)
$L = New-Object System.Collections.ArrayList
function Add2([string]$s) { [void]$L.Add($s) }

Add2("# 批次验收报告：round-$FromRound … round-$ToRound")
Add2('')
Add2("- 生成时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
Add2("- 仓库：$Repo")
Add2('')

# ① 每轮门禁
Add2('## 一、每轮门禁（驱动器独立跑的那套）')
Add2('')
Add2('| 轮次 | 结论 | 门禁策略 | test:ui | 日志 | 日志时间 |')
Add2('| --- | --- | --- | --- | --- | --- |')
$uiFull = 0; $uiSkip = 0; $fail = 0; $stale = 0
for ($r = $FromRound; $r -le $ToRound; $r++) {
  $f = Join-Path $LogDir ("round-{0:D2}-gates.md" -f $r)
  if (-not (Test-Path -LiteralPath $f)) { continue }
  $t = Get-Content -LiteralPath $f -Raw -Encoding UTF8
  $conc = ([regex]::Match($t, '结论[:：]\s*(.+)')).Groups[1].Value.Trim()
  $pol = ([regex]::Match($t, '门禁策略[:：]\s*(.+)')).Groups[1].Value.Trim()
  $uiLine = ([regex]::Match($t, '(?m)^\[(PASS|FAIL|WARN)\] test:ui.*$')).Value.Trim()
  if (-not $uiLine) { $uiLine = '—（本轮未跑全量）' }
  if ($pol -match '全量') { $uiFull++ }
  elseif ($pol) { $uiSkip++ }
  elseif ($uiLine -match 'test:ui') { $uiFull++; $pol = '（旧驱动器：无策略行，但跑了 test:ui）' }
  if ($conc -notmatch '全部通过') { $fail++ }
  # 关键：日志可能是**上一轮次编号时代**的旧文件（本批实测：round-106/107 的 -gates.md 是昨天的），
  # 不加日期就会把"根本没跑门禁的轮次"误报成"全部通过"——round-36 验收方踩过并修掉。
  $mtime = (Get-Item -LiteralPath $f).LastWriteTime
  $mark = ''
  if ($mtime.Date -lt (Get-Date).Date) { $mark = ' ⚠️疑似旧日志'; $stale++ }
  Add2(("| round-{0} | {1} | {2} | {3} | {4} | {5}{6} |" -f $r, $conc, ($pol -replace '\|', '/'), ($uiLine -replace '\|', '/'), ("round-{0:D2}-gates.md" -f $r), $mtime.ToString('MM-dd HH:mm'), $mark))
}
Add2('')
Add2("小计：跑全量 UI 的轮次 **$uiFull**，只跑快速门禁的轮次 **$uiSkip**，非全绿轮次 **$fail**，疑似旧日志 **$stale**（旧日志的结论不可当本批结论，需与提交时间交叉核对）。")
Add2('')

# ② 提交清单
Add2('## 二、本批提交')
Add2('')
Add2('```')
$since = (Get-Date).AddDays(-2).ToString('yyyy-MM-dd')
$log = & git -C $Repo log --oneline --since="$since" 2>$null
if ($log) { $log | ForEach-Object { Add2($_) } } else { Add2('（取不到 git log）') }
Add2('```')
Add2('')

# ③ 差异与失败台账
Add2('## 三、差异与失败台账')
Add2('')
$diffsPath = Join-Path $Repo 'parity\diffs.md'
$openDiffs = @()
if (Test-Path -LiteralPath $diffsPath) {
  $diffs = (Get-Content -LiteralPath $diffsPath -Raw -Encoding UTF8)
  foreach ($m in [regex]::Matches($diffs, '(?m)^## DIFF-(\d+)[^\r\n]*')) {
    # 历史快照小节（`DIFF-64-original（历史记录，保留备查）` 之类）不是"条目"，不能重复计数——
    # round-59 验收方实测：未加这条过滤时 DIFF-64 被数了两次。
    if ($m.Value -match 'original|历史记录|保留备查') { continue }
    $start = $m.Index
    $next = $diffs.IndexOf("`n## ", $start + 3)
    # 结论只看**标题行**：标题里的「→ ✅ 已修 / （未收口…）」才是权威状态；正文常引用旧描述（含"未收口"字样），
    # 拿整块判会把已修条目误判成未收口（round-59 验收方实测：DIFF-64 已标 ✅ 已修却仍被计数）。
    # round-119 再修一处假阳性：像 `## DIFF-50（原始观察记录 —— 本条已于 round-57 收口，见下方同名条目）`
    # 这种"已…收口"（中间夹字）既没有 ✅ 也没有"已收口"三连字，会被误判成未收口 → 这里把 `收口` 也算作已结案。
    # round-157 再修两处：
    #   ① **去重**（同一个编号出现多个同名/快照小节时只算一次 —— 之前 DIFF-71 被数了两次 ✗）；
    #   ② 把"已记录边界"类也视为结案：`结论：…正确/保留`、`原版有但受限`、`已记录边界`、`已收敛`
    #      —— 停止标准里"未收口差异仅剩已记录边界类"就是这个口径 ✓（DIFF-81/82 属此类，不该继续算未收口 ✗）。
    $closed = (($m.Value -match '✅') -or ($m.Value -match '已收口') -or ($m.Value -match '已修') -or ($m.Value -match '收口') -or
      ($m.Value -match '结论：') -or ($m.Value -match '保留') -or ($m.Value -match '原版有但受限') -or
      ($m.Value -match '已记录边界') -or ($m.Value -match '已收敛') -or ($m.Value -match '已部分收敛')) -and ($m.Value -notmatch '未收口')
    $diffId = "DIFF-" + $m.Groups[1].Value
    if (-not $closed -and ($openDiffs -notcontains $diffId)) { $openDiffs += $diffId }
  }
}
Add2("- 未收口差异：**$($openDiffs.Count)** 条 —— $($openDiffs -join '、')")
$failPath = Join-Path $Repo 'parity\FAILURES.md'
$failLen = if (Test-Path -LiteralPath $failPath) { (Get-Item -LiteralPath $failPath).Length } else { 0 }
# BOM 本身占 3 字节、加上标题行说明文字可能十几字节：≤ 64 字节一律当作"没有未修失败"，
# 否则会把"空台账"误报成"有未修失败"（round-59 实测：5 字节被报成非空）。
$failNote = if ($failLen -le 64) { '（≤64B，视为无未修失败）' } else { '（非空=有未修的门禁失败，需看内容）' }
Add2("- parity/FAILURES.md 字节数：$failLen $failNote")
$stPath = Join-Path $Repo 'tools\loop\state.json'
if (Test-Path -LiteralPath $stPath) {
  $st = Get-Content -LiteralPath $stPath -Raw -Encoding UTF8 | ConvertFrom-Json
  Add2("- state.json：round=$($st.round) consecutiveFail=$($st.consecutiveFail) stopReason=$($st.stopReason)")
}
Add2('')

# ④ 四件套覆盖
Add2('## 四、证据四件套覆盖度（普查）')
Add2('')
$survey = & node (Join-Path $Repo 'tools\parity\survey-evidence-coverage.cjs') 2>$null
if ($survey) {
  $survey | Where-Object { $_ -match '^\| (全矩阵|A 模块|B 模块|C 模块|D 模块|E 模块|范围)' } | ForEach-Object { Add2($_) }
} else {
  Add2('（普查脚本没输出）')
}
Add2('')

# ⑤ 验收方独立验证留痕
Add2('## 五、验收方独立验证留痕（人工记录，需人工核对）')
Add2('')
Add2('本批内验收方自己做的复核（真机像素量测 / 控件枚举 / 断言强度抽查 / 独立门禁）见：')
Add2('- `tools/loop/logs/round-*-gates.md`（驱动器门禁，非 codex 自述）')
Add2('- `parity/reference/labelshop/PROBE-verifier-*.md`（验收方真机取证）')
Add2('- `parity/界面清单.md`（四件套缺口工单）')
Add2('- `tools/loop/logs/interface-coverage.md`（四件套基线）')
Add2('')
Add2('> 提醒：报告只汇总**可核对的事实**（门禁/提交/台账/覆盖度）；主观结论必须附上面某个可点开的证据文件。')

$text = $L -join "`n"
[IO.File]::WriteAllText($out, $text, (New-Object Text.UTF8Encoding($false)))
Write-Host $text
Write-Host ''
Write-Host "[已写出] $out"
