<#
.SYNOPSIS
  并排对照图：把真机截图（左）与复刻版截图（右）等比缩放到同高拼接，便于逐轮视觉验收。

.EXAMPLE
  powershell -File tools/parity/Compare-SideBySide.ps1 -Left parity/reference/labelshop/40-editor.png -Right parity/reference/maxlabel/00-main.png -Out parity/review/r04-main.png
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Left,
  [Parameter(Mandatory = $true)][string]$Right,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$Height = 900,
  [int]$Gap = 16,
  [string]$LabelLeft = '原版 LabelShop',
  [string]$LabelRight = '复刻版 MaxLabel'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Resolve-PathSafe {
  param([string]$P)
  if (-not [IO.Path]::IsPathRooted($P)) { $P = Join-Path (Get-Location).Path $P }
  if (-not (Test-Path -LiteralPath $P)) { throw "找不到图片：$P" }
  return (Resolve-Path -LiteralPath $P).Path
}

$l = [System.Drawing.Image]::FromFile((Resolve-PathSafe $Left))
$r = [System.Drawing.Image]::FromFile((Resolve-PathSafe $Right))
try {
  $lw = [int]($l.Width * ($Height / $l.Height))
  $rw = [int]($r.Width * ($Height / $r.Height))
  $barH = 40
  $W = $lw + $rw + $Gap
  $H = $Height + $barH
  $canvas = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.Clear([System.Drawing.Color]::FromArgb(32, 32, 32))
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($l, 0, $barH, $lw, $Height)
  $g.DrawImage($r, ($lw + $Gap), $barH, $rw, $Height)

  $font = New-Object System.Drawing.Font 'Microsoft YaHei', 18, ([System.Drawing.FontStyle]::Bold)
  $brush = [System.Drawing.Brushes]::White
  $g.DrawString($LabelLeft, $font, $brush, 8, 6)
  $g.DrawString($LabelRight, $font, $brush, ($lw + $Gap + 8), 6)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(120, 200, 255)), 3
  $g.DrawLine($pen, ($lw + [int]($Gap / 2)), 0, ($lw + [int]($Gap / 2)), $H)
  $g.Dispose(); $font.Dispose(); $pen.Dispose()

  $outPath = $Out
  if (-not [IO.Path]::IsPathRooted($outPath)) { $outPath = Join-Path (Get-Location).Path $outPath }
  $dir = Split-Path -Parent $outPath
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $canvas.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Dispose()
  Write-Host "[side-by-side] $outPath  ($lw x $Height | $rw x $Height)"
} finally {
  $l.Dispose(); $r.Dispose()
}
