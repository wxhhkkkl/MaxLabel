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
  'props'  = @{ file = 'parity\reference\labelshop\verifier-20c-barcode-page.png'; label = '原版 LabelShop（条码属性页）' }
  'menu'   = @{ file = 'parity\reference\labelshop\verifier-r43-file-menu.png'; label = '原版 LabelShop（文件菜单，round-43 真机）' }
  'sysset' = @{ file = 'parity\reference\labelshop\probe-r112-sysset.png'; label = '原版 LabelShop（系统设置·常规页，round-112 真机）' }
  'start'  = @{ file = 'parity\reference\labelshop\92-00-startup.png'; label = '原版 LabelShop（启始页）' }
  # 「文件 → 模板属性设置」在真机打开的就是「标签格式设置」对话框（与工具栏入口同一个；复刻版同为 TemplatePropsDialog）
  'templateprops' = @{ file = 'parity\reference\labelshop\verifier-r44-hole-circle-20b.png'; label = '原版 LabelShop（标签格式设置 = 模板属性设置，round-44 真机）' }
  # 打印机属性 → 端口页（覆盖矩阵 D-22/23/28）；printerportbox 是同态版：把「类型」切到真机那张图选的「蜂打打云盒」
  'printerport' = @{ file = 'parity\reference\labelshop\probe-15-cloudbox-port.png'; label = '原版 LabelShop（打印机属性 → 端口，probe-15 真机）' }
  'printerportbox' = @{ file = 'parity\reference\labelshop\probe-15-cloudbox-port.png'; label = '原版 LabelShop（打印机属性 → 端口 = 蜂打打云盒，probe-15 真机）' }
  # 登录对话框（覆盖 账户菜单 → 登录 等行）：真机图是 codex round-119 抓的「登录 LabelShop」实拍
  'login' = @{ file = 'parity\reference\labelshop\round119-print-dialog.png'; label = '原版 LabelShop（登录 LabelShop 对话框，round-119 真机）' }
  # 工具栏「添加或删除按钮」两级菜单（覆盖 A-121）：真机那张是在启始页拍的，两侧工具栏均可见，子菜单内容同态可比
  'toolbar' = @{ file = 'parity\reference\labelshop\91-toolbar-customize-submenu.png'; label = '原版 LabelShop（工具栏 » → 添加或删除按钮 ▸，真机）' }
  # 打印对话框（覆盖 D-02）
  'print'  = @{ file = 'parity\reference\labelshop\63-dlg-print.png'; label = '原版 LabelShop（打印对话框，真机）' }
  # 对象属性 → 条码页（覆盖 B-70/B-71）：真机图拍的就是「条码属性 → 条码」页
  'propsbarcode' = @{ file = 'parity\reference\labelshop\verifier-20c-barcode-page.png'; label = '原版 LabelShop（条码属性 → 条码页，真机 round-20）' }
  # 安装打印机列表（覆盖 D-34/D-35）
  'install' = @{ file = 'parity\reference\labelshop\probe-07-install-printer.png'; label = '原版 LabelShop（安装 LabelShop 打印机，真机 round-105）' }
  # 验收方 round-151 新增三个场景的真机对照图
  'datasource'   = @{ file = 'parity\reference\labelshop\r88-textprops-p1.png'; label = '原版 LabelShop（文字属性 → 数据源页，round-88 真机）' }
  'printdialog'  = @{ file = 'parity\reference\labelshop\probe-63-30-print-dialog.png'; label = '原版 LabelShop（打印对话框，probe-63-30 真机）' }
  'about'        = @{ file = 'parity\reference\labelshop\66-dlg-about.png'; label = '原版 LabelShop（关于对话框，真机）' }
  # 选项(O) 菜单展开态（覆盖 选项菜单 → 系统选项/应用程序外观 两行）
  'optionsmenu'  = @{ file = 'parity\reference\labelshop\r100-options-menu.png'; label = '原版 LabelShop（选项菜单展开，round-100 真机）' }
  # round-150 真机菜单一族（一次会话抓齐 10 个菜单，覆盖矩阵里"*菜单"那一族）
  'menu-edit'     = @{ file = 'parity\reference\labelshop\r150-menu-edit.png'; label = '原版 LabelShop（编辑菜单展开，round-150 真机）' }
  'menu-view'     = @{ file = 'parity\reference\labelshop\r150-menu-view.png'; label = '原版 LabelShop（查看菜单展开，round-150 真机）' }
  'menu-tool'     = @{ file = 'parity\reference\labelshop\r150-menu-tool.png'; label = '原版 LabelShop（工具菜单展开，round-150 真机）' }
  'menu-arrange'  = @{ file = 'parity\reference\labelshop\r150-menu-arrange.png'; label = '原版 LabelShop（排列菜单展开，round-150 真机）' }
  'menu-database' = @{ file = 'parity\reference\labelshop\r150-menu-database.png'; label = '原版 LabelShop（数据库菜单展开，round-150 真机）' }
  'menu-account'  = @{ file = 'parity\reference\labelshop\r150-menu-account.png'; label = '原版 LabelShop（账户菜单展开，round-150 真机）' }
  'menu-cloud'    = @{ file = 'parity\reference\labelshop\r150-menu-cloud.png'; label = '原版 LabelShop（云马通菜单展开，round-150 真机）' }
  'menu-options'  = @{ file = 'parity\reference\labelshop\r150-menu-options.png'; label = '原版 LabelShop（选项菜单展开，round-150 真机）' }
  'menu-window'   = @{ file = 'parity\reference\labelshop\r150-menu-window.png'; label = '原版 LabelShop（窗口菜单展开，round-150 真机）' }
  'menu-help'     = @{ file = 'parity\reference\labelshop\r150-menu-help.png'; label = '原版 LabelShop（帮助菜单展开，round-150 真机）' }
  # 对象属性「字体页 / 常规页」（覆盖 对象属性·字体页 / 对象属性·常规页 两个界面）
  # 真机图取自 round-88 的「文字属性」四页实拍：p1=数据源 / p2=字体 / p3=文本 / p4=常规（页签顺序按 Ctrl+Tab 实测）
  'propsfont'    = @{ file = 'parity\reference\labelshop\r88-textprops-p2.png'; label = '原版 LabelShop（文字属性 → 字体页，round-88 真机）' }
  'propsgeneral' = @{ file = 'parity\reference\labelshop\r88-textprops-p4.png'; label = '原版 LabelShop（文字属性 → 常规页，round-88 真机）' }
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
