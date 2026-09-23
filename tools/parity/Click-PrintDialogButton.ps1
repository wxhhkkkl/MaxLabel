# 强化版"确认 Windows 打印对话框"（验收方 round-261）
# 背景：给对话框发 {ENTER} 后队列里看不到作业 ✗（也可能已瞬间打完 ✓），所以换更硬的办法：
#   ① 枚举该对话框的**子控件**；② 找到文本为「打印」的按钮 → **BM_CLICK** 它（和我在真机 LabelShop 上用的是同一招 ✓）。
#   ③ 把子控件清单打印出来（便于判断对话框此刻是什么状态 ✓）。
param(
  [string]$TitlePattern = '打印|Print',
  [switch]$ListOnly
)
$ErrorActionPreference = 'Continue'
Add-Type @"
using System; using System.Text; using System.Runtime.InteropServices;
public class D {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumWindowsProc cb, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  public delegate bool EnumWindowsProc(IntPtr h, IntPtr p);
}
"@
function T($h) { $sb = New-Object System.Text.StringBuilder 512; [void][D]::GetWindowText($h, $sb, 512); $sb.ToString() }
function C($h) { $sb = New-Object System.Text.StringBuilder 256; [void][D]::GetClassName($h, $sb, 256); $sb.ToString() }

$tops = New-Object System.Collections.ArrayList
$cb = [D+EnumWindowsProc]{ param($h,$p)
  if([D]::IsWindowVisible($h)){ $t = T $h; if($t -and $t -match $TitlePattern){ [void]$tops.Add($h) } }
  return $true }
[void][D]::EnumWindows($cb,[IntPtr]::Zero)
if($tops.Count -eq 0){ 'NO_DIALOG'; exit 0 }

$dlg = $tops[0]
"DIALOG: " + (T $dlg)
$kids = New-Object System.Collections.ArrayList
$cb2 = [D+EnumWindowsProc]{ param($h,$p) [void]$kids.Add($h); return $true }
[void][D]::EnumChildWindows($dlg, $cb2, [IntPtr]::Zero)
"CHILDREN: " + $kids.Count
$btns = @()
foreach($k in $kids){
  $cls = C $k; $txt = T $k
  if($txt -or $cls -match 'Button|ComboBox|Edit'){ "{0,-24} {1}" -f $cls, $txt }
  if($cls -match 'Button' -and $txt -match '^\s*打印'){ $btns += $k }
}
if($ListOnly){ '（--ListOnly：只列不点）'; exit 0 }
if($btns.Count -eq 0){ 'NO_PRINT_BUTTON'; exit 0 }
[void][D]::SetForegroundWindow($dlg); Start-Sleep -Milliseconds 400
# BM_CLICK = 0x00F5
[void][D]::SendMessage($btns[0], 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
'CLICKED: ' + (T $btns[0])
