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
)
if ($env:MAXLABEL_UI_SCRIPT) {
  $scripts = @($env:MAXLABEL_UI_SCRIPT)
}
$results = @()
$overallExitCode = 0

function Stop-ProcessTree {
  param([int]$RootProcessId)
  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $RootProcessId" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    Stop-ProcessTree -RootProcessId ([int]$child.ProcessId)
  }
  Stop-Process -Id $RootProcessId -Force -ErrorAction SilentlyContinue
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

foreach ($s in $scripts) {
  Write-Host "===== $s ====="
  if (-not (Test-Path -LiteralPath "scripts\$s")) {
    $results += "$s : ? : 缺少脚本"
    Write-Host "缺少脚本：scripts\$s"
    continue
  }
  $electronProcess = $null
  $uiProfile = Join-Path ([IO.Path]::GetTempPath()) ("maxlabel-ui-" + [guid]::NewGuid().ToString('N'))
  $debugPort = Get-Random -Minimum 9300 -Maximum 9399
  try {
    Stop-StaleMaxLabelProcesses
    Start-Sleep -Milliseconds 250
    Start-Sleep -Seconds 1
    New-Item -ItemType Directory -Path $uiProfile -Force | Out-Null
    $env:MAXLABEL_DEBUG_PORT = "$debugPort"
    $electronProcess = Start-Process -FilePath ".\node_modules\electron\dist\electron.exe" -ArgumentList ".", "--remote-debugging-port=$debugPort", "--user-data-dir=$uiProfile" -WindowStyle Hidden -PassThru
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
    }
  } catch {
    $results += "$s : ? : $($_.Exception.Message)"
    Write-Host $_.Exception.Message
    $overallExitCode = 1
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
exit $overallExitCode
