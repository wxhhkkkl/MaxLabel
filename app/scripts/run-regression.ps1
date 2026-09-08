$ErrorActionPreference = 'Continue'
$scripts = @(
  'ui-v48.cjs','ui-v49.cjs','ui-v50.cjs','ui-audit-hotkey.cjs','ui-audit-hotkey2.cjs',
  'ui-canvas-habit.cjs','ui-canvas-habit2.cjs','ui-audit-ctx.cjs','ui-audit-toolbar.cjs',
  'ui-audit-tools.cjs','ui-audit-view.cjs','ui-audit-edit.cjs','ui-audit-file.cjs','ui-dbg-prev.cjs'
)
$results = @()
foreach ($s in $scripts) {
  Write-Host "===== $s ====="
  Get-Process | Where-Object { $_.ProcessName -like "*electron*" } | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 1
  Start-Process -FilePath ".\node_modules\electron\dist\electron.exe" -ArgumentList ".", "--remote-debugging-port=9222" -WindowStyle Hidden
  Start-Sleep -Seconds 10
  $out = node "scripts\$s" 2>&1 | Out-String
  $pass = ($out | Select-String -Pattern '(\d+)/(\d+) PASS' -AllMatches).Matches.Groups
  $summary = if ($pass.Count -ge 3) { $pass[1].Value + '/' + $pass[2].Value } else { '?' }
  $last = ($out -split "`n" | Where-Object { $_ -match 'PASS|FAIL|ERROR' } | Select-Object -Last 1)
  $results += "$s : $summary : $last"
  Write-Host $last
}
Write-Host ""
Write-Host "========== 汇总 =========="
$results | ForEach-Object { Write-Host $_ }
