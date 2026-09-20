# 真机取证：把一个多页属性对话框**逐页**导出（每页：下拉全部选项 + 输入框的值）。
#
#   powershell -File tools\parity\Probe-LabelShopPropertyPages.ps1 -TitleLike '*条码属性*' -Pages 5 -Prefix barcode
#
# 用法前提：对话框已经打开（例如用 Invoke-LabelShopSteps.ps1 走 `keys:%{ENTER}`）。
# 翻页用 `keydlg:^{TAB}`（MFC 属性表标准行为），每翻一页导出一份文件到 parity\reference\labelshop\。
[CmdletBinding()]
param(
  [string]$TitleLike = '*属性*',
  [int]$Pages = 5,
  [string]$Prefix = 'props',
  [int]$SetComboIndex = -1,
  [int]$SetItemIndex = -1
)
$ErrorActionPreference = 'Continue'
$outDir = Join-Path $PSScriptRoot '..\..\parity\reference\labelshop'
$outDir = (Resolve-Path $outDir).Path
$ctl = Join-Path $PSScriptRoot 'LabelShopCtl.ps1'
$combos = Join-Path $PSScriptRoot 'Probe-LabelShopCombos.ps1'
$values = Join-Path $PSScriptRoot 'Read-LabelShopDialogValues.ps1'

for ($page = 1; $page -le $Pages; $page++) {
  $suffix = "$Prefix-page$page"
  Write-Host "===== 第 $page 页 -> $suffix ====="
  try {
    & powershell.exe -NoProfile -File $combos -TitleLike $TitleLike -ListOnly 2>&1 |
      Out-File -Encoding UTF8 (Join-Path $outDir "probe-$suffix-combos.txt")
    & powershell.exe -NoProfile -File $values -TitleLike $TitleLike -OutFile (Join-Path $outDir "probe-$suffix-values.txt") 2>&1 | Out-Host
  } catch {
    Write-Host "[pages] 第 $page 页导出失败：$($_.Exception.Message)"
  }

  # 指定了「把第 N 个下拉切到第 M 项」时，在当前页执行一次再导出下一份
  if ($SetComboIndex -ge 0 -and $SetItemIndex -ge 0) {
    & powershell.exe -NoProfile -File $combos -TitleLike $TitleLike -ListOnly -SetCombo $SetComboIndex -SetIndex $SetItemIndex 2>&1 | Out-Host
    & powershell.exe -NoProfile -File $values -TitleLike $TitleLike -OutFile (Join-Path $outDir "probe-$suffix-after-set.txt") 2>&1 | Out-Host
  }

  & powershell.exe -NoProfile -File $ctl -Action run -Steps 'keydlg:^{TAB}' -KeepOpen 2>&1 | Select-Object -Last 1
  Start-Sleep -Milliseconds 600
}
