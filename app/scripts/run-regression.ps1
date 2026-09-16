$ErrorActionPreference = 'Continue'
$scripts = @(
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
)
if ($env:MAXLABEL_UI_SCRIPT) {
  $scripts = @($env:MAXLABEL_UI_SCRIPT)
}
$results = @()
$overallExitCode = 0

function Stop-ProcessTree {
  param([int]$RootProcessId)
  # 迭代遍历，不再递归：宿主繁忙 / Electron 进程树较深时，原来的递归版本会撞上
  # PowerShell 的 CallDepthOverflow，把整份 runner 连同本轮回归一起终止
  # （round-83 实测：全量 test:ui 在 ui-v64 处整轮中止，退出码 1、无汇总行）。
  $stack = New-Object System.Collections.Stack
  $stack.Push($RootProcessId)
  while ($stack.Count -gt 0) {
    $current = [int]$stack.Pop()
    $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $current" -ErrorAction SilentlyContinue)
    foreach ($child in $children) { $stack.Push([int]$child.ProcessId) }
    Stop-Process -Id $current -Force -ErrorAction SilentlyContinue
  }
}

function Stop-TestElectronProcesses {
  param([string]$ProfilePath)
  $processes = @(Get-CimInstance Win32_Process -Filter "Name = 'electron.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -and $_.CommandLine.IndexOf($ProfilePath, [StringComparison]::OrdinalIgnoreCase) -ge 0
  })
  foreach ($process in $processes) {
    Stop-Process -Id ([int]$process.ProcessId) -Force -ErrorAction SilentlyContinue
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
Clear-MaxLabelClipboardLeak

$failedScripts = @()
foreach ($s in $scripts) {
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
      Stop-ProcessTree -RootProcessId $electronProcess.Id
      Stop-TestElectronProcesses -ProfilePath $uiProfile
    }
    if (Test-Path -LiteralPath $uiProfile) {
      Remove-Item -LiteralPath $uiProfile -Recurse -Force -ErrorAction SilentlyContinue
    }
    Remove-Item Env:MAXLABEL_DEBUG_PORT -ErrorAction SilentlyContinue
  }
}
Write-Host ""
Write-Host "========== 汇总 =========="
$results | ForEach-Object { Write-Host $_ }
# 决定性收尾行：门禁日志只保留输出末尾若干行，而逐脚本结果按运行顺序排列，
# 失败脚本常常落在被截断的头部（round-80/81 就是如此，无法判断是哪个脚本挂了）。
# 把结论放在最后一行，任何截断窗口都能看到。
if ($overallExitCode -eq 0) {
  Write-Host "ALL SCRIPTS PASSED ($($scripts.Count)/$($scripts.Count))"
} else {
  Write-Host "FAILED SCRIPTS: $($failedScripts -join ', ')"
}
exit $overallExitCode
