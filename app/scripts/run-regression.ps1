$ErrorActionPreference = 'Continue'
$scripts = @(
  'ui-v52.cjs',
  'ui-v53.cjs',
  'ui-v54.cjs',
  'ui-v55.cjs',
  'ui-v56.cjs',
  'ui-v57.cjs',
  'ui-v58.cjs'
)
$results = @()
$overallExitCode = 0
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
    Start-Sleep -Seconds 1
    New-Item -ItemType Directory -Path $uiProfile -Force | Out-Null
    $env:MAXLABEL_DEBUG_PORT = "$debugPort"
    $electronProcess = Start-Process -FilePath ".\node_modules\electron\dist\electron.exe" -ArgumentList ".", "--remote-debugging-port=$debugPort", "--user-data-dir=$uiProfile" -WindowStyle Hidden -PassThru
    Start-Sleep -Seconds 10
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
    if ($electronProcess -and -not $electronProcess.HasExited) {
      Stop-Process -Id $electronProcess.Id -Force -ErrorAction SilentlyContinue
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
