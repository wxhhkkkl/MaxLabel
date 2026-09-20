# 从文本文件读取步骤并驱动 LabelShop（避免 shell 引号/`^` 被吃掉）
# 用法：powershell -File tools\parity\Invoke-LabelShopSteps.ps1 -StepsFile tools\parity\steps\xxx.txt
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$StepsFile,
  [switch]$Close
)
$ErrorActionPreference = 'Stop'
$path = (Resolve-Path -LiteralPath $StepsFile).Path
$list = @(Get-Content -LiteralPath $path -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' -and -not $_.StartsWith('#') })
Write-Host ("[steps] {0} 条：{1}" -f $list.Count, ($list -join ' | '))
$ctl = Join-Path $PSScriptRoot 'LabelShopCtl.ps1'
if ($Close) { & $ctl -Action run -Steps $list } else { & $ctl -Action run -Steps $list -KeepOpen }
