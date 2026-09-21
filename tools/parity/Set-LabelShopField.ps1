# 取证小工具：给「另存打印输出为」这类**现代 Common Item Dialog** 注入文件名并按下保存。
#
# 背景（本轮实测踩坑，别再重复）：
#   - LabelShopCtl.ps1 的 keydlg 走 SendKeys，对现代文件对话框**无效**（字段保持空）；
#   - 该对话框也**不在 UIA RootElement 的 Children 里**（UIA 枚举不到，别试图用 ValuePattern）；
#   - 但它的「文件名(N)」框是**真实子 HWND**（class=Edit，在 ComboBox 里），所以 WM_SETTEXT 有效。
# 本脚本用纯 Win32 消息注入，不依赖输入队列，不改动既有工装。
#
# 用法：
#   powershell -File tools\parity\Set-LabelShopField.ps1 -TitleLike '另存打印输出为' `
#     -Value 'D:\path\out.pdf' -InvokeButton '保存'
#   powershell -File tools\parity\Set-LabelShopField.ps1 -TitleLike '另存打印输出为' -ListOnly
[CmdletBinding()]
param(
  [string]$TitleLike = '另存打印输出为',
  [string]$Value = '',
  [string]$InvokeButton = '',
  [switch]$ListOnly
)
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class LSFLD {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageW(IntPtr h, uint msg, IntPtr wp, string lp);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageW(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
  public static List<IntPtr> Tops(){ var l=new List<IntPtr>(); EnumWindows((h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
  public static List<IntPtr> Kids(IntPtr p){ var l=new List<IntPtr>(); EnumChildWindows(p,(h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
}
'@

# 选窗口：优先标题含 $TitleLike；标题匹配不上时退化为「含一个文字以 保存 开头的 Button 的可见 #32770」
$dlg = $null; $title = ''
foreach ($h in [LSFLD]::Tops()) {
  if (-not [LSFLD]::IsWindowVisible($h)) { continue }
  $t = [LSFLD]::T($h)
  if ($TitleLike -and $t -like "*$TitleLike*") { $dlg = $h; $title = $t; break }
}
if (-not $dlg) {
  foreach ($h in [LSFLD]::Tops()) {
    if (-not [LSFLD]::IsWindowVisible($h)) { continue }
    if ([LSFLD]::C($h) -ne '#32770') { continue }
    $hasSave = $false
    foreach ($c in [LSFLD]::Kids($h)) {
      if ([LSFLD]::C($c) -eq 'Button' -and ([LSFLD]::T($c) -replace '&','') -like '保存*') { $hasSave = $true; break }
    }
    if ($hasSave) { $dlg = $h; $title = [LSFLD]::T($h); break }
  }
}
if (-not $dlg) { Write-Host "[fld] 没找到标题含 '$TitleLike' 的可见顶层窗口"; exit 1 }
Write-Host ("[fld] 窗口 '{0}' handle=0x{1:X}" -f $title, $dlg.ToInt64())

$kids = [LSFLD]::Kids($dlg)
if ($ListOnly) {
  foreach ($c in $kids) {
    $r = New-Object LSFLD+RECT
    [void][LSFLD]::GetWindowRect($c, [ref]$r)
    Write-Host ("[fld] class={0,-26} text='{1}' rel=({2},{3}) wh=({4}x{5}) h=0x{6:X}" -f `
      [LSFLD]::C($c), [LSFLD]::T($c), ($r.Left - $r.Top*0), $r.Top, ($r.Right - $r.Left), ($r.Bottom - $r.Top), $c.ToInt64())
  }
  exit 0
}

# 「文件名(N)」框 = 位置最靠下的 Edit（地址栏 Edit 在上方）
$edit = $null; $bestTop = -1
foreach ($c in $kids) {
  if ([LSFLD]::C($c) -ne 'Edit') { continue }
  $r = New-Object LSFLD+RECT
  [void][LSFLD]::GetWindowRect($c, [ref]$r)
  if ($r.Top -gt $bestTop) { $bestTop = $r.Top; $edit = $c }
}
if (-not $edit) { Write-Host '[fld] 没找到 Edit 控件'; exit 2 }

if ($Value) {
  [void][LSFLD]::SendMessageW($edit, 0x000C, [IntPtr]::Zero, $Value)   # WM_SETTEXT
  Start-Sleep -Milliseconds 500
  $sb = New-Object System.Text.StringBuilder 600
  [void][LSFLD]::GetWindowTextW($edit, $sb, 600)
  Write-Host ("[fld] WM_SETTEXT -> 回读 '{0}'" -f $sb.ToString())
}

if ($InvokeButton) {
  $btn = $null
  foreach ($c in $kids) {
    if ([LSFLD]::C($c) -ne 'Button') { continue }
    $t = ([LSFLD]::T($c)) -replace '&', ''
    if ($t -like "*$InvokeButton*") { $btn = $c; break }
  }
  if (-not $btn) { Write-Host "[fld] 没找到按钮 '$InvokeButton'"; exit 3 }
  [void][LSFLD]::SendMessageW($btn, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)  # BM_CLICK
  Write-Host ("[fld] BM_CLICK '{0}'" -f [LSFLD]::T($btn))
}
