# Forensics helper: bring a window to the foreground and send keystrokes to it.
# Needed because LabelShop's dialogs can be taller than the desktop (150% DPI),
# so some buttons are genuinely off-screen and cannot be clicked.
[CmdletBinding()]
param(
  [string]$TitleLike = '*',
  [Parameter(Mandatory=$true)][string]$Keys,
  [int]$WaitMs = 900,
  [switch]$ListOnly
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class FK {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
  public static string FG(){ return T(GetForegroundWindow()); }
}
'@
[void][FK]::SetProcessDPIAware()
$pids = @(Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
if ($pids.Count -eq 0) { Write-Host '[fk] LabelShop not running'; exit 1 }
$hits = New-Object System.Collections.ArrayList
$cb = [FK+EnumWindowsProc]{
  param([IntPtr]$h, [IntPtr]$l)
  $wpid = 0
  [void][FK]::GetWindowThreadProcessId($h, [ref]$wpid)
  if ($pids -contains [int]$wpid) {
    $t = [FK]::T($h); $c = [FK]::C($h)
    if ([FK]::IsWindowVisible($h) -and $t -like $TitleLike) {
      [void]$hits.Add([pscustomobject]@{ Handle=$h; Title=$t; Class=$c })
    }
  }
  return $true
}
[void][FK]::EnumWindows($cb, [IntPtr]::Zero)
if ($hits.Count -eq 0) { Write-Host "[fk] no visible window matching '$TitleLike'"; exit 1 }
foreach ($w in $hits) { Write-Host ("[fk] found '{0}' class={1}" -f $w.Title, $w.Class) }
if ($ListOnly) { exit 0 }
$target = $hits[0]
# attach to the foreground thread so SetForegroundWindow is allowed
$fg = [FK]::GetForegroundWindow()
$cur = [FK]::GetCurrentThreadId()
$ft = [FK]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
$tt = [FK]::GetWindowThreadProcessId($target.Handle, [IntPtr]::Zero)
[void][FK]::AttachThreadInput($cur, $ft, $true)
[void][FK]::AttachThreadInput($cur, $tt, $true)
[void][FK]::BringWindowToTop($target.Handle)
[void][FK]::SetForegroundWindow($target.Handle)
[void][FK]::AttachThreadInput($cur, $ft, $false)
[void][FK]::AttachThreadInput($cur, $tt, $false)
Start-Sleep -Milliseconds 400
Write-Host ("[fk] foreground now = '{0}'" -f [FK]::FG())
[System.Windows.Forms.SendKeys]::SendWait($Keys)
Write-Host "[fk] sent: $Keys"
Start-Sleep -Milliseconds $WaitMs
exit 0
