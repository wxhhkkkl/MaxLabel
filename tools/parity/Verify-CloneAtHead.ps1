<#
  验收方「一键复验」：在**隔离克隆**里构建某个提交，起实例，跑全部验收工装，汇总结果，收摊。

  为什么要它：
    - 我每轮都要复验循环的产出 ✓，但手动"克隆 → 离线装依赖 → 构建 → 起实例 → 逐个跑工装 → 收摊"太啰嗦 ✗；
    - 而且**必须**用隔离克隆（不能碰主仓库的 node_modules ✗ —— 我为此出过一次事故 ✓ 见 parity/FAILURES.md），
      也不该留残留实例（我留过一个 63 分钟的实例，害得循环门禁出现"假抖动" ✗）。
  本脚本把这些纪律固化成一步 ✓：
    1) 先清扫验收方 profile 家族的 electron 残留（**绝不动循环的 maxlabel-ui-***）✓；
    2) `git clone --local` 到临时目录 → `npm install --offline` → `npm run build` ✓（全程不碰主仓库 ✓）；
    3) 用它起一个带 CDP 的实例（自己的 profile/端口 ✓）；
    4) 依次跑工装：Verify-LabelFormatDialog / Verify-ObjectTabs / Verify-BarcodePage / Verify-ObjectProps（可选加 Verify-PrintEndToEnd）✓；
    5) 打印汇总表 + 收摊 ✓。

  用法：
    powershell -File tools/parity/Verify-CloneAtHead.ps1                     # 默认 HEAD、跑四件工装
    powershell -File tools/parity/Verify-CloneAtHead.ps1 -Sha 6014a04 -WithPrint
#>
[CmdletBinding()]
param(
  [string]$Sha = 'HEAD',
  [string]$Repo = 'D:\workspace\maxlabel',
  [int]$Port = 9337,
  [switch]$WithPrint,
  [switch]$Keep
)

# ⚠️ 不能用 Stop：npm/git 会把警告写到 stderr，在 2>&1 管道下 PowerShell 视为错误并中断 ✗
$ErrorActionPreference = 'Continue'
function Step($m) { Write-Host ("[verify] {0}" -f $m) }

# ---- 0) 清扫我自己的残留（只清验收方 profile 家族 ✓）----
$minePat = 'maxlabel-(parity|clone|verifier|e2e|final|op|objprops|wt|v1[0-9]+)'
$stray = @(Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match $minePat) })
if ($stray.Count -gt 0) {
  Step ("清扫验收方残留实例 {0} 个" -f $stray.Count)
  $stray | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 2
}
$loopEl = @(Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and ($_.CommandLine -match 'maxlabel-ui-') }).Count
if ($loopEl -gt 0) { Step ("⚠️ 循环正在跑 UI（{0} 个 maxlabel-ui-* 实例）→ 本脚本仍会用**自己的 profile** 跑，但请知悉会有资源竞争" -f $loopEl) }

$short = (& git -C $Repo rev-parse --short $Sha).Trim()
Step "目标提交：$short"

# ---- 1) 隔离克隆 + 离线装依赖 + 构建 ----
$wtRoot = Join-Path $env:TEMP ("maxlabel-verify-$short")
$prof = Join-Path $env:TEMP ("maxlabel-verify-profile-$short")
$appDir = Join-Path $wtRoot 'app'
if (Test-Path -LiteralPath $wtRoot) { Step '清理上次的克隆'; Remove-Item -LiteralPath $wtRoot -Recurse -Force -ErrorAction SilentlyContinue }
Step '克隆（--local）'
& git clone --quiet --local $Repo $wtRoot | Out-Null
& git -C $wtRoot checkout --quiet --detach $short | Out-Null
Step '离线装依赖（npm install --offline）'
Push-Location $appDir
& npm.cmd install --offline --no-audit --no-fund 2>&1 | Select-Object -Last 1 | ForEach-Object { Write-Host "    $_" }
Pop-Location
if (-not (Test-Path -LiteralPath (Join-Path $appDir 'node_modules\electron\dist\electron.exe'))) {
  Push-Location $appDir; & node 'node_modules/electron/install.js' 2>&1 | Select-Object -Last 1 | ForEach-Object { Write-Host "    $_" }; Pop-Location
}
Step '构建（npm run build）'
Push-Location $appDir
& npm.cmd run build 2>&1 | Select-Object -Last 1 | ForEach-Object { Write-Host "    $_" }
Pop-Location
if (-not (Test-Path -LiteralPath (Join-Path $appDir 'out\main\index.js'))) { Write-Host '[verify] ✗ 构建失败'; exit 1 }
Step '构建完成 ✓'

# ---- 2) 起实例 ----
$exe = Join-Path $appDir 'node_modules\electron\dist\electron.exe'
Remove-Item -LiteralPath $prof -Recurse -Force -ErrorAction SilentlyContinue
Step "启动实例（port=$Port）"
Start-Process -FilePath $exe -ArgumentList '.', "--remote-debugging-port=$Port", "--user-data-dir=$prof" -WorkingDirectory $appDir | Out-Null
Start-Sleep -Seconds 12

# ---- 3) 跑工装 ----
$env:MAXLABEL_DEBUG_PORT = "$Port"
$harnesses = @('Verify-LabelFormatDialog.cjs', 'Verify-ObjectTabs.cjs', 'Verify-BarcodePage.cjs', 'Verify-ObjectProps.cjs')
if ($WithPrint) { $harnesses += 'Verify-PrintEndToEnd.cjs' }
$summary = @()
foreach ($h in $harnesses) {
  $p = Join-Path $Repo ("tools\parity\" + $h)
  if (-not (Test-Path -LiteralPath $p)) { $summary += [pscustomobject]@{ 工装 = $h; 结果 = '缺失'; 尾行 = '' }; continue }
  Step ("跑 {0}" -f $h)
  $out = & node $p 2>&1
  $code = $LASTEXITCODE
  $tail = ($out | Where-Object { $_ -match '\d+/\d+|PASS|FAIL|GAP|KNOWN-GAP' } | Select-Object -Last 2) -join ' ； '
  $summary += [pscustomobject]@{ 工装 = $h; 结果 = $(if ($code -eq 0) { '✅ 全绿' } else { '⚠️ 有红/GAP' }); 尾行 = $tail }
}

# ---- 4) 汇总 + 收摊 ----
Write-Host ''
Write-Host ("===== 一键复验汇总（提交 {0}）=====" -f $short)
$summary | Format-Table -AutoSize | Out-String | Write-Host
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*$prof*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
if (-not $Keep) { Remove-Item -LiteralPath $wtRoot -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $prof -Recurse -Force -ErrorAction SilentlyContinue }
Step '收摊完成 ✓'
