<#
  从**某个已提交的构建**出复刻图（验收方 round-170 新增）

  为什么要它：P4 的口径是"并排图必须用**当前构建**重抓" ✓，但循环几乎一直在改源码 ✗，
  于是"工作树干净"的窗口很稀少 ✗（我这个上午被护栏拦下 3 次 ✓）。
  本脚本改用 **git worktree 拉出某个提交 → 就地构建 → 启动 → CDP 抓图** ✓：
    - 抓到的是**那个提交的构建** ✓（SHA 明确、可追溯 ✓，比"某个时刻的开发树"更严谨 ✓）；
    - 与循环的编辑**完全隔离** ✓（不同目录、不同 profile、不同调试端口 ✓），不会与 test:ui 抢锁 ✓。

  用法：
    powershell -File tools/parity/Shoot-FromCommit.ps1 -Sha 1741523 -Scenes propsbarcode,preview
    powershell -File tools/parity/Shoot-FromCommit.ps1 -Sha HEAD -Scenes choose -Keep
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Sha,
  # 用 `-File` 调用时数组参数很难传（`a,b` 会被当成**一个**字符串 ✗，我就这样误抓过一张 "propsbarcode,preview" ✗）
  # → 这里收字符串再自己切分 ✓
  [Parameter(Mandatory = $true)][string]$Scenes,
  [string]$Repo = 'D:\workspace\maxlabel',
  [int]$Port = 9338,
  [switch]$Keep,
  [switch]$NoBuild,
  # round-170 经验：**复用已有 worktree 会踩坑** ✗ —— 上次 `git worktree remove` 会把链接过的 app/node_modules
  #   弄成"存在但指向空气"，于是 npm run build 报 'electron-vite' is not recognized ✗。默认每次**重建** ✓。
  [switch]$ReuseWorktree
)

$ErrorActionPreference = 'Stop'
$sceneList = @($Scenes -split '[,;\s]+' | Where-Object { $_ })
function Step($m) { Write-Host ("[wt-shot] {0}" -f $m) }

$full = (& git -C $Repo rev-parse $Sha).Trim()
$short = (& git -C $Repo rev-parse --short $Sha).Trim()
Step "目标提交：$short（$full）"

$wtRoot = Join-Path $env:TEMP ("maxlabel-wt-{0}" -f $short)
$profile = Join-Path $env:TEMP ("maxlabel-wt-profile-{0}" -f $short)
$appDir = Join-Path $wtRoot 'app'
$cloneDir = Join-Path $Repo 'parity\reference\maxlabel'

# ---- 1) 准备 worktree ----
if ((Test-Path -LiteralPath $wtRoot) -and -not $ReuseWorktree) {
  Step "清理上一次的 worktree（避免 node_modules 链接变空气 ✗）"
  & git -C $Repo worktree remove --force $wtRoot 2>&1 | Out-Null
  & git -C $Repo worktree prune 2>&1 | Out-Null
}
if (Test-Path -LiteralPath $wtRoot) { Step "worktree 已存在，复用：$wtRoot" }
else {
  Step "创建 worktree：$wtRoot"
  & git -C $Repo worktree add --detach $wtRoot $full | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "git worktree add 失败" }
}
# node_modules 用 junction 指回主仓库，省去 npm install ✓
# ⚠️ 判据必须看**里面的可执行文件**：worktree 被删过一次后，junction 可能"存在但指向空气" ✗，
#    只看目录存在会误判成已链接 ✗（我就这样遇到 `'electron-vite' is not recognized` ✗）。
$nm = Join-Path $appDir 'node_modules'
if (-not (Test-Path -LiteralPath (Join-Path $nm '.bin\electron-vite.cmd'))) {
  if (Test-Path -LiteralPath $nm) {
    Step "移除失效的 node_modules 链接"
    # 注意：不能用 Remove-Item -Recurse 处理 junction —— 它可能连**目标目录的内容**一起删掉 ✗ → 用 rmdir ✓
    & cmd /c rmdir "$nm" 2>&1 | Out-Null
  }
  Step "链接 node_modules（junction → 主仓库 app\node_modules）"
  New-Item -ItemType Junction -Path $nm -Target (Join-Path $Repo 'app\node_modules') | Out-Null
}

# ---- 2) 构建 ----
if (-not $NoBuild) {
  Step "构建（electron-vite build）…"
  Push-Location $appDir
  & npm.cmd run build 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Host "    $_" }
  $code = $LASTEXITCODE
  Pop-Location
  # round-167 经验：npm 的 stderr 警告会让 PowerShell 误报非零 ✗ → 以产物是否存在为准 ✓
  if (-not (Test-Path -LiteralPath (Join-Path $appDir 'out\main\index.js'))) { throw "构建失败：没有 out\main\index.js（npm 退出码 $code）" }
  Step "构建完成 ✓"
}

# ---- 3) 起实例（自己的 profile / 端口 ✓）----
$exe = Join-Path $appDir 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path -LiteralPath $exe)) { throw "找不到 electron.exe：$exe" }
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*$profile*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
Step "启动实例（port=$Port，profile=$profile）"
Start-Process -FilePath $exe -ArgumentList '.', "--remote-debugging-port=$Port", "--user-data-dir=$profile" -WorkingDirectory $appDir | Out-Null
Start-Sleep -Seconds 10

# ---- 4) 抓图 ----
New-Item -ItemType Directory -Force -Path $cloneDir | Out-Null
$made = @()
foreach ($scene in $sceneList) {
  $outPath = Join-Path $cloneDir ("clone-{0}-{1}.png" -f $scene, $short)
  Step "抓图 scene=$scene → $outPath"
  & node (Join-Path $Repo 'tools\parity\Capture-CloneShot.cjs') --port $Port --scene $scene --out $outPath
  if (Test-Path -LiteralPath $outPath) { $made += [pscustomobject]@{ scene = $scene; file = $outPath } }
  else { Write-Host ("[wt-shot] 场景 {0} 抓图失败" -f $scene) }
}

# ---- 5) 收摊 ----
Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -like "*$profile*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Step ("抓到 {0} 张复刻图（提交 {1}）" -f $made.Count, $short)
if (-not $Keep) {
  Step "清理 worktree"
  & git -C $Repo worktree remove --force $wtRoot 2>&1 | Out-Null
}
$made | ForEach-Object { Write-Host ("[wt-shot] {0} → {1}" -f $_.scene, (Split-Path $_.file -Leaf)) }
