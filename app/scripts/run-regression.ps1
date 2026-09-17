$ErrorActionPreference = 'Continue'
$scripts = @(
  # ui-v48～ui-v51 是早期脚本，长期未登记进门禁：D-01/D-03/D-65/D-66 的证据列却引用了
  # ui-v49/ui-v50，导致「被引用的证据」从不参与门禁。round-99 把 v49/v50 的「新建标签」
  # 流程从一步修正为 DIFF-3 的两步向导（并改读 testid），实测通过后登记在册。
  'ui-v49.cjs',
  'ui-v50.cjs',
  'ui-v52.cjs',
  'ui-v53.cjs',
  'ui-v54.cjs',
  'ui-v55.cjs',
  'ui-v56.cjs',
  'ui-v57.cjs',
  'ui-v58.cjs',
  'ui-v59.cjs',
  'ui-v60.cjs',
  'ui-v61.cjs',
  'ui-v62.cjs',
  'ui-v63.cjs',
  'ui-v64.cjs',
  'ui-v65.cjs',
  'ui-v66.cjs',
  'ui-v67.cjs',
  'ui-v68.cjs',
  'ui-v69.cjs',
  'ui-v70.cjs',
  'ui-v71.cjs',
  'ui-v72.cjs',
  'ui-v73.cjs',
  'ui-v74.cjs'
  ,'ui-v75.cjs'
  ,'ui-v76.cjs'
  ,'ui-v77.cjs'
  ,'ui-v78.cjs'
  ,'ui-v79.cjs'
  ,'ui-v80.cjs'
  ,'ui-v81.cjs'
  ,'ui-v82.cjs'
  ,'ui-v83.cjs'
  ,'ui-v84.cjs'
  ,'ui-v85.cjs'
  ,'ui-v86.cjs'
  ,'ui-v87.cjs'
  ,'ui-v88.cjs'
  ,'ui-v89.cjs'
  ,'ui-v90.cjs'
  ,'ui-v91.cjs'
  ,'ui-v92.cjs'
  ,'ui-v93.cjs'
  ,'ui-v94.cjs'
  ,'ui-v95.cjs'
  ,'ui-v96.cjs'
  ,'ui-v97.cjs'
  ,'ui-v98.cjs'
  ,'ui-v99.cjs'
  ,'ui-v100.cjs'
  ,'ui-v101.cjs'
  ,'ui-v102.cjs'
  ,'ui-v103.cjs'
  ,'ui-v104.cjs'
  ,'ui-v105.cjs'
  ,'ui-v106.cjs'
  ,'ui-v107.cjs'
  ,'ui-v108.cjs'
  ,'ui-v109.cjs'
  ,'ui-v110.cjs'
  ,'ui-v111.cjs'
  ,'ui-v112.cjs'
  ,'ui-v113.cjs'
  ,'ui-v114.cjs'
  ,'ui-v115.cjs',
  'ui-v116.cjs'
)
if ($env:MAXLABEL_UI_SCRIPT) {
  $scripts = @($env:MAXLABEL_UI_SCRIPT)
}
$results = @()
$overallExitCode = 0

