<#
.SYNOPSIS
  图片裁剪/放大工具（取证截图局部放大用）。

.EXAMPLE
  # 裁出工具栏第一条（原图 2582 宽）
  powershell -File tools/parity/Crop-Image.ps1 -In parity/reference/labelshop/40-editor.png -Out parity/reference/labelshop/41-toolbar-row1.png -X 0 -Y 90 -W 1700 -H 60 -Scale 2
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$In,
  [Parameter(Mandatory = $true)][string]$Out,
  [int]$X = 0,
  [int]$Y = 0,
  [int]$W = 0,
  [int]$H = 0,
  [double]$Scale = 1
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $In).Path)
try {
  if ($W -le 0) { $W = $src.Width - $X }
  if ($H -le 0) { $H = $src.Height - $Y }
  if ($X + $W -gt $src.Width) { $W = $src.Width - $X }
  if ($Y + $H -gt $src.Height) { $H = $src.Height - $Y }
  $rect = New-Object System.Drawing.Rectangle $X, $Y, $W, $H
  $crop = New-Object System.Drawing.Bitmap $W, $H
  $g = [System.Drawing.Graphics]::FromImage($crop)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $W, $H), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  if ($Scale -ne 1) {
    $sw = [int]($W * $Scale); $sh = [int]($H * $Scale)
    $big = New-Object System.Drawing.Bitmap $sw, $sh
    $g2 = [System.Drawing.Graphics]::FromImage($big)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $g2.DrawImage($crop, 0, 0, $sw, $sh)
    $g2.Dispose()
    $crop.Dispose()
    $crop = $big
  }
  $outPath = $Out
  if (-not [IO.Path]::IsPathRooted($outPath)) { $outPath = Join-Path (Get-Location).Path $outPath }
  $dir = Split-Path -Parent $outPath
  if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $crop.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
  Write-Host "[crop] $outPath ($W x $H, scale $Scale)"
} finally {
  $src.Dispose()
}
