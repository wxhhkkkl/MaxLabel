# 取证辅助：把 LabelShop 的对话框移到屏幕内，便于抓取被裁切的按钮。
# 只移动窗口位置/尺寸，不修改被测程序本身。
[CmdletBinding()]
param(
  [string]$TitleLike = '*',
  [int]$X = 40,
  [int]$Y = 20,
  [int]$W = 0,
  [int]$H = 0
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class MW {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool repaint);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
}
'@
$pids = @(Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
if ($pids.Count -eq 0) { Write-Host '[move] LabelShop 未运行'; exit 1 }
$found = 0
$hits = New-Object System.Collections.ArrayList
[void][MW]::EnumWindows({
  param($h, $l)
  $wpid = 0
  [void][MW]::GetWindowThreadProcessId($h, [ref]$wpid)
  if ($pids -contains [int]$wpid) {
    $t = [MW]::T($h); $c = [MW]::C($h)
    if ([MW]::IsWindowVisible($h) -and $c -eq '#32770' -and $t -like $TitleLike) {
      $r = New-Object MW+RECT
      [void][MW]::GetWindowRect($h, [ref]$r)
      [void]$hits.Add([pscustomobject]@{ H=$h; T=$t; L=$r.Left; Tp=$r.Top; W=($r.Right-$r.Left); Ht=($r.Bottom-$r.Top) })
    }
  }
  return $true
}, [IntPtr]::Zero) | Out-Null
foreach ($d in $hits) {
  $w = if ($W -gt 0) { $W } else { $d.W }
  $ht = if ($H -gt 0) { $H } else { $d.Ht }
  $ok = [MW]::MoveWindow($d.H, $X, $Y, $w, $ht, $true)
  Write-Host ("[move] '{0}' {1}x{2} ({3},{4}) -> ({5},{6}) {7}x{8} ok={9}" -f $d.T, $d.W, $d.Ht, $d.L, $d.Tp, $X, $Y, $w, $ht, $ok)
  $found++
}
if ($found -eq 0) { Write-Host "[move] 未找到匹配 '#32770' 标题 '$TitleLike' 的可见窗口" }
exit 0
