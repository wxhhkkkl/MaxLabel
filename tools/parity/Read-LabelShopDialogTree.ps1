# 真机取证：递归 dump 某个对话框/窗口的完整控件树（含嵌套页签 #32770 子对话框）。
#
#   powershell -File tools\parity\Read-LabelShopDialogTree.ps1 -TitleLike '*标签格式设置*'
#   powershell -File tools\parity\Read-LabelShopDialogTree.ps1 -TitleLike '*标签格式设置*' -OutFile x.txt
#
# 与 LabelShopCtl 的 `listctl:` 步骤区别：那个只列直接子控件，页签页（class=#32770）里
# 的控件看不到；本脚本递归下去，并按可见性标注（页签切换时可见性变化）。
[CmdletBinding()]
param(
  [string]$TitleLike = '*',
  [int]$MaxDepth = 4,
  [string]$OutFile = '',
  [switch]$VisibleOnly
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class DT {
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
  public static IntPtr Parent(IntPtr h){ return GetParent(h); }
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
}
'@
[void][DT]::SetProcessDPIAware()

$proc = Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Host '[tree] LabelShop 未运行'; exit 1 }
$roots = @()
foreach ($h in [DT]::Tops()) {
  $wpid = 0
  [void][DT]::GetWindowThreadProcessId($h, [ref]$wpid)
  if ([int]$wpid -ne $proc.Id) { continue }
  if (-not [DT]::IsWindowVisible($h)) { continue }
  if ([DT]::T($h) -notlike $TitleLike) { continue }
  $roots += $h
}
if ($roots.Count -eq 0) { Write-Host "[tree] 没有匹配 '$TitleLike' 的可见顶层窗口"; exit 1 }

$lines = New-Object System.Collections.ArrayList
foreach ($root in $roots) {
  [void]$lines.Add(("=== WINDOW '{0}' class={1} ===" -f [DT]::T($root), [DT]::C($root)))
  $walk = {
    param([IntPtr]$parent, [int]$depth)
    if ($depth -gt $MaxDepth) { return }
    foreach ($child in [DT]::Kids($parent)) {
      # EnumChildWindows 是递归的，这里只处理「直接子级」：父窗口等于当前窗口
      if ([DT]::Parent($child) -ne $parent) { continue }
      $cls = [DT]::C($child); $txt = [DT]::T($child)
      $visible = [DT]::IsWindowVisible($child); $enabled = [DT]::IsWindowEnabled($child)
      if ((-not $VisibleOnly) -or $visible) {
        $r = New-Object DT+RECT
        [void][DT]::GetWindowRect($child, [ref]$r)
        $visMark = if ($visible) { 'V' } else { ' ' }
        $enMark = if ($enabled) { 'enabled ' } else { 'DISABLED' }
        $txtMark = if ($txt) { "'" + $txt + "'" } else { "''" }
        $indent = '  ' * $depth
        $w = $r.Right - $r.Left
        $h = $r.Bottom - $r.Top
        [void]$lines.Add(('{0}[{1}] class={2,-26} {3} text={4} xy=({5},{6}) wh=({7}x{8})' -f $indent, $visMark, $cls, $enMark, $txtMark, $r.Left, $r.Top, $w, $h))
      }
      & $walk $child ($depth + 1)
    }
  }
  & $walk $root 0
  [void]$lines.Add('')
}
$lines | ForEach-Object { Write-Host $_ }
if ($OutFile) {
  Set-Content -LiteralPath $OutFile -Value ($lines -join "`r`n") -Encoding UTF8
  Write-Host "[tree] -> $OutFile（$($lines.Count) 行）"
}