# 清理**只按命令行里的 --user-data-dir=<本次 profile> 匹配**，绝不按 ParentProcessId 遍历进程树。
#
# 原先的 Stop-ProcessTree 从 `$electronProcess.Id` 出发、按 `ParentProcessId = <pid>` 迭代向下遍历
# 并逐个 `Stop-Process -Force`。它的失效模式是 **Windows 会回收 PID**：`$electronProcess.Id` 对应的
# electron 早已退出时，该 PID 可能已被无关进程复用，遍历于是踏进**别人的**进程树并把它们杀掉——
# 包括 runner 自己或 npm 宿主进程。这与两次实测症状完全吻合：
#   round-83：全量 test:ui 在 ui-v64 处整轮中止，退出码 1、无汇总行；
#   round-100：全量 test:ui 在 ui-v60 处整轮中止，退出码 0、无汇总行。
# 「无汇总行」正是 runner 被自己杀掉的表现（进程被强杀，`Write-Host "===== 汇总 ====="` 根本没执行）。
# 按 profile 路径匹配没有这个风险：路径是本次启动随机生成的 GUID，不匹配任何无关进程；
# 且 Chromium 的子进程会继承 `--user-data-dir` 开关，所以 gpu/renderer/utility 一个都不会漏。
function Get-ProfileElectronProcesses {
  param([string]$ProfilePath)
  if (-not $ProfilePath) { return @() }
  return @(Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine.IndexOf($ProfilePath, [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
}

function Stop-TestElectronProcesses {
  param([string]$ProfilePath, [int]$WaitSeconds = 10)
  if (-not $ProfilePath) { return }
  foreach ($process in (Get-ProfileElectronProcesses -ProfilePath $ProfilePath)) {
    Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction SilentlyContinue
  }
  # `Stop-Process -Force` 是**异步**的：它一返回就往下走，此刻进程往往还没真正退出、
  # 仍持有 profile 目录里的文件句柄（Chromium 的 Cache/ 等）。紧接着的
  # `Remove-Item -Recurse -Force` 于是删到一半撞上占用文件，`-ErrorAction SilentlyContinue`
  # 把错误吞掉 —— 目录留下一具残骸（本轮实测：跑完 ui-v108 后残留 1 个目录，里面还剩 1 个文件；
  # 历史累积到 816 个里相当一部分就是这种「删了一半」）。
  # 这里等到匹配本次 profile 的进程真正消失，删除才可靠。
  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  while ((Get-Date) -lt $deadline) {
    if (@(Get-ProfileElectronProcesses -ProfilePath $ProfilePath).Count -eq 0) { return }
    Start-Sleep -Milliseconds 200
  }
}

function Remove-StaleUiProfiles {
  # 中止过的回归走不到 finally，它那次启动的 profile 目录就永远留在了 %TEMP%。
  # 这不是理论风险：2026-09-17 实测累积 **816 个**（最早回溯到 09-10），正是 round-83/round-100
  # 那类「整轮中止」留下的残骸（磁盘白占，且下次排查时无从分辨哪个是本轮的）。
  # 清扫必须在**拿到独占锁之后**：此刻不可能有别的回归在跑，凡是 maxlabel-ui-* 都是遗留物。
  # 先杀掉仍持有这些目录的残留 electron，否则文件被占用、Remove-Item 会静默失败清不掉；
  # 再逐个删，只认 `maxlabel-ui-<32位小写十六进制>` 这一种名字（即本套回归的 profile，
  # 与 Stop-StaleMaxLabelProcesses 的匹配口径一致），不碰 TEMP 里其它任何东西。
  Stop-StaleMaxLabelProcesses
  # 同样要等进程真正退出（见 Stop-TestElectronProcesses 里关于 Stop-Process 异步的说明），
  # 否则下面的删除会因文件占用而静默失败，等于什么也没清。
  $deadline = (Get-Date).AddSeconds(10)
  while ((Get-Date) -lt $deadline) {
    $alive = @(Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" -ErrorAction SilentlyContinue | Where-Object {
      $_.CommandLine -and $_.CommandLine -match 'maxlabel-ui-[0-9a-f]{32}'
    })
    if ($alive.Count -eq 0) { break }
    Start-Sleep -Milliseconds 200
  }
  $candidates = @(Get-ChildItem ([IO.Path]::GetTempPath()) -Directory -Filter 'maxlabel-ui-*' -ErrorAction SilentlyContinue)
  $removed = 0
  foreach ($dir in $candidates) {
    if ($dir.Name -notmatch '^maxlabel-ui-[0-9a-f]{32}$') { continue }
    Remove-Item -LiteralPath $dir.FullName -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path -LiteralPath $dir.FullName)) { $removed++ }
  }
  if ($removed -gt 0) {
    Write-Host "已清理 $removed 个上一轮中止留下的回归 profile 目录（$($candidates.Count) 个候选中）"
  }
}

function Stop-StaleMaxLabelProcesses {
  $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine -match 'maxlabel-ui-[0-9a-f]{32}'
  })
  foreach ($process in $processes) {
    Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction SilentlyContinue
  }
}

