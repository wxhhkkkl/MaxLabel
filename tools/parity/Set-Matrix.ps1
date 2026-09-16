<#
.SYNOPSIS
  把 parity/matrix.md 里指定编号的「复刻状态 / 证据」列改成指定值（验收方落账用）。

.DESCRIPTION
  验收方（循环控制者）在确认某轮工作后，用本脚本把对应条目标为 已实现/部分/未实现，
  并写入证据。避免手工编辑 600 行表格。

.EXAMPLE
  powershell -File tools/parity/Set-Matrix.ps1 -Ids A-01,A-02,A-09 -Status 已实现 -Evidence "ui-v52.cjs 快捷键断言 8/8；截图 parity/reference/maxlabel/13-menu-view.png"
  powershell -File tools/parity/Set-Matrix.ps1 -Ids A-05 -Status 部分 -Evidence "字段顺序已对齐，标签规格串仍缺枚数/盒数" -DryRun
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string[]]$Ids,
  [Parameter(Mandatory = $true)][ValidateSet('待核', '已实现', '部分', '未实现')][string]$Status,
  [string]$Evidence = '',
  [string]$MatrixPath,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $MatrixPath) { $MatrixPath = Join-Path $repo 'parity\matrix.md' }
if (-not (Test-Path -LiteralPath $MatrixPath)) { Write-Error "找不到清单：$MatrixPath"; exit 2 }

if (($Status -eq '已实现' -or $Status -eq '部分') -and [string]::IsNullOrWhiteSpace($Evidence)) {
  Write-Error "状态为「$Status」时必须给 -Evidence（清单校验会因此失败）"
  exit 2
}

$targets = @{}
foreach ($id in $Ids) {
  foreach ($one in ($id -split ',')) {
    $t = $one.Trim()
    if ($t) { $targets[$t] = $true }
  }
}

$lines = Get-Content -LiteralPath $MatrixPath -Encoding UTF8
$changed = 0
$missing = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]
  if (-not $line.TrimStart().StartsWith('|')) { continue }
  $cells = $line.Trim().Trim('|') -split '\|' | ForEach-Object { $_.Trim() }
  if ($cells.Count -ne 6) { continue }
  $id = $cells[0]
  if (-not $targets.ContainsKey($id)) { continue }
  $targets.Remove($id)
  $old = "| $($cells[0]) | $($cells[1]) | $($cells[2]) | $($cells[3]) | $($cells[4]) | $($cells[5]) |"
  $newLine = "| $($cells[0]) | $($cells[1]) | $($cells[2]) | $($cells[3]) | $Status | $Evidence |"
  if ($line.Trim() -ne $newLine) {
    Write-Host "[$id] $($cells[4]) -> $Status   证据: $Evidence"
    $lines[$i] = $newLine
    $changed++
  }
}
foreach ($k in $targets.Keys) { $missing += $k }
if ($missing.Count -gt 0) { Write-Host "[warn] 清单里找不到这些编号：$($missing -join ', ')" }

if ($DryRun) { Write-Host "[dry-run] 将改动 $changed 行（未写盘）"; exit 0 }

if ($changed -gt 0) {
  # matrix.md 原本是 UTF-8 无 BOM，保持一致
  [IO.File]::WriteAllLines($MatrixPath, $lines, (New-Object Text.UTF8Encoding($false)))
  Write-Host "已更新 $changed 行：$MatrixPath"
} else {
  Write-Host '没有需要改动的行'
}
