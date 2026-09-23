<#
  从**某个已提交的构建**出复刻图（验收方 round-170 新增；round-172 改为**安全实现**）

  为什么要它：P4 的口径是"并排图必须用**当前构建**重抓" ✓，但循环几乎一直在改源码 ✗，
  于是"工作树干净"的窗口很稀少 ✗（我被护栏拦下过 3 次 ✓）。
  本脚本从某个提交拉出**独立目录 → 离线装依赖 → 构建 → 启动 → CDP 抓图** ✓：
    - 抓到的是**那个提交的构建** ✓（SHA 明确、可追溯 ✓，比"某个时刻的开发树"更严谨 ✓）；
    - 与主仓库**完全隔离** ✓（不同目录、不同 profile、不同调试端口 ✓），不与 test:ui 抢锁 ✓。

  ⚠️ **血泪教训（round-170）**：最初我用 `git worktree` + `node_modules` **junction** ✗，
     结果 `git worktree remove --force` **顺着 junction 把主仓库的 `app\node_modules` 删空了** ✗✗，
     直接导致那一轮门禁 9 项全红 ✗（见 `parity/FAILURES.md`）。现在改为：
       1) `git clone --local` 到临时目录（**不共享任何目录** ✓）；
       2) `npm install --offline` 就地装依赖（实测 12 秒、纯本机缓存、无需外网 ✓）；
       3) `npm run build` → 起实例 → 抓图 → 删掉整个临时目录 ✓。
     **任何一步都不再触及主仓库的 `node_modules`** ✓。

  用法：
    powershell -File tools/parity/Shoot-FromCommit.ps1 -Sha 1741523 -Scenes 'propsbarcode,preview'
    powershell -File tools/parity/Shoot-FromCommit.ps1 -Sha HEAD -Scenes choose -Keep
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Sha,
  # 用 `-File` 调用时数组参数很难传（`a,b` 会被当成**一个**字符串 ✗，我因此误抓过一张 "propsbarcode,preview" ✗）
  # → 这里收字符串再自己切分 ✓
  [Parameter(Mandatory = $true)][string]$Scenes,
  [string]$Repo = 'D:\workspace\maxlabel',
  [int]$Port = 9338,
  [switch]$Keep,
  [switch]$NoBuild
)

# ❌ 故意用 Continue 而不是 Stop ——
#    npm/git 会把**警告**写到 stderr（如 `npm warn deprecated …`），在 `2>&1 |` 管道下 PowerShell 会把它当成
#    ErrorRecord ✗；若 $ErrorActionPreference='Stop' 就会**中断脚本** ✗（我就这样让本脚本在装完依赖后直接退出过 ✗）。
#    所以错误处理改成"**看退出码 / 看产物**" ✓。
$ErrorActionPreference = 'Continue'
$sceneList = @($Scenes -split '[,;\s]+' | Where-Object { $_ })
function Step($m) { Write-Host ("[wt-shot] {0}" -f $m) }

$full = (& git -C $Repo rev-parse $Sha).Trim()
$short = (& git -C $Repo rev-parse --short $Sha).Trim()
Step "目标提交：$short（$full）"

$wtRoot = Join-Path $env:TEMP ("maxlabel-clone-{0}" -f $short)
$profile = Join-Path $env:TEMP ("maxlabel-clone-profile-{0}" -f $short)
$appDir = Join-Path $wtRoot 'app'
$cloneDir = Join-Path $Repo 'parity\reference\maxlabel'

# ---- 1) 独立克隆（不用 worktree、不用 junction ✗）----
if (Test-Path -LiteralPath $wtRoot) {
  Step "清理上一次的临时克隆"
  Remove-Item -LiteralPath $wtRoot -Recurse -Force -ErrorAction SilentlyContinue
}
Step "克隆到临时目录"
& git clone --quiet --local $Repo $wtRoot | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'git clone --local 失败' }
& git -C $wtRoot checkout --quiet --detach $full | Out-Null
if ($LASTEXITCODE -ne 0) { throw "git checkout $short 失败" }
Step "已检出 $short ✓"

# ---- 2) 离线装依赖（纯本机 npm 缓存 ✓，不碰主仓库 ✗）----
Step "在克隆里离线装依赖（npm install --offline）…"
Push-Location $appDir
& npm.cmd install --offline --no-audit --no-fund 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Host "    $_" }
Pop-Location
if (-not (Test-Path -LiteralPath (Join-Path $appDir 'node_modules\.bin\electron-vite.cmd'))) { throw '离线安装后仍找不到 electron-vite（检查 npm 缓存）' }
if (-not (Test-Path -LiteralPath (Join-Path $appDir 'node_modules\electron\dist\electron.exe'))) {
  Step "取 electron 二进制（本机缓存）"
  Push-Location $appDir
  & node 'node_modules\electron\install.js' 2>&1 | Select-Object -Last 1 | ForEach-Object { Write-Host "    $_" }
  Pop-Location
}
if (-not (Test-Path -LiteralPath (Join-Path $appDir 'node_modules\electron\dist\electron.exe'))) { throw '拿不到 electron.exe（检查 %LOCALAPPDATA%\electron\Cache）' }
Step "依赖就绪 ✓"

# ---- 3) 构建 ----
if (-not $NoBuild) {
  Step "构建（npm run build）…"
  Push-Location $appDir
  & npm.cmd run build 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Host "    $_" }
  Pop-Location
  if (-not (Test-Path -LiteralPath (Join-Path $appDir 'out\main\index.js'))) { throw '构建失败：没有 out\main\index.js' }
  Step "构建完成 ✓"
}

# ---- 4) 起实例（自己的 profile / 端口 ✓）----
$exe = Join-Path $appDir 'node_modules\electron\dist\electron.exe'
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*$profile*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
Step "启动实例（port=$Port）"
Start-Process -FilePath $exe -ArgumentList '.', "--remote-debugging-port=$Port", "--user-data-dir=$profile" -WorkingDirectory $appDir | Out-Null
Start-Sleep -Seconds 10

# ---- 5) 抓图 ----
New-Item -ItemType Directory -Force -Path $cloneDir | Out-Null
$made = @()
foreach ($scene in $sceneList) {
  $outPath = Join-Path $cloneDir ("clone-{0}-{1}.png" -f $scene, $short)
  Step "抓图 scene=$scene"
  & node (Join-Path $Repo 'tools\parity\Capture-CloneShot.cjs') --port $Port --scene $scene --out $outPath
  if (Test-Path -LiteralPath $outPath) { $made += [pscustomobject]@{ scene = $scene; file = $outPath } }
  else { Write-Host ("[wt-shot] 场景 {0} 抓图失败" -f $scene) }
}

# ---- 6) 收摊（只杀自己的实例 + 删临时目录 ✓）----
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*$profile*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Step ("抓到 {0} 张复刻图（提交 {1}）" -f $made.Count, $short)
if (-not $Keep) {
  Step "删除临时克隆"
  Remove-Item -LiteralPath $wtRoot -Recurse -Force -ErrorAction SilentlyContinue
}
$made | ForEach-Object { Write-Host ("[wt-shot] {0} → {1}" -f $_.scene, (Split-Path $_.file -Leaf)) }
