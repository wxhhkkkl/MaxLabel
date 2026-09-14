# Forensics helper: reposition/resize a LabelShop dialog and read geometry in a chosen
# DPI-awareness context. Only moves windows; does not modify the product.
#
# Modes:
#   -Mode list                 : print dialog rects (in the selected awareness context)
#   -Mode move -X -Y -W -H     : MoveWindow using coordinates in the selected context
#   -Aware aware|unaware       : DPI awareness context of THIS process (default aware)
[CmdletBinding()]
param(
  [ValidateSet('list','move')][string]$Mode = 'list',
  [ValidateSet('aware','unaware')][string]$Aware = 'aware',
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
using System.Runtime.InteropServices;
public class DP {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);
  [DllImport("user32.dll")] public static extern IntPtr GetThreadDpiAwarenessContext();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool repaint);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
}
'@
if ($Aware -eq 'aware') { [void][DP]::SetProcessDPIAware() }
$pids = @(Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
if ($pids.Count -eq 0) { Write-Host '[dp] LabelShop not running'; exit 1 }
$hits = New-Object System.Collections.ArrayList
$cb = [DP+EnumWindowsProc]{
  param([IntPtr]$h, [IntPtr]$l)
  $wpid = 0
  [void][DP]::GetWindowThreadProcessId($h, [ref]$wpid)
  if ($pids -contains [int]$wpid) {
    $t = [DP]::T($h); $c = [DP]::C($h)
    if ([DP]::IsWindowVisible($h) -and $c -eq '#32770' -and $t -like $TitleLike) {
      $r = New-Object DP+RECT
      [void][DP]::GetWindowRect($h, [ref]$r)
      [void]$hits.Add([pscustomobject]@{ Handle=$h; Title=$t; L=$r.Left; Tp=$r.Top; W=($r.Right-$r.Left); Ht=($r.Bottom-$r.Top) })
    }
  }
  return $true
}
[void][DP]::EnumWindows($cb, [IntPtr]::Zero)
foreach ($d in $hits) {
  if ($Mode -eq 'list') {
    Write-Host ("[dp:{0}] '{1}' {2}x{3} at ({4},{5})" -f $Aware, $d.Title, $d.W, $d.Ht, $d.L, $d.Tp)
  } else {
    $w = if ($W -gt 0) { $W } else { $d.W }
    $ht = if ($H -gt 0) { $H } else { $d.Ht }
    $ok = [DP]::MoveWindow($d.Handle, $X, $Y, $w, $ht, $true)
    Write-Host ("[dp:{0}] move '{1}' {2}x{3} ({4},{5}) -> ({6},{7}) {8}x{9} ok={10}" -f $Aware, $d.Title, $d.W, $d.Ht, $d.L, $d.Tp, $X, $Y, $w, $ht, $ok)
  }
}
if ($hits.Count -eq 0) { Write-Host "[dp:$Aware] no visible '#32770' dialog matching '$TitleLike'" }
exit 0
