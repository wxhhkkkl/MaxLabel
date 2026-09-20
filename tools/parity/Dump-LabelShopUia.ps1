# 真机取证：用 UI Automation 读取 LabelShop 某个对话框（或主窗口）的控件树。
# 用途：SysListView32 / ComboBox 这类自绘控件用窗口消息读不干净，UIA 可以取到每行的文字。
#
#   powershell -File tools\parity\Dump-LabelShopUia.ps1 -TitleLike '*安装 LabelShop 打印机*'
#   powershell -File tools\parity\Dump-LabelShopUia.ps1 -TitleLike '*' -Depth 3        # 全窗口浅层
#
# 输出：标准输出 + 可选 -OutFile 落盘（UTF-8）。
[CmdletBinding()]
param(
  [string]$TitleLike = '*',
  [int]$Depth = 6,
  [string]$OutFile = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class UD {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
  public static List<IntPtr> Tops(){ var l=new List<IntPtr>(); EnumWindows((h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
}
'@
[void][UD]::SetProcessDPIAware()

$pids = @(Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
if ($pids.Count -eq 0) { Write-Host '[uia] LabelShop 未运行'; exit 1 }

$targets = New-Object System.Collections.ArrayList
foreach ($h in [UD]::Tops()) {
  $wpid = 0
  [void][UD]::GetWindowThreadProcessId($h, [ref]$wpid)
  if (-not ($pids -contains [int]$wpid)) { continue }
  if (-not [UD]::IsWindowVisible($h)) { continue }
  $t = [UD]::T($h)
  if ($t -notlike $TitleLike) { continue }
  [void]$targets.Add([pscustomobject]@{ Handle = $h; Title = $t; Class = [UD]::C($h) })
}
if ($targets.Count -eq 0) { Write-Host "[uia] 没有匹配 '$TitleLike' 的可见顶层窗口"; exit 1 }

$lines = New-Object System.Collections.ArrayList
foreach ($tgt in $targets) {
  [void]$lines.Add(("=== WINDOW '{0}' class={1} ===" -f $tgt.Title, $tgt.Class))
  try {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($tgt.Handle)
    $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
    $queue = New-Object System.Collections.Queue
    $queue.Enqueue(@($root, 0))
    while ($queue.Count -gt 0) {
      $item = $queue.Dequeue()
      $el = $item[0]; $depth = $item[1]
      if ($depth -gt $Depth) { continue }
      $ct = '?'; $nm = ''; $aid = ''; $val = ''
      try { $ct = $el.Current.ControlType.ProgrammaticName -replace 'ControlType\.', '' } catch { }
      try { $nm = $el.Current.Name } catch { }
      try { $aid = $el.Current.AutomationId } catch { }
      # 跨进程读输入框里的**值**：GetWindowTextW 对别的进程的 Edit 取不到内容，
      # 而 UIA 的 ValuePattern 可以（真机对象属性页的水平/垂直/宽高就靠这个读回来）。
      try {
        $vp = $el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
        if ($vp) { $val = [string]$vp.Current.Value }
      } catch { }
      if (-not $val) {
        try {
          $tp = $el.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern)
          if ($tp) { $val = [string]$tp.Current.ToggleState }
        } catch { }
      }
      $suffix = ''
      if ($aid) { $suffix += " [#$aid]" }
      if ($val -ne '') { $suffix += " = '$val'" }
      if ($nm -or $ct -in @('ListItem', 'List', 'ComboBox', 'Edit', 'Button')) {
        [void]$lines.Add(('{0}{1} :: {2}{3}' -f ('  ' * $depth), $ct, $nm, $suffix))
      }
      $child = $walker.GetFirstChild($el)
      while ($null -ne $child) {
        $queue.Enqueue(@($child, $depth + 1))
        $child = $walker.GetNextSibling($child)
      }
    }
  } catch {
    [void]$lines.Add("UIA 失败: $($_.Exception.Message)")
  }
  [void]$lines.Add('')
}

$lines | ForEach-Object { Write-Host $_ }
if ($OutFile) {
  Set-Content -LiteralPath $OutFile -Value ($lines -join "`r`n") -Encoding UTF8
  Write-Host "[uia] -> $OutFile（$($lines.Count) 行）"
}
