# 真机取证：把「条码属性」翻到「条码」页，把「条码符号类型(码制)」切到指定项，再导出该页的下拉与值。
#
#   powershell -File tools\parity\Probe-LabelShopSymbology.ps1 -ItemIndex 2 -Prefix ean13
#
# 真机码制下拉顺序（0 起）：0 Code 39 / 1 Code 128 / 2 EAN-13 / 3 Interleaved 25 / 4 Code 93 /
#   5 UPC-A / 6 EAN-8 / 7 UPC-E / 8 CodaBar / 9 Code 25 / 10 Matrix 25 / 11 China Post /
#   12 Pharmacode / 13 ITF 14 / 14 GS1 RSS 条码 / 15 PDF 417 / 16 QR Code / 17 Data Matrix /
#   18 汉信码 / 19 Micro QR
[CmdletBinding()]
param(
  [int]$ItemIndex = 0,
  [string]$Prefix = 'code',
  [string]$TitleLike = '*条码属性*',
  [int]$MaxTabs = 5
)
$ErrorActionPreference = 'Continue'
$outDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..\parity\reference\labelshop')).Path
$ctl = Join-Path $PSScriptRoot 'LabelShopCtl.ps1'
$combos = Join-Path $PSScriptRoot 'Probe-LabelShopCombos.ps1'
$values = Join-Path $PSScriptRoot 'Read-LabelShopDialogValues.ps1'

function Get-ComboLine {
  $out = & powershell.exe -NoProfile -File $combos -TitleLike $TitleLike -ListOnly 2>&1
  return ($out | Select-String 'count=20' | Select-Object -First 1).Line
}

# 翻到「条码」页：该页可见下拉里有 count=20 的码制下拉
$found = $false
for ($i = 0; $i -le $MaxTabs; $i++) {
  if (Get-ComboLine) { $found = $true; break }
  & powershell.exe -NoProfile -File $ctl -Action run -Steps 'keydlg:^{TAB}' -KeepOpen 2>&1 | Select-Object -Last 1
  Start-Sleep -Milliseconds 700
}
if (-not $found) { Write-Host "[sym] 翻不到带码制下拉的那一页"; exit 1 }

# 切码制（可见下拉里 index 0 就是码制）
& powershell.exe -NoProfile -File $combos -TitleLike $TitleLike -SetCombo 0 -SetIndex $ItemIndex 2>&1 |
  Select-String 'count=20|count=\d+' | Select-Object -First 1 | ForEach-Object { $_.Line }
Start-Sleep -Milliseconds 900
& powershell.exe -NoProfile -File $combos -TitleLike $TitleLike -ListOnly 2>&1 |
  Out-File -Encoding UTF8 (Join-Path $outDir "probe-sym-$Prefix-combos.txt")
& powershell.exe -NoProfile -File $values -TitleLike $TitleLike -OutFile (Join-Path $outDir "probe-sym-$Prefix-values.txt") 2>&1 |
  Select-Object -Last 1 | Out-Host
Write-Host "[sym] $Prefix 完成"
