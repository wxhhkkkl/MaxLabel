# Forensics helper: enumerate child controls of LabelShop dialogs (class, text, screen rect).
# Purpose: get exact control geometry so buttons can be located (and reported in INDEX.md)
# even when the dialog is taller than the desktop.
[CmdletBinding()]
param(
  [string]$TitleLike = '*',
  [ValidateSet('aware','unaware')][string]$Aware = 'aware'
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class EN {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
  public static List<IntPtr> Tops(){ var l=new List<IntPtr>(); EnumWindows((h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
  public static List<IntPtr> Kids(IntPtr p){ var l=new List<IntPtr>(); EnumChildWindows(p,(h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
}
'@
if ($Aware -eq 'aware') { [void][EN]::SetProcessDPIAware() }
$pids = @(Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
if ($pids.Count -eq 0) { Write-Host '[enum] LabelShop not running'; exit 1 }
foreach ($h in [EN]::Tops()) {
  $wpid = 0
  [void][EN]::GetWindowThreadProcessId($h, [ref]$wpid)
  if (-not ($pids -contains [int]$wpid)) { continue }
  if (-not [EN]::IsWindowVisible($h)) { continue }
  $t = [EN]::T($h); $c = [EN]::C($h)
  if ($c -ne '#32770' -or -not ($t -like $TitleLike)) { continue }
  $r = New-Object EN+RECT
  [void][EN]::GetWindowRect($h, [ref]$r)
  Write-Host ("=== DIALOG '{0}' {1}x{2} at ({3},{4}) ===" -f $t, ($r.Right-$r.Left), ($r.Bottom-$r.Top), $r.Left, $r.Top)
  foreach ($k in [EN]::Kids($h)) {
    if (-not [EN]::IsWindowVisible($k)) { continue }
    $kr = New-Object EN+RECT
    [void][EN]::GetWindowRect($k, [ref]$kr)
    $en = [EN]::IsWindowEnabled($k)
    Write-Host ("  [{0}] '{1}' class={2} {3}x{4} at ({5},{6}) enabled={7}" -f `
      ($k), [EN]::T($k), [EN]::C($k), ($kr.Right-$kr.Left), ($kr.Bottom-$kr.Top), $kr.Left, $kr.Top, $en)
  }
}
exit 0
