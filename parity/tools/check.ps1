$ErrorActionPreference = 'Stop'
$root = 'D:\workspace\maxlabel\parity'
$body = Join-Path $root '_work\rows\_body.md'
if (-not (Test-Path $body)) { Write-Output 'no body yet'; exit }
$srcDir = 'D:\workspace\maxlabel\app\docs\labelshop-help-zh'
$allFiles = Get-ChildItem "$srcDir\*.html" | Select-Object -ExpandProperty Name
$perFile = Get-Content (Join-Path $root '_work\rows\_perfile.json') -Raw -Encoding UTF8 | ConvertFrom-Json

$txt = Get-Content $body -Raw -Encoding UTF8
$rows = $txt -split "`r?`n" | Where-Object { $_ -match '^\| [A-E]-\d+ \|' }
"rows: $($rows.Count)"

$bad = $rows | Where-Object { $_ -match '<(p|br|div|font|img|span|table|tr|td|h[1-6]|b|i|u|li|ul|ol|a|script|style|body|html)[ />]' -or $_ -match '&nbsp;|&amp;|&lt;|&gt;' }
"residue rows: $($bad.Count)"
$bad | Select-Object -First 15 | ForEach-Object { $_.Substring(0,[Math]::Min(160,$_.Length)) }

$img = $rows | Where-Object { $_ -match '\.png|\.jpg|\.gif|Image/' }
"image refs: $($img.Count)"

$dups = $rows | ForEach-Object { $c = ($_ -split '\|')[2].Trim(); $s = ($_ -split '\|')[1].Trim(); "$s :: $c" } | Group-Object | Where-Object Count -gt 1
"dup 功能点 (same section): $($dups.Count)"
$dups | Select-Object -First 10 | ForEach-Object { "$($_.Count)x $($_.Name)" }

$badstatus = $rows | Where-Object { (($_ -split '\|')[5]).Trim() -ne '待核' }
"rows with status != 待核: $($badstatus.Count)"
$badstatus | Select-Object -First 5 | ForEach-Object { $_.Substring(0,[Math]::Min(140,$_.Length)) }

$badCols = $rows | Where-Object { ($_.ToCharArray() | Where-Object { $_ -eq '|' }).Count -ne 7 }
"rows with pipe count != 7: $($badCols.Count)"
$badCols | Select-Object -First 8 | ForEach-Object { "[" + (($_.ToCharArray() | Where-Object {$_ -eq '|'}).Count) + "] " + $_.Substring(0,[Math]::Min(140,$_.Length)) }

$shortFn = $rows | Where-Object { (($_ -split '\|')[2]).Trim().Length -lt 6 }
"功能点 too short: $($shortFn.Count)"
$shortBeh = $rows | Where-Object { (($_ -split '\|')[3]).Trim().Length -lt 6 }
"要点 too short: $($shortBeh.Count)"

$badSrc = @()
foreach ($r in $rows) {
  $c = ($r -split '\|')
  $id = $c[1].Trim(); $src = $c[4].Trim()
  foreach ($f in ($src -split '[,，;；]')) {
    $f = $f.Trim(); if ($f -eq '') { continue }
    if ($allFiles -notcontains $f) { $badSrc += "$id -> $f" }
  }
}
"bad source names: $($badSrc.Count)"
$badSrc | Select-Object -First 10

foreach ($k in 'A','B','C','D','E') { "$k : " + (@($rows | Where-Object { $_ -match "^\| $k-\d+ \|" }).Count) }

$covered = @(); foreach ($p in $perFile.PSObject.Properties) { $covered += $p.Name }
$missing = $allFiles | Where-Object { $covered -notcontains $_ }
"covered: $($covered.Count) / $($allFiles.Count)"
"missing: " + ($missing -join ', ')
