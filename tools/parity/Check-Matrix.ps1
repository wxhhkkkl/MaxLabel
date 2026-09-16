<#
.SYNOPSIS
  校验 parity/matrix.md 的完整性，防止"没证据就标已实现"。

.DESCRIPTION
  检查项：
    1. 每行必须是 6 列，编号形如 A-01 / B-123，且全局唯一
    2. 复刻状态只能是 待核 / 已实现 / 部分 / 未实现
    3. 状态为 已实现 或 部分 时，「证据」列必须非空（测试名/截图名/命令）
    4. 出处文件必须真实存在于 app/docs/labelshop-help-zh/
  另外输出进度统计（按章节、按状态），供循环判断是否接近达标。

  退出码：0 = 通过；1 = 有违规。把违规行打印出来，方便下一轮修。

.EXAMPLE
  powershell -File tools/parity/Check-Matrix.ps1
  powershell -File tools/parity/Check-Matrix.ps1 -MaxViolations 40
#>
[CmdletBinding()]
param(
  [string]$MatrixPath,
  [string]$HelpDir,
  [int]$MaxViolations = 25,
  [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $MatrixPath) { $MatrixPath = Join-Path $repo 'parity\matrix.md' }
if (-not $HelpDir) { $HelpDir = Join-Path $repo 'app\docs\labelshop-help-zh' }
if (-not (Test-Path -LiteralPath $MatrixPath)) { Write-Error "找不到清单：$MatrixPath"; exit 2 }

$allowed = @('待核', '已实现', '部分', '未实现')
$rows = @()
$violations = @()
$lineNo = 0
foreach ($line in (Get-Content -LiteralPath $MatrixPath -Encoding UTF8)) {
  $lineNo++
  $t = $line.Trim()
  if (-not $t.StartsWith('|')) { continue }
  if ($t -match '^\|\s*-{2,}') { continue }         # 表头分隔行
  if ($t -match '^\|\s*编号\s*\|') { continue }      # 表头
  $cells = $t.Trim('|') -split '\|' | ForEach-Object { $_.Trim() }
  if ($cells.Count -ne 6) {
    $violations += "L${lineNo}: 列数为 $($cells.Count)，应为 6 —— $t"
    continue
  }
  $id = $cells[0]; $feature = $cells[1]; $beh = $cells[2]; $src = $cells[3]; $status = $cells[4]; $ev = $cells[5]
  if ($id -notmatch '^[A-E]-\d{2,3}$') { $violations += "L${lineNo}: 编号非法 '$id'" }
  if ($status -notin $allowed) { $violations += "L${lineNo}: 状态非法 '$status'（$id）" }
  if (($status -eq '已实现' -or $status -eq '部分') -and [string]::IsNullOrWhiteSpace($ev)) {
    $violations += "L${lineNo}: $id 状态为「$status」但证据列为空"
  }
  if ([string]::IsNullOrWhiteSpace($feature)) { $violations += "L${lineNo}: $id 功能点为空" }
  if ([string]::IsNullOrWhiteSpace($beh)) { $violations += "L${lineNo}: $id 原版行为要点为空" }
  if ($src) {
    foreach ($f in ($src -split ',')) {
      $fn = $f.Trim()
      if ($fn -and -not (Test-Path -LiteralPath (Join-Path $HelpDir $fn))) {
        $violations += "L${lineNo}: $id 出处文件不存在 '$fn'"
      }
    }
  }
  $rows += [pscustomobject]@{ Id = $id; Section = $id.Substring(0, 1); Status = $status; Evidence = $ev }
}

$dupIds = $rows | Group-Object Id | Where-Object { $_.Count -gt 1 }
foreach ($d in $dupIds) { $violations += "重复编号：$($d.Name) × $($d.Count)" }

if (-not $Quiet) {
  Write-Host '=== parity/matrix.md 校验 ==='
  Write-Host "总条目：$($rows.Count)"
  Write-Host ''
  Write-Host '按章节 / 状态：'
  $sections = @{ A = '界面与操作习惯'; B = '编辑器对象能力'; C = '数据源与数据库'; D = '打印链路'; E = '其他' }
  foreach ($s in @('A', 'B', 'C', 'D', 'E')) {
    $sub = $rows | Where-Object { $_.Section -eq $s }
    if (-not $sub) { continue }
    $parts = foreach ($st in $allowed) {
      $c = ($sub | Where-Object { $_.Status -eq $st }).Count
      if ($c -gt 0) { "$st=$c" }
    }
    Write-Host ("  {0} {1,-16} 共 {2,3} 条：{3}" -f $s, $sections[$s], $sub.Count, ($parts -join '  '))
  }
  $done = ($rows | Where-Object { $_.Status -eq '已实现' }).Count
  $partial = ($rows | Where-Object { $_.Status -eq '部分' }).Count
  $todo = ($rows | Where-Object { $_.Status -eq '待核' }).Count
  $missing = ($rows | Where-Object { $_.Status -eq '未实现' }).Count
  Write-Host ''
  Write-Host ("合计：已实现 {0} / 部分 {1} / 未实现 {2} / 待核 {3}（覆盖率 {4}%）" -f `
    $done, $partial, $missing, $todo, [int](100.0 * ($done + $partial) / [Math]::Max(1, $rows.Count)))
}

if ($violations.Count -gt 0) {
  Write-Host ''
  Write-Host "=== 违规 $($violations.Count) 条（显示前 $MaxViolations 条）==="
  $violations | Select-Object -First $MaxViolations | ForEach-Object { Write-Host "  $_" }
  exit 1
}
if (-not $Quiet) { Write-Host ''; Write-Host '校验通过：编号、状态、证据、出处文件均合规。' }
exit 0
