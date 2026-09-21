# 一把出「四件套」里的两件：复刻图 + 并排图（P4 流水线）
#
# 用法：
#   powershell -File tools/parity/New-ParityShot.ps1 -Round 113
#   powershell -File tools/parity/New-ParityShot.ps1 -Round 113 -Scenes choose,custom
#
# 做的事：
#   1) 用**自己的 profile 与调试端口**起一个复刻版实例（不占循环的 test:ui 独占锁）；
#   2) 对每个场景调 Capture-CloneShot.cjs 出「复刻图」到 parity/reference/maxlabel/；
#   3) 收摊（只杀自己 profile 的 electron）；
#   4) 用 Compare-SideBySide.ps1 与**已入库的真机图**拼「并排图」到 parity/review/cmp-<场景>-r<轮次>.png。
#
# 场景与真机图的对应（改动这里即可扩场景）：
#   choose → verifier-r43-choose-label.png        真机「选择标签格式」（round-43 实拍）
#   custom → verifier-r44-hole-circle-20b.png     真机「标签格式设置」（round-44：孔洞=圆洞/20）
#   editor → verifier-r43-editor-hole.png         真机编辑器（注意：真机那张是 100×20mm，默认 100×70 不可直接对比）
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][int]$Round,
  [string[]]$Scenes = @('choose', 'custom'),
  [int]$Port = 9333,
  [string]$Repo = 'D:\workspace\maxlabel'
)

$ErrorActionPreference = 'Stop'
$appDir = Join-Path $Repo 'app'
$refDir = Join-Path $Repo 'parity\reference\maxlabel'
$reviewDir = Join-Path $Repo 'parity\review'
$profileDir = Join-Path $env:TEMP 'maxlabel-parityshot-profile'

$realShot = @{
  'choose' = @{ file = 'parity\reference\labelshop\verifier-r43-choose-label.png'; label = '原版 LabelShop（round-43 真机）' }
  'custom' = @{ file = 'parity\reference\labelshop\verifier-r44-hole-circle-20b.png'; label = '原版 LabelShop（round-44 真机）' }
  'editor' = @{ file = 'parity\reference\labelshop\verifier-r43-editor-hole.png'; label = '原版 LabelShop（round-43 真机 100×20mm）' }
}

function Stop-MyElectron {
  Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$profileDir*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}

# 起实例前先确认没有别人在跑 UI（宁可跳过，也不去抢锁）
$busy = @(Get-Process electron -ErrorAction SilentlyContinue).Count
if ($busy -gt 0) {
  Write-Host "[parity-shot] 检测到 $busy 个 electron 正在运行（多半是循环的 UI 回归）——为避免抢资源，本次不做，稍后重试。"
  exit 3
}

Stop-MyElectron
Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue

$exe = Join-Path $appDir 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "找不到 electron：$exe" }

Start-Process -FilePath $exe -ArgumentList '.', "--remote-debugging-port=$Port", "--user-data-dir=$profileDir" -WorkingDirectory $appDir | Out-Null
Start-Sleep -Seconds 11

$made = @()
try {
  foreach ($scene in $Scenes) {
    if (-not $realShot.ContainsKey($scene)) { Write-Host "[parity-shot] 跳过未知场景 '$scene'"; continue }
    $cloneOut = Join-Path $refDir ("clone-{0}-r{1}.png" -f $scene, $Round)
    Write-Host "[parity-shot] 抓复刻图：scene=$scene"
    node (Join-Path $Repo 'tools\parity\Capture-CloneShot.cjs') --port $Port --scene $scene --out $cloneOut
    if ($LASTEXITCODE -ne 0) { Write-Host "[parity-shot] 场景 $scene 抓图失败（exit=$LASTEXITCODE），跳过"; continue }
    $made += [pscustomobject]@{ scene = $scene; clone = $cloneOut }
  }
} finally {
  Stop-MyElectron
}

New-Item -ItemType Directory -Force -Path $reviewDir | Out-Null
foreach ($m in $made) {
  $cmp = Join-Path $reviewDir ("cmp-{0}-r{1}.png" -f $m.scene, $Round)
  $left = Join-Path $Repo $realShot[$m.scene].file
  if (-not (Test-Path -LiteralPath $left)) { Write-Host "[parity-shot] 真机图缺失：$left"; continue }
  powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Repo 'tools\parity\Compare-SideBySide.ps1') `
    -Left $left -Right $m.clone -Out $cmp `
    -LabelLeft $realShot[$m.scene].label -LabelRight ("复刻版 MaxLabel（round-{0} 构建）" -f $Round) | Out-Null
  Write-Host ("[parity-shot] 并排图 → {0}" -f $cmp)
}
Write-Host ("[parity-shot] 完成：复刻图 {0} 张，并排图 {0} 张（round {1}）" -f $made.Count, $Round)
