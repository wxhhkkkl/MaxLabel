# 真机取证：直接向当前前台窗口发按键（不改变前台窗口）。
# 与 LabelShopCtl 的 `keys:` 步骤区别：`keys:` 会先把主窗口置前台，这会关掉刚打开的弹出菜单，
# 因此「Alt+F 打开菜单 → 再按菜单加速键」这种两步操作必须用本脚本发第二步。
#
#   powershell -File tools\parity\Send-LabelShopKeys.ps1 -Keys 'l'
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$Keys,
  [int]$WaitMs = 1200
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class FGK {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
}
'@
$fg = [FGK]::GetForegroundWindow()
Write-Host ("[send] 前台窗口 '{0}' class={1}" -f [FGK]::T($fg), [FGK]::C($fg))
[System.Windows.Forms.SendKeys]::SendWait($Keys)
Start-Sleep -Milliseconds $WaitMs
Write-Host '[send] done'
