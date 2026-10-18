Add-Type -AssemblyName System.Drawing
$out = Join-Path (Get-Location) "build"
if (!(Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }
$px = 512
$bmp = [System.Drawing.Bitmap]::new($px, $px)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(255, 250, 249, 246))
$rx = 16; $ry = 16; $rw = $px - 32; $rh = $px - 32
$radius = 90
$d = $radius * 2
$path = [System.Drawing.Drawing2D.GraphicsPath]::new()
$path.AddArc($rx, $ry, $d, $d, 180, 90)
$path.AddArc($rx + $rw - $d, $ry, $d, $d, 270, 90)
$path.AddArc($rx + $rw - $d, $ry + $rh - $d, $d, $d, 0, 90)
$path.AddArc($rx, $ry + $rh - $d, $d, $d, 90, 90)
$path.CloseFigure()
$c1 = [System.Drawing.Color]::FromArgb(255, 34, 189, 237)
$c2 = [System.Drawing.Color]::FromArgb(255, 18, 132, 175)
$fill = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Rectangle]::new($rx, $ry, $rw, $rh), $c1, $c2, 45.0)
$g.FillPath($fill, $path)
$pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 20)
$g.DrawLine($pen, 140, 370, 140, 160)
$g.DrawLine($pen, 140, 160, 256, 310)
$g.DrawLine($pen, 256, 310, 372, 160)
$g.DrawLine($pen, 372, 160, 372, 370)
$bp = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 14)
$y = 396
$xs = @(140, 170, 200, 230, 260, 290, 320, 350)
$ws2 = @(24, 14, 30, 18, 26, 14, 32, 16)
for ($i = 0; $i -lt $xs.Count; $i++) {
  $g.DrawLine($bp, $xs[$i], $y, $xs[$i] + $ws2[$i], $y)
}
$iconFile = Join-Path $out "icon.png"
$bmp.Save($iconFile, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Host "icon.png generated: $((Get-Item $iconFile).Length) bytes"
