# 真机取证：对一批码制逐个切换并导出「条码」页的下拉与值（前提：条码属性对话框已停在「条码」页）。
#
#   powershell -File tools\parity\Probe-LabelShopSymbologyBatch.ps1
#
# 真机码制下拉顺序（0 起）：0 Code 39 / 1 Code 128 / 2 EAN-13 / 3 Interleaved 25 / 4 Code 93 /
#   5 UPC-A / 6 EAN-8 / 7 UPC-E / 8 CodaBar / 9 Code 25 / 10 Matrix 25 / 11 China Post /
#   12 Pharmacode / 13 ITF 14 / 14 GS1 RSS 条码 / 15 PDF 417 / 16 QR Code / 17 Data Matrix /
#   18 汉信码 / 19 Micro QR
[CmdletBinding()]
param(
  [string]$TitleLike = '*条码属性*'
)
$ErrorActionPreference = 'Continue'
$outDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..\parity\reference\labelshop')).Path
$combos = Join-Path $PSScriptRoot 'Probe-LabelShopCombos.ps1'
$values = Join-Path $PSScriptRoot 'Read-LabelShopDialogValues.ps1'

$targets = @(
  @{ i = 0;  name = 'code39' },
  @{ i = 3;  name = 'interleaved25' },
  @{ i = 4;  name = 'code93' },
  @{ i = 5;  name = 'upca' },
  @{ i = 6;  name = 'ean8' },
  @{ i = 7;  name = 'upce' },
  @{ i = 8;  name = 'codabar' },
  @{ i = 9;  name = 'code25' },
  @{ i = 10; name = 'matrix25' },
  @{ i = 11; name = 'chinapost' },
  @{ i = 12; name = 'pharmacode' },
  @{ i = 13; name = 'itf14' },
  @{ i = 14; name = 'rss' },
  @{ i = 15; name = 'pdf417' },
  @{ i = 16; name = 'qrcode' },
  @{ i = 17; name = 'datamatrix' },
  @{ i = 18; name = 'hanxin' },
  @{ i = 19; name = 'microqr' }
)

$ctl = Join-Path $PSScriptRoot 'LabelShopCtl.ps1'

# 先确保停在「条码」页：该页的可见下拉里有 count=20 的码制下拉；否则 Ctrl+Tab 找过去。
$onBarcodePage = $false
for ($k = 0; $k -le 4; $k++) {
  $out = & powershell.exe -NoProfile -File $combos -TitleLike $TitleLike -ListOnly 2>&1
  if ($out | Select-String 'count=20') { $onBarcodePage = $true; break }
  & powershell.exe -NoProfile -File $ctl -Action run -Steps 'keydlg:^{TAB}' -KeepOpen 2>&1 | Out-Null
  Start-Sleep -Milliseconds 800
}
if (-not $onBarcodePage) { Write-Host '[batch] 翻不到带码制下拉的那一页，放弃'; exit 1 }
Write-Host '[batch] 已在「条码」页'

foreach ($t in $targets) {
  Write-Host "===== 切到 $($t.name)（index $($t.i)）====="
  & powershell.exe -NoProfile -File $combos -TitleLike $TitleLike -SetCombo 0 -SetIndex $t.i 2>&1 |
    Select-String '\[cb\]|cur=' | Select-Object -Last 2 | ForEach-Object { Write-Host $_.Line }
  Start-Sleep -Milliseconds 700
  & powershell.exe -NoProfile -File $combos -TitleLike $TitleLike -ListOnly 2>&1 |
    Out-File -Encoding UTF8 (Join-Path $outDir "probe-sym-$($t.name)-combos.txt")
  & powershell.exe -NoProfile -File $values -TitleLike $TitleLike -OutFile (Join-Path $outDir "probe-sym-$($t.name)-values.txt") 2>&1 |
    Select-Object -Last 1 | ForEach-Object { Write-Host $_ }
}
