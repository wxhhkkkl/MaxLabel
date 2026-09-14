$ErrorActionPreference = 'Stop'
$root = 'D:\workspace\maxlabel\parity'
$rowsDir = Join-Path $root '_work\rows'
$srcDir = 'D:\workspace\maxlabel\app\docs\labelshop-help-zh'
$allFiles = Get-ChildItem "$srcDir\*.html" | Select-Object -ExpandProperty Name

function Split-Row([string]$line) {
  $t = $line.Trim()
  $t = $t.Trim('|')
  return ($t -split '\|')
}

function Clean-Cell([string]$c) {
  $c = $c.Trim()
  $c = $c -replace '(?i)&nbsp;', ' '
  $c = $c -replace '(?i)&amp;', '&'
  $c = $c -replace '(?i)&lt;', '<'
  $c = $c -replace '(?i)&gt;', '>'
  $c = $c -replace '(?i)&quot;', '"'
  $c = $c -replace '\s+', ' '
  $c = $c.Trim()
  return $c
}

function Is-Src([string]$c) {
  if ($c -eq '') { return $false }
  $parts = $c -split '[,，;；]'
  foreach ($p in $parts) {
    $p = $p.Trim()
    if ($p -eq '') { continue }
    if (-not ($p -match '^[A-Za-z0-9_]+\.html$')) { return $false }
  }
  return $true
}

function Parse-Row([string]$line, [string[]]$known) {
  # returns @{fn; beh; src} or $null
  $cells = Split-Row $line
  $v = @()
  foreach ($c in $cells) { $v += (Clean-Cell $c) }
  # drop a single leading empty cell (numbering placeholder) and trailing empties
  if ($v.Count -gt 0 -and $v[0] -eq '') { $v = @($v[1..($v.Count - 1)]) }
  while ($v.Count -gt 0 -and $v[$v.Count - 1] -eq '') { $v = @($v[0..($v.Count - 2)]) }
  # now expect: fn, beh..., src, 待核 [, evidence]
  if ($v.Count -lt 4) { return $null }
  if ($v[$v.Count - 1] -eq '待核') { $v = @($v[0..($v.Count - 2)]) }
  # last remaining cell must be the source list
  $src = $v[$v.Count - 1]
  if (-not (Is-Src $src)) { return $null }
  $fn = $v[0]
  if ($v.Count -ge 3) {
    $beh = (($v[1..($v.Count - 2)]) -join '；')
  } else {
    $beh = ''
  }
  if ($fn -eq '' -or $beh -eq '') { return $null }
  return @{ fn = $fn; beh = $beh; src = $src }
}

$sections = [ordered]@{
  'A' = @('A. 界面与操作习惯', @('A.md', 'A2.md'))
  'B' = @('B. 编辑器对象能力', @('B.md', 'B2.md'))
  'C' = @('C. 数据源与数据库', @('C.md'))
  'D' = @('D. 打印链路', @('D.md'))
  'E' = @('E. 其他（安装 / 注册 / 升级 / 云模板 / 共享模板 / 帮助 / 关于）', @('E.md'))
}

$perFile = @{}
$sectionCounts = [ordered]@{}
$seenFn = @{}
$body = New-Object System.Text.StringBuilder
$warnings = New-Object System.Collections.Generic.List[string]

foreach ($key in $sections.Keys) {
  $sec = $sections[$key][0]
  $rowFiles = $sections[$key][1]
  $n = 0
  [void]$body.AppendLine("## $sec")
  [void]$body.AppendLine('')
  [void]$body.AppendLine('| 编号 | 功能点 | 原版行为要点 | 出处文件 | 复刻状态 | 证据 |')
  [void]$body.AppendLine('| --- | --- | --- | --- | --- | --- |')
  $lines = @()
  foreach ($rf in $rowFiles) {
    $fp = Join-Path $rowsDir $rf
    if (-not (Test-Path $fp)) { $warnings.Add("MISSING row file: $rf"); continue }
    $lines += ([System.IO.File]::ReadAllLines($fp, (New-Object System.Text.UTF8Encoding($false))))
  }
  foreach ($line in $lines) {
    if ($line -notmatch '\S') { continue }
    if ($line -match '^\s*\|?\s*-{2,}') { continue }
    if ($line -match '^\s*#') { continue }
    $p = Parse-Row $line $allFiles
    if ($p -eq $null) { $warnings.Add("$key unparsed: $($line.Substring(0,[Math]::Min(90,$line.Length)))"); continue }
    if ($seenFn.ContainsKey($p.fn)) { $warnings.Add("$key dup-skipped: $($p.fn)"); continue }
    $seenFn[$p.fn] = $true
    $n++
    $id = '{0}-{1:d2}' -f $key, $n
    $srcOut = (($p.src -split '[,，;；]' | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }) -join ', ')
    foreach ($f in ($srcOut -split ', ')) {
      if ($allFiles -notcontains $f) { $warnings.Add("$id unknown source: $f") }
      if (-not $perFile.ContainsKey($f)) { $perFile[$f] = New-Object System.Collections.Generic.List[string] }
      if (-not $perFile[$f].Contains($id)) { $perFile[$f].Add($id) }
    }
    [void]$body.AppendLine("| $id | $($p.fn) | $($p.beh) | $srcOut | 待核 |  |")
  }
  [void]$body.AppendLine('')
  $sectionCounts[$key] = $n
}

$missing = @()
foreach ($f in $allFiles) { if (-not $perFile.ContainsKey($f)) { $missing += $f } }

"===== section counts ====="
$tot = 0
foreach ($k in $sectionCounts.Keys) { "$k : $($sectionCounts[$k])"; $tot += $sectionCounts[$k] }
"TOTAL ROWS: $tot"
"covered files: $($perFile.Keys.Count) / $($allFiles.Count)"
"MISSING FILES: " + ($missing -join ', ')
"===== warnings ($($warnings.Count)) ====="
$warnings | Select-Object -First 40 | ForEach-Object { $_ }

$u8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Join-Path $rowsDir '_perfile.json'), ($perFile | ConvertTo-Json -Depth 4), $u8)
[System.IO.File]::WriteAllText((Join-Path $rowsDir '_body.md'), $body.ToString(), $u8)
[System.IO.File]::WriteAllText((Join-Path $rowsDir '_missing.txt'), ($missing -join "`n"), $u8)
"WROTE: " + (Test-Path (Join-Path $rowsDir '_body.md'))