# 系统剪贴板是宿主全局状态，且会被本套回归自己污染：任何一次「复制对象」都会把
# MaxLabel 的对象 JSON 写进系统剪贴板（useDocumentCommands 的跨窗口粘贴功能），
# 下一次启动的应用读到它就把「编辑(P)→粘贴(P)」判为可用。ui-v52.cjs 是列表里第一个
# 脚本，断言的是启动初始禁用态，于是被上一轮残留污染时表现为偶发 65/66 失败
# （已实测复现）。这里在开跑前清掉我们自己留下的载荷，让启动态可复现；
# 非 MaxLabel 的剪贴板内容一律不动，不干扰用户。
function Clear-MaxLabelClipboardLeak {
  try {
    $raw = Get-Clipboard -Raw -ErrorAction SilentlyContinue
    if ($raw -and $raw.TrimStart().StartsWith('{"format":"maxlabel-objects"')) {
      Set-Clipboard -Value ' '
      Write-Host '已清除上一轮回归残留在系统剪贴板的 MaxLabel 对象载荷（否则粘贴(P) 初始态不可复现）'
    }
  } catch { }
}

# 本套回归对宿主是独占资源：每个脚本都要起一个 Electron、抢 9300-9398 的 CDP 端口、
# 并在 40 秒内等到 CDP 就绪。两套回归同时跑时会互相抢端口与 CPU，表现为
# 「等待 UI 回归 CDP 就绪超时」以及一批脚本莫名其妙的断言失败——但它们**单独跑全过**，
# 于是被记成产品缺陷。round-99 实测：上一轮的报告里写着「全量 test:ui 在报告时仍在跑」，
# 同一时刻门禁也在跑 test:ui，门禁因此报出 14 个脚本失败（ui-v54/v59/v60/v61/v67/v73/
# v74/v75/v76/v82/v88/v89/v94/v95），逐个单跑却全绿。
# 这里用独占文件锁把并发挡住：拿不到锁就**明确报错退出**，绝不把并发噪声伪装成断言失败。
# 锁由进程退出自动释放（OS 关闭句柄），所以崩溃留下的锁不会变成僵尸锁。
function Get-RegressionLock {
  param([int]$WaitSeconds = 30)
  $lockPath = Join-Path ([IO.Path]::GetTempPath()) 'maxlabel-ui-regression.lock'
  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  $notified = $false
  while ($true) {
    try {
      # FileShare::None + 进程存活期间一直持有句柄：并发者拿到 IOException。
      return [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch [IO.IOException] {
      if ((Get-Date) -ge $deadline) {
        Write-Host "拒绝并发执行：另一个 test:ui 正在运行（独占锁 $lockPath 被占用）。"
        Write-Host "两套回归同时跑会抢 CDP 端口与 CPU，把「CDP 就绪超时」伪装成断言失败（round-99 实测 14 个假失败）。"
        Write-Host "请等它结束后重跑：npm run test:ui"
        exit 1
      }
      if (-not $notified) {
        Write-Host "另一个 test:ui 正在运行，等待其结束（最多 $WaitSeconds 秒）..."
        $notified = $true
      }
      Start-Sleep -Seconds 1
    } catch {
      # 锁文件不可用（权限/路径异常）不应阻断回归本身：退化为无锁运行。
      Write-Host "警告：无法建立回归独占锁（$($_.Exception.Message)），本次不做并发防护。"
      return $null
    }
  }
}
Clear-MaxLabelClipboardLeak
$regressionLock = Get-RegressionLock
# 必须在拿到锁之后：见 Remove-StaleUiProfiles 注释。
Remove-StaleUiProfiles

$failedScripts = @()
$currentScript = $null
$runnerAborted = $null
# 整份循环套 try/catch/finally：**任何**异常路径都必须落到汇总行。
# round-83（退出码 1）与 round-100（退出码 0）两次实测「全量回归整轮中止、无汇总行」，
# 门禁日志因此永远分不清「runner 跑挂了」还是「断言失败」。兜底后两者在日志里可区分：
# 跑挂了会多打一行 `runner 内部异常：...`，断言失败则只有 `FAILED SCRIPTS: ...`。
try {
foreach ($s in $scripts) {
  $currentScript = $s
  Write-Host "===== $s ====="
  if (-not (Test-Path -LiteralPath "scripts\$s")) {
    $results += "$s : ? : 缺少脚本"
    $failedScripts += $s
    # 登记在册的脚本不存在必须让门禁失败：否则「脚本被漏登记/被删」会伪装成通过。
    $overallExitCode = 1
    Write-Host "缺少脚本：scripts\$s"
    continue
  }
  $electronProcess = $null
  $uiProfile = Join-Path ([IO.Path]::GetTempPath()) ("maxlabel-ui-" + [guid]::NewGuid().ToString('N'))
  # 端口必须由本次启动的实例独占：若端口上已有监听者（上一轮被中止留下的 electron 等），
  # UI 脚本会连到那个旧渲染进程，断言看到的是旧构建，表现为随机脚本"失败"。
  # 这里改为挑一个当前空闲的端口，避免连错实例造成假失败。
  $debugPort = $null
  for ($portTry = 0; $portTry -lt 40; $portTry++) {
    $candidate = Get-Random -Minimum 9300 -Maximum 9399
    if (-not (Get-NetTCPConnection -LocalPort $candidate -State Listen -ErrorAction SilentlyContinue)) {
      $debugPort = $candidate
      break
    }
  }
  if (-not $debugPort) { throw "找不到空闲的 CDP 调试端口（9300-9398 全部被占用）" }
  try {
    Stop-StaleMaxLabelProcesses
    Start-Sleep -Milliseconds 250
    Start-Sleep -Seconds 1
    New-Item -ItemType Directory -Path $uiProfile -Force | Out-Null
    $env:MAXLABEL_DEBUG_PORT = "$debugPort"
    # 原生「打开」文件对话框在 CDP 上下文之外（脚本点不到它的按钮）：
    # ui-v108 断言主工具栏「打开」按钮的点击行为时，用 MAXLABEL_OPEN_PATH 让主进程直接
    # 返回一个固定路径的模板文件（与 updater 的 MAXLABEL_UPDATE_URL 同一模式，
    # 详见 src/main/ipc/registerTemplateIpc.ts）。其他脚本不设置该变量，仍走真实对话框。
    $env:MAXLABEL_OPEN_PATH = if ($s -eq 'ui-v108.cjs') { Join-Path ([IO.Path]::GetTempPath()) 'maxlabel-open-fixture.msdx' } else { $null }
    # 同理：ui-v109 走查 getstart_firstprint.html 第 9 步「浏览图片」，用 MAXLABEL_PICK_PATH
    # 让主进程的 dialog:pickFile 直接返回一个固定路径的真实 PNG。
    $env:MAXLABEL_PICK_PATH = if ($s -eq 'ui-v109.cjs') { Join-Path ([IO.Path]::GetTempPath()) 'maxlabel-pick-fixture.png' } else { $null }
    # 静默测试窗口：--disable-gpu 避免 "GPU process exited unexpectedly" 刷屏与资源占用；
    # stdout/stderr 重定向到日志文件，避免 Chromium 的 DevTools/网络服务噪声打到父控制台。
    $electronOut = Join-Path $uiProfile 'electron-stdout.log'
    $electronErr = Join-Path $uiProfile 'electron-stderr.log'
    $electronArgs = @('.', "--remote-debugging-port=$debugPort", "--user-data-dir=$uiProfile", '--disable-gpu', '--disable-gpu-compositing', '--disable-software-rasterizer')
    $electronProcess = Start-Process -FilePath ".\node_modules\electron\dist\electron.exe" -ArgumentList $electronArgs -WindowStyle Hidden -RedirectStandardOutput $electronOut -RedirectStandardError $electronErr -PassThru
    Start-Sleep -Seconds 10
    $cdpReady = $false
    # Electron cold-start can exceed the first 15 seconds on a busy Windows host;
    # keep the same readiness check but allow up to 30 seconds before classifying
    # the UI case as failed.
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
      try {
        $cdpPages = Invoke-RestMethod -Uri "http://127.0.0.1:$debugPort/json/list" -TimeoutSec 1
        if (@($cdpPages | Where-Object { $_.type -eq 'page' }).Count -gt 0) { $cdpReady = $true; break }
      } catch { }
      Start-Sleep -Milliseconds 500
    }
    if (-not $cdpReady) { throw "等待 UI 回归 CDP 就绪超时：$debugPort" }
    # 就绪后再确认一次：监听该端口的进程必须是本次启动的 electron（或其子进程），
    # 否则宁可报明确的"连错实例"错误，也不要让脚本对着别人的窗口跑出莫名的断言失败。
    $listenerPid = (Get-NetTCPConnection -LocalPort $debugPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess
    if (-not $listenerPid) { throw "CDP 端口 $debugPort 上找不到监听进程" }
    $ownedPids = @($electronProcess.Id)
    $frontier = @($electronProcess.Id)
    while ($frontier.Count -gt 0) {
      $next = @()
      foreach ($parentId in $frontier) {
        $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $parentId" -ErrorAction SilentlyContinue)
        foreach ($child in $children) {
          if ($ownedPids -notcontains [int]$child.ProcessId) {
            $ownedPids += [int]$child.ProcessId
            $next += [int]$child.ProcessId
          }
        }
      }
      $frontier = $next
    }
    if ($ownedPids -notcontains [int]$listenerPid) {
      throw "CDP 端口 $debugPort 被外部进程占用（PID=$listenerPid，本次 electron PID=$($electronProcess.Id)），拒绝在该实例上运行 $s"
    }
    $out = node "scripts\$s" 2>&1 | Out-String
    $nodeExitCode = $LASTEXITCODE
    $pass = [regex]::Match($out, '(?m)^\s*(\d+)/(\d+) PASS\s*$')
    $summary = if ($pass.Success) { $pass.Groups[1].Value + '/' + $pass.Groups[2].Value } else { '?' }
    $last = ($out -split "`n" | Where-Object { $_ -match 'PASS|FAIL|ERROR' } | Select-Object -Last 1)
    $results += "$s : $summary : $last"
    Write-Host $out
    Write-Host $last
    if ($nodeExitCode -ne 0 -or -not $pass.Success -or [int]$pass.Groups[1].Value -ne [int]$pass.Groups[2].Value) {
      $overallExitCode = 1
      $failedScripts += $s
    }
  } catch {
    $results += "$s : ? : $($_.Exception.Message)"
    Write-Host $_.Exception.Message
    $overallExitCode = 1
    $failedScripts += $s
  } finally {
    if ($electronProcess) {
      # 只按本次 profile 匹配（见 Stop-TestElectronProcesses 上方注释）：不再按 PID 遍历进程树。
      Stop-TestElectronProcesses -ProfilePath $uiProfile
    }
    if (Test-Path -LiteralPath $uiProfile) {
      Remove-Item -LiteralPath $uiProfile -Recurse -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:MAXLABEL_DEBUG_PORT -ErrorAction SilentlyContinue
  }
}
} catch {
  # 兜底：异常脚本本身已在循环内被 catch 记账，能走到这里的是 runner 自身的异常
  # （例如「找不到空闲的 CDP 调试端口」）。此时 $currentScript 就是当时正在跑的那个脚本。
  $runnerAborted = $_
  $overallExitCode = 1
  if ($currentScript -and ($failedScripts -notcontains $currentScript)) {
    $failedScripts += $currentScript
  }
} finally {
  Write-Host ""
  if ($runnerAborted) {
    Write-Host "runner 内部异常：$($runnerAborted.Exception.Message)"
    Write-Host $runnerAborted.ScriptStackTrace
  }
  Write-Host "========== 汇总 =========="
  $results | ForEach-Object { Write-Host $_ }
  # 显式释放独占锁（进程退出也会释放，这里是为了同进程内再次调用时不锁死自己）。
  if ($regressionLock) {
    $regressionLock.Dispose()
    $regressionLock = $null
  }
  # 决定性收尾行：门禁日志只保留输出末尾若干行，而逐脚本结果按运行顺序排列，
  # 失败脚本常常落在被截断的头部（round-80/81 就是如此，无法判断是哪个脚本挂了）。
  # 把结论放在最后一行，任何截断窗口都能看到。
  # 它必须在 finally 里：否则 runner 自身异常时又会回到「无汇总行」的老毛病。
  if ($overallExitCode -eq 0) {
    Write-Host "ALL SCRIPTS PASSED ($($scripts.Count)/$($scripts.Count))"
  } else {
    Write-Host "FAILED SCRIPTS: $($failedScripts -join ', ')"
  }
  [Console]::Out.Flush()
}
exit $overallExitCode
