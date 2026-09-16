# Forensics helper: move a LabelShop dialog into view so clipped buttons can be captured.
# Only repositions the window; it does not modify the product.
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
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
}
'@
$pids = @(Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
if ($pids.Count -eq 0) { Write-Host '[move] LabelShop not running'; exit 1 }
$hits = New-Object System.Collections.ArrayList
$cb = [MW+EnumWindowsProc]{
  param([IntPtr]$h, [IntPtr]$l)
  $wpid = 0
  [void][MW]::GetWindowThreadProcessId($h, [ref]$wpid)
  if ($pids -contains [int]$wpid) {
    $t = [MW]::T($h); $c = [MW]::C($h)
    if ([MW]::IsWindowVisible($h) -and $c -eq '#32770' -and $t -like $TitleLike) {
      $r = New-Object MW+RECT
      [void][MW]::GetWindowRect($h, [ref]$r)
      [void]$hits.Add([pscustomobject]@{ Handle=$h; Title=$t; L=$r.Left; Tp=$r.Top; W=($r.Right-$r.Left); Ht=($r.Bottom-$r.Top) })
    }
  }
  return $true
}
[void][MW]::EnumWindows($cb, [IntPtr]::Zero)
foreach ($d in $hits) {
  $w = if ($W -gt 0) { $W } else { $d.W }
  $ht = if ($H -gt 0) { $H } else { $d.Ht }
  $ok = [MW]::MoveWindow($d.Handle, $X, $Y, $w, $ht, $true)
  Write-Host ("[move] '{0}' {1}x{2} at ({3},{4}) -> ({5},{6}) {7}x{8} ok={9}" -f $d.Title, $d.W, $d.Ht, $d.L, $d.Tp, $X, $Y, $w, $ht, $ok)
}
if ($hits.Count -eq 0) { Write-Host "[move] no visible '#32770' dialog matching '$TitleLike'" }
exit 0
