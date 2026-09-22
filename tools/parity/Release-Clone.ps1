<#
  验收方发布工装（round-120 新增）：一条命令完成"改版本号 → 打包 → 自算 SHA256 → 登记"。
  用法：
    powershell -File tools/parity/Release-Clone.ps1 -Version 1.0.20
    powershell -File tools/parity/Release-Clone.ps1 -Version 1.0.20 -DryRun     # 只做前置检查，不打包

  安全前置（任一不满足就拒绝，防止"半成品树打包"或"抢门禁资源"）：
    ① 没有 electron 在跑（复用 Assert-NoUiRun.ps1）；② 工作区干净（无未提交改动）；
    ③ 该版本号的 exe 还不存在（避免覆盖旧产物）。
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Version,
  [string]$Repo = 'D:\workspace\maxlabel',
  [switch]$DryRun
)

$ErrorActionPreference = 'Continue'
$repo = (Resolve-Path -LiteralPath $Repo).Path
$app = Join-Path $repo 'app'
$pkgPath = Join-Path $app 'package.json'
$exePath = Join-Path $app "release\MaxLabel-Setup-$Version.exe"
$shaPath = Join-Path $repo 'RELEASE-SHA256.txt'

function Fail($msg) { Write-Host "[release] ✗ $msg"; exit 1 }
function Ok($msg) { Write-Host "[release] ✓ $msg" }

# ---- ① 没有 electron 在跑 ----
$el = @(Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction SilentlyContinue)
if ($el.Count -gt 0) { Fail "检测到 $($el.Count) 个 electron 正在运行（可能在跑 UI 门禁）→ 不打包" }
Ok '无 electron 在跑'

# ---- ② 工作区干净（只看**产品源码**）----
# round-153 放宽：原来要求"整个工作区干净"，但循环在跑的时候总会有台账/证据文件在途（parity/*.md、tools/loop/*）
# —— 它们**不影响打包产物**，却会让发布一直排不上队 ✗。真正要防的是"打出半成品的产品树"，
# 所以这里只卡 `app/src` / `app/scripts` / `app/package.json` / `app/electron.vite.config.*`。
$srcPaths = @('app/src', 'app/scripts', 'app/package.json', 'app/electron.vite.config.ts', 'app/electron.vite.config.mjs')
$dirtySrc = @(git -C $repo status --porcelain -- $srcPaths)
$dirtyAll = @(git -C $repo status --porcelain)
if ($dirtySrc.Count -gt 0) { Fail "产品源码有 $($dirtySrc.Count) 项未提交改动 → 先提交再打包（避免打出半成品产品树）：`n$($dirtySrc -join "`n")" }
Ok "产品源码干净（工作区其它在途文件 $($dirtyAll.Count) 项：台账/证据，不影响产物）"

# ---- ③ 目标产物不存在 ----
if (Test-Path -LiteralPath $exePath) { Fail "产物已存在：$exePath（换个版本号或先删掉它）" }
Ok "产物路径可用：app\release\MaxLabel-Setup-$Version.exe"

# ---- 改版本号 ----
$raw = [IO.File]::ReadAllText($pkgPath, [Text.UTF8Encoding]::new($false))
$hasBom = ([IO.File]::ReadAllBytes($pkgPath))[0..2] -join ',' -eq '239,187,191'
$old = [regex]::Match($raw, '"version"\s*:\s*"([^"]+)"')
if (-not $old.Success) { Fail 'package.json 里找不到 version 字段' }
$oldVersion = $old.Groups[1].Value
Write-Host "[release] 版本号：$oldVersion → $Version"
$newRaw = [regex]::Replace($raw, '"version"\s*:\s*"[^"]+"', ('"version": "' + $Version + '"'), 1)
if ($DryRun) { Ok 'DryRun：到此为止（未改版本号、未打包）'; exit 0 }
[IO.File]::WriteAllText($pkgPath, $newRaw, [Text.UTF8Encoding]::new($hasBom))
Ok "已写入 app\package.json 版本号 = $Version"

# ---- 打包 ----
Write-Host '[release] 开始打包：npm run dist（build + electron-builder nsis）…'
Push-Location $app
& npm run dist 2>&1 | Select-Object -Last 12
$code = $LASTEXITCODE
Pop-Location
if ($code -ne 0) { Fail "npm run dist 退出码 $code" }
if (-not (Test-Path -LiteralPath $exePath)) { Fail "打包命令成功但找不到产物：$exePath" }

# ---- 自算 SHA256 并登记 ----
$hash = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash
$sizeMB = [Math]::Round((Get-Item -LiteralPath $exePath).Length / 1MB, 2)
$entry = "$hash`n  MaxLabel-Setup-$Version.exe ($sizeMB MB)`n"
$oldSha = if (Test-Path -LiteralPath $shaPath) { [IO.File]::ReadAllText($shaPath, [Text.UTF8Encoding]::new($false)) } else { '' }
[IO.File]::WriteAllText($shaPath, ($entry + $oldSha), [Text.UTF8Encoding]::new($false))
Ok "SHA256 = $hash"
Ok "大小 = $sizeMB MB；已登记到 RELEASE-SHA256.txt 顶部"

# ---- 复核：重新读一遍产物再算一次，确认登记值与文件一致 ----
$again = (Get-FileHash -LiteralPath $exePath -Algorithm SHA256).Hash
if ($again -ne $hash) { Fail "复核失败：两次算出的 SHA256 不一致" }
Ok '复核通过（重算一致）'
Write-Host "[release] 完成。别忘了：① 在 RELEASE-NOTES-v$Version.md 里填 SHA256；② 提交 package.json / RELEASE-SHA256.txt / 发布说明。"
