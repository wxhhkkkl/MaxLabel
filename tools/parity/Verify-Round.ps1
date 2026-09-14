<#
.SYNOPSIS
  一轮验收：抓复刻版截图 → 生成与真机的并排对照图 → 校验 parity 清单 → 打印待人工审阅清单。

.DESCRIPTION
  这是"验收方"（循环控制者）用的脚本，不参与 Codex 的实现。每轮 Codex 结束后跑一次：
    - 复刻版截图落到 parity/reference/maxlabel/
    - 并排对照图落到 parity/review/（原版左、复刻版右）
    - 清单完整性用 Check-Matrix.ps1 校验
  人工随后只需 read_image 看 parity/review/ 下的对照图，把差异写进 parity/diffs.md。

.EXAMPLE
  powershell -File tools/parity/Verify-Round.ps1 -Round 5
  powershell -File tools/parity/Verify-Round.ps1 -Round 5 -SkipCapture
#>
[CmdletBinding()]
param(
  [int]$Round = 0,
  [string]$Repo = 'D:\workspace\maxlabel',
  [switch]$SkipCapture,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Continue'
$Repo = (Resolve-Path -LiteralPath $Repo).Path
$RefLs = Join-Path $Repo 'parity\reference\labelshop'
$RefMl = Join-Path $Repo 'parity\reference\maxlabel'
$Review = Join-Path $Repo 'parity\review'
New-Item -ItemType Directory -Force -Path $Review | Out-Null
$tag = if ($Round -gt 0) { "r{0:D2}" -f $Round } else { 'rXX' }

function Section([string]$t) { Write-Host ''; Write-Host "=== $t ===" }

# ---------------- 1. 抓复刻版 ----------------
if (-not $SkipCapture) {
  Section '抓取复刻版截图（CDP）'
  $mb = Join-Path $Repo 'tools\parity\MaxLabelCtl.ps1'
  $args = @('-Action', 'run', '-Scenario', (Join-Path $Repo 'tools\parity\scenarios\editor.json'))
  if ($SkipBuild) { $args += '-NoBuild' }
  & powershell -NoProfile -ExecutionPolicy Bypass -File $mb @args 2>&1 | Select-Object -Last 6
  # 起始页单独抓（新 profile，回到起始页）
  Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  $args2 = @('-Action', 'run', '-Scenario', (Join-Path $Repo 'tools\parity\scenarios\main.json'))
  if ($SkipBuild) { $args2 += '-NoBuild' }
  & powershell -NoProfile -ExecutionPolicy Bypass -File $mb @args2 2>&1 | Select-Object -Last 4
  Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

# ---------------- 2. 并排对照图 ----------------
Section '生成并排对照图'
$cmp = Join-Path $Repo 'tools\parity\Compare-SideBySide.ps1'
$pairs = @(
  @{ name = "$tag-startpage"; ref = '00-main.png';                 mine = '00-main.png';                 h = 700; l = '原版 起始页'; m = '复刻版 起始页' },
  @{ name = "$tag-editor";    ref = '40-editor.png';               mine = '02-editor.png';               h = 760; l = '原版 编辑态'; m = '复刻版 编辑态' },
  @{ name = "$tag-newlabel";  ref = '60-dlg-choose-label.png';     mine = '01-new-label-dialog.png';     h = 700; l = '原版 选择标签格式'; m = '复刻版 新建标签' },
  @{ name = "$tag-menu-file"; ref = '50-editor-menu-file.png';     mine = '11-menu-file.png';            h = 480; l = '原版 文件菜单'; m = '复刻版 文件菜单' },
  @{ name = "$tag-menu-edit"; ref = '51-editor-menu-edit.png';     mine = '12-menu-edit.png';            h = 420; l = '原版 编辑菜单'; m = '复刻版 编辑菜单' },
  @{ name = "$tag-menu-view"; ref = '52-editor-menu-view.png';     mine = '13-menu-view.png';            h = 420; l = '原版 查看菜单'; m = '复刻版 查看菜单' },
  @{ name = "$tag-menu-tools";ref = '53-editor-menu-tools.png';    mine = '14-menu-tools.png';           h = 480; l = '原版 工具菜单'; m = '复刻版 工具菜单' },
  @{ name = "$tag-menu-arr";  ref = '54-editor-menu-arrange.png';  mine = '15-menu-arrange.png';         h = 480; l = '原版 排列菜单'; m = '复刻版 排列菜单' },
  @{ name = "$tag-menu-db";   ref = '55-editor-menu-database.png'; mine = '16-menu-database.png';        h = 420; l = '原版 数据库菜单'; m = '复刻版 数据库菜单' },
  @{ name = "$tag-menu-opt";  ref = '56-editor-menu-option.png';   mine = '17-menu-options.png';         h = 420; l = '原版 选项菜单'; m = '复刻版 选项菜单' },
  @{ name = "$tag-menu-help"; ref = '58-editor-menu-help.png';     mine = '18-menu-help.png';            h = 420; l = '原版 帮助菜单'; m = '复刻版 帮助菜单' }
)
$made = @()
foreach ($p in $pairs) {
  $l = Join-Path $RefLs $p.ref
  $r = Join-Path $RefMl $p.mine
  if (-not (Test-Path -LiteralPath $l)) { Write-Host "[skip] 缺原版截图 $($p.ref)"; continue }
  if (-not (Test-Path -LiteralPath $r)) { Write-Host "[skip] 缺复刻版截图 $($p.mine)"; continue }
  $out = Join-Path $Review ("$($p.name).png")
  & powershell -NoProfile -ExecutionPolicy Bypass -File $cmp -Left $l -Right $r -Out $out -Height $p.h -LabelLeft $p.l -LabelRight $p.m 2>&1 | Select-Object -Last 1
  $made += $out
}

# ---------------- 3. 清单校验 ----------------
Section 'parity 清单校验'
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Repo 'tools\parity\Check-Matrix.ps1') 2>&1 | Select-Object -Last 12

# ---------------- 4. 待审清单 ----------------
Section '待人工审阅'
Write-Host "对照图目录：$Review"
foreach ($m in $made) { Write-Host "  $m" }
Write-Host ''
Write-Host '审阅要点：'
Write-Host '  1. 起始页：左栏分区/客服三行/开始列表文案（原版用「模版」）/最近列表/右区内容块'
Write-Host '  2. 编辑态：菜单栏 12 项与顺序、三行工具栏（工具栏/格式栏/对齐栏）、状态栏 5 段文案与格式、图层面板 6 按钮'
Write-Host '  3. 菜单：逐项文案、分隔线、禁用态、加速键字母是否与真机一致'
Write-Host '  4. 打印面板：不应出现那 5 个复选框；标题应为「打印 - <文档名>」'
Write-Host '  5. 把发现的差异写进 parity/diffs.md，并据此写下一轮 tools/loop/round-focus.md'
