# 验收方自用护栏：确认"驱动器不在跑门禁/UI"再动手
#
# 背景（round-95 教训）：round-114 门禁的 ui-v116 出现 7/12 的抖动失败，原因是我在同一时段起了自己的
# 验收实例（`maxlabel-verifier-profile`）跑并排图与工装，抢了 UI 回归的资源。全量套件里对指针状态、
# 拖拽几何这类断言是时序敏感的，被抢资源就会抖。
#
# 用法（起任何 electron 实例 / 跑任何写 out\ 的构建之前，先跑它）：
#   powershell -File tools/parity/Assert-NoUiRun.ps1           # 检查；安全则 exit 0
#   powershell -File tools/parity/Assert-NoUiRun.ps1 -Wait     # 等到安全为止（最多 -MaxWaitMinutes）
[CmdletBinding()]
param(
  [string]$Repo = 'D:\workspace\maxlabel',
  [switch]$Wait,
  [int]$MaxWaitMinutes = 40
)

function Get-UiRuns {
  # ① 驱动器门禁：Run-ParityLoop.ps1 在跑，且它正在 UI 阶段（有 electron）
  # ② 任何 electron 实例（含我自己的残留、别人家跑来跑去的实例）
  $procs = @(Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction SilentlyContinue)
  return $procs
}

$deadline = (Get-Date).AddMinutes($MaxWaitMinutes)
while ($true) {
  $el = Get-UiRuns
  $loop = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -match 'Run-ParityLoop\.ps1' })
  if ($el.Count -eq 0) {
    Write-Host "[guard] 安全：当前没有 electron 实例（驱动器进程 $($loop.Count) 个）——可以起自己的实例。"
    exit 0
  }
  $msg = "[guard] 不安全：检测到 $($el.Count) 个 electron 正在运行（驱动器进程 $($loop.Count) 个）"
  if (-not $Wait) { Write-Host "$msg → 现在不要起实例；需要等待请加 -Wait"; exit 3 }
  if ((Get-Date) -gt $deadline) { Write-Host "$msg → 等待超时（$MaxWaitMinutes 分钟）"; exit 4 }
  Write-Host "$msg → 60 秒后再看"
  Start-Sleep -Seconds 60
}
