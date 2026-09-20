# 真机取证：向 LabelShop 对话框里的按钮**投递** BM_CLICK（PostMessage，不等待处理完成）。
# 与 LabelShopCtl 的 `btn:` 步骤区别：`btn:` 用 SendMessage，点「安装」这类会打开模态对话框的按钮时
# 发送方会被阻塞到模态关闭为止；PostMessage 立即返回，模态照常弹出。
#
#   powershell -File tools\parity\Invoke-LabelShopButton.ps1 -TitleLike '*选择标签格式*' -Text 安装
[CmdletBinding()]
param(
  [string]$TitleLike = '*',
  [Parameter(Mandatory=$true)][string]$Text,
  [int]$WaitMs = 1500,
  [switch]$List
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class PB {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool PostMessageW(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
  public static List<IntPtr> Tops(){ var l=new List<IntPtr>(); EnumWindows((h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
  public static List<IntPtr> Kids(IntPtr p){ var l=new List<IntPtr>(); EnumChildWindows(p,(h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
}
'@
[void][PB]::SetProcessDPIAware()

$pid0 = (Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -First 1).Id
if (-not $pid0) { Write-Host '[pb] LabelShop 未运行'; exit 1 }

$dlg = $null
foreach ($h in [PB]::Tops()) {
  $wpid = 0
  [void][PB]::GetWindowThreadProcessId($h, [ref]$wpid)
  if ([int]$wpid -ne $pid0) { continue }
  if (-not [PB]::IsWindowVisible($h)) { continue }
  if ([PB]::T($h) -notlike $TitleLike) { continue }
  $dlg = $h; break
}
if (-not $dlg) { Write-Host "[pb] 没有匹配 '$TitleLike' 的可见顶层窗口"; exit 1 }
Write-Host ("[pb] 目标窗口 '{0}'" -f [PB]::T($dlg))

$hit = $null
foreach ($c in [PB]::Kids($dlg)) {
  if ([PB]::C($c) -notmatch '^Button') { continue }
  $t = [PB]::T($c) -replace '&', ''
  if ($List) { Write-Host ("[pb] button '{0}'" -f [PB]::T($c)); continue }
  if ($t -like "*$Text*") { $hit = $c; break }
}
if ($List) { exit 0 }
if (-not $hit) { Write-Host "[pb] 找不到按钮 '$Text'"; exit 1 }
Write-Host ("[pb] PostMessage BM_CLICK '{0}'" -f [PB]::T($hit))
[void][PB]::PostMessageW($hit, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)
Start-Sleep -Milliseconds $WaitMs
Write-Host '[pb] done'
