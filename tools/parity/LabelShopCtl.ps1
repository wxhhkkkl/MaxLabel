<#
.SYNOPSIS
  真机 LabelShop 取证/驱动控制器。

.DESCRIPTION
  原版 LabelShop 是 MFC Feature Pack（Ribbon + 停靠面板）应用，没有经典 Win32 菜单，
  因此相似度取证以「截图 + 视觉对照 + 快捷键/点击驱动」为主。本脚本提供：

    -Action capture  启动并抓取主窗口截图 + 窗口树（默认）
    -Action run      按脚本化步骤驱动：keys:^{n} / click:x,y / sleep:800 / shot:名称 /
                     closedialogs / dialoglist / tab:文件
    -Action shot     只截当前主窗口
    -Action list     列出所有顶层窗口（进程内），用于定位对话框/浮动面板
    -Action close    关闭 LabelShop
    -KeepOpen        结束后不关闭进程

  产出目录默认 parity\reference\labelshop\，是复刻相似度的权威基准，只读使用。

.EXAMPLE
  # 抓一张主界面
  powershell -File tools/parity/LabelShopCtl.ps1 -Action capture -Label main

  # 打开"新建标签"对话框并截图
  powershell -File tools/parity/LabelShopCtl.ps1 -Action run -Steps 'keys:^{n}','sleep:2500','shot:dlg-new-label'
#>
[CmdletBinding()]
param(
  [ValidateSet('capture', 'run', 'shot', 'list', 'close', 'start')]
  [string]$Action = 'capture',
  [string[]]$Steps = @(),
  [string]$Keys,
  [string]$Point,
  [string]$Label = 'main',
  [string]$ExePath = 'C:\Program Files (x86)\LabelShop\LabelShop\LabelShop.exe',
  [string]$OutDir,
  [int]$WaitSeconds = 60,
  [switch]$KeepOpen,
  [switch]$KeepDialogs
)

$ErrorActionPreference = 'Stop'
if (-not $OutDir) { $OutDir = Join-Path $PSScriptRoot '..\..\parity\reference\labelshop' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$OutDir = (Resolve-Path -LiteralPath $OutDir).Path

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class LS32 {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, IntPtr extra);
  [DllImport("user32.dll")] public static extern bool PostMessageW(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageW(IntPtr h, uint msg, IntPtr w, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
  public static List<IntPtr> Tops(){ var l=new List<IntPtr>(); EnumWindows((h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
  public static List<IntPtr> Kids(IntPtr p){ var l=new List<IntPtr>(); EnumChildWindows(p,(h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
}
'@

# 声明 DPI 感知：否则本进程拿到的是被系统缩放过的窗口矩形/坐标，
# 会造成截图被裁切、点击落点偏移（原版 LabelShop 是 DPI-aware 的 MFC 程序）。
try { [void][LS32]::SetProcessDPIAware() } catch { Write-Host "[warn] SetProcessDPIAware 失败：$($_.Exception.Message)" }

function Get-LsWindows {
  $pids = @(Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
  $out = @()
  if ($pids.Count -eq 0) { return $out }
  foreach ($h in [LS32]::Tops()) {
    $wpid = 0
    [void][LS32]::GetWindowThreadProcessId($h, [ref]$wpid)
    if ($pids -contains [int]$wpid) {
      $r = New-Object LS32+RECT
      [void][LS32]::GetWindowRect($h, [ref]$r)
      $out += [pscustomobject]@{
        Handle  = $h
        Pid     = [int]$wpid
        Class   = [LS32]::C($h)
        Title   = [LS32]::T($h)
        Visible = [LS32]::IsWindowVisible($h)
        Left    = $r.Left; Top = $r.Top; Right = $r.Right; Bottom = $r.Bottom
        Width   = $r.Right - $r.Left; Height = $r.Bottom - $r.Top
      }
    }
  }
  return $out
}

function Get-MainWindow {
  $wins = Get-LsWindows
  if ($wins.Count -eq 0) { return $null }
  # 1) 优先用 .NET 的 MainWindowHandle（MFC 主框架 Afx: 窗口）
  foreach ($p in (Get-Process -Name LabelShop -ErrorAction SilentlyContinue)) {
    $mh = $p.MainWindowHandle
    if ($mh -ne 0) {
      $hit = $wins | Where-Object { $_.Handle -eq [IntPtr]$mh }
      if ($hit -and $hit.Visible) { return $hit }
    }
  }
  # 2) 退化：可见且面积最大的 Afx: 窗口
  $cands = $wins | Where-Object { $_.Visible -and $_.Class -like 'Afx:*' } | Sort-Object { -($_.Width * $_.Height) }
  if ($cands.Count -gt 0) { return $cands[0] }
  # 3) 再退化：可见且面积最大的窗口
  $cands2 = $wins | Where-Object { $_.Visible -and $_.Width -gt 300 } | Sort-Object { -($_.Width * $_.Height) }
  if ($cands2.Count -gt 0) { return $cands2[0] }
  return $null
}

function Get-LsDialogs {
  $wins = Get-LsWindows
  return @($wins | Where-Object { $_.Visible -and $_.Class -eq '#32770' })
}

function Force-Foreground {
  param([IntPtr]$Hwnd)
  # 只在最小化时恢复，避免把最大化窗口还原成小窗
  if ([LS32]::IsIconic($Hwnd)) { [void][LS32]::ShowWindow($Hwnd, 9) }  # SW_RESTORE
  $fg = [LS32]::GetForegroundWindow()
  $targetThread = [LS32]::GetWindowThreadProcessId($Hwnd, [IntPtr]::Zero)
  $fgThread = [LS32]::GetWindowThreadProcessId($fg, [IntPtr]::Zero)
  $cur = [LS32]::GetCurrentThreadId()
  [void][LS32]::AttachThreadInput($cur, $targetThread, $true)
  if ($fgThread -ne 0) { [void][LS32]::AttachThreadInput($cur, $fgThread, $true) }
  [void][LS32]::BringWindowToTop($Hwnd)
  [void][LS32]::SetForegroundWindow($Hwnd)
  [void][LS32]::AttachThreadInput($cur, $targetThread, $false)
  if ($fgThread -ne 0) { [void][LS32]::AttachThreadInput($cur, $fgThread, $false) }
  Start-Sleep -Milliseconds 350
}

function Save-Shot {
  param([System.Object]$Win, [string]$Name, [switch]$Screen, [int]$PadW = 0, [int]$PadH = 0)
  if ($null -eq $Win) { throw '没有可截图的目标窗口' }
  $h = $Win.Handle
  # 默认整窗 PrintWindow（含标题栏/边框）；-Screen 走屏幕抓取；PadW/PadH 给菜单弹窗留出被窗口矩形裁掉的部分
  $w = $Win.Width + $PadW; $ht = $Win.Height + $PadH
  if ($w -le 0 -or $ht -le 0) { throw "窗口尺寸无效: $w x $ht" }
  $bmp = New-Object System.Drawing.Bitmap $w, $ht
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  if ($Screen) {
    $g.CopyFromScreen($Win.Left, $Win.Top, 0, 0, (New-Object System.Drawing.Size $w, $ht))
  } else {
    $hdc = $g.GetHdc()
    $ok = [LS32]::PrintWindow($h, $hdc, 2)
    $g.ReleaseHdc($hdc)
    if (-not $ok) {
      $g.CopyFromScreen($Win.Left, $Win.Top, 0, 0, (New-Object System.Drawing.Size $w, $ht))
    }
  }
  $g.Dispose()
  $path = Join-Path $OutDir ("$Name.png")
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  Write-Host "[shot] $path ($w x $ht)"
  return $path
}

function Start-LabelShop {
  param([switch]$Force)
  $running = @(Get-Process -Name LabelShop -ErrorAction SilentlyContinue)
  if ($running.Count -gt 0 -and -not $Force) { return }
  if ($Force) { $running | Stop-Process -Force -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 500 }
  Start-Process -FilePath $ExePath | Out-Null
  Write-Host '[start] LabelShop 已启动，等待主窗口…'
  $deadline = (Get-Date).AddSeconds($WaitSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Get-MainWindow) { break }
    Start-Sleep -Milliseconds 800
  }
  if (-not (Get-MainWindow)) { throw "等待 LabelShop 主窗口超时（${WaitSeconds}s）" }
  Start-Sleep -Milliseconds 1500
  # 统一最大化，保证取证截图包含完整布局（菜单/工具栏/格式栏/对齐栏/状态栏）
  $mw = Get-MainWindow
  if ($mw -and -not [LS32]::IsZoomed($mw.Handle)) {
    Force-Foreground -Hwnd $mw.Handle
    [void][LS32]::ShowWindow($mw.Handle, 3)  # SW_MAXIMIZE
    Start-Sleep -Milliseconds 1200
  }
  if (-not $KeepDialogs) { Close-LsDialogs }
}

function Close-LsDialogs {
  # 启动时的「管理软件许可」等模态框会挡住主界面；先留证再关闭
  $dlgs = Get-LsDialogs
  foreach ($d in $dlgs) {
    Write-Host "[dialog] 关闭 '$($d.Title)' ($($d.Width)x$($d.Height))"
    # 先试试 ESC（MFC 对话框取消按钮），再 WM_CLOSE
    [void][LS32]::PostMessageW($d.Handle, 0x0100, [IntPtr]0x1B, [IntPtr]::Zero)  # WM_KEYDOWN VK_ESCAPE
    [void][LS32]::PostMessageW($d.Handle, 0x0101, [IntPtr]0x1B, [IntPtr]::Zero)  # WM_KEYUP
    Start-Sleep -Milliseconds 500
    if ([LS32]::IsWindowVisible($d.Handle)) {
      [void][LS32]::PostMessageW($d.Handle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)  # WM_CLOSE
      Start-Sleep -Milliseconds 700
    }
  }
  $left = Get-LsDialogs
  foreach ($d in $left) {
    Force-Foreground -Hwnd (Get-MainWindow).Handle
    [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
    Start-Sleep -Milliseconds 600
  }
}

function Invoke-Step {
  param([string]$Step)
  $idx = $Step.IndexOf(':')
  $verb = if ($idx -ge 0) { $Step.Substring(0, $idx).Trim().ToLower() } else { $Step.Trim().ToLower() }
  $arg = if ($idx -ge 0) { $Step.Substring($idx + 1).Trim() } else { '' }
  switch ($verb) {
    'keys' {
      $main = Get-MainWindow
      Force-Foreground -Hwnd $main.Handle
      Write-Host "[step] keys: $arg"
      [System.Windows.Forms.SendKeys]::SendWait($arg)
      Start-Sleep -Milliseconds 700
    }
    'click' {
      $parts = $arg -split ','
      $x = [int]$parts[0].Trim(); $y = [int]$parts[1].Trim()
      $main = Get-MainWindow
      Force-Foreground -Hwnd $main.Handle
      $sx = $main.Left + $x; $sy = $main.Top + $y
      Write-Host "[step] click: 窗口内($x,$y) → 屏幕($sx,$sy)"
      [void][LS32]::SetCursorPos($sx, $sy)
      Start-Sleep -Milliseconds 150
      [LS32]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
      Start-Sleep -Milliseconds 60
      [LS32]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)
      Start-Sleep -Milliseconds 900
    }
    'sleep' {
      $ms = [int]$arg
      Start-Sleep -Milliseconds $ms
    }
    'clickdlg' {
      # 在「当前最上层对话框」坐标系里点击（向导类界面用）
      $parts = $arg -split ','
      $x = [int]$parts[0].Trim(); $y = [int]$parts[1].Trim()
      $d = Get-LsDialogs | Sort-Object { -($_.Width * $_.Height) } | Select-Object -First 1
      if (-not $d) { Write-Host '[step] clickdlg: 没有可见对话框'; }
      else {
        Force-Foreground -Hwnd $d.Handle
        $sx = $d.Left + $x; $sy = $d.Top + $y
        Write-Host "[step] clickdlg: 对话框内($x,$y) → 屏幕($sx,$sy)"
        [void][LS32]::SetCursorPos($sx, $sy)
        Start-Sleep -Milliseconds 150
        [LS32]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
        Start-Sleep -Milliseconds 60
        [LS32]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)
        Start-Sleep -Milliseconds 900
      }
    }
    'keydlg' {
      # 给最上层对话框发按键（默认按钮用 {ENTER}）
      $d = Get-LsDialogs | Sort-Object { -($_.Width * $_.Height) } | Select-Object -First 1
      if ($d) { Force-Foreground -Hwnd $d.Handle }
      Write-Host "[step] keydlg: $arg"
      [System.Windows.Forms.SendKeys]::SendWait($arg)
      Start-Sleep -Milliseconds 900
    }
    'maximize' {
      $mw = Get-MainWindow
      Force-Foreground -Hwnd $mw.Handle
      [void][LS32]::ShowWindow($mw.Handle, 3)
      Start-Sleep -Milliseconds 1000
      Write-Host '[step] maximize'
    }
    'close' {
      # 关闭当前最上层对话框（ESC → WM_CLOSE），并额外发一次 ESC 收起可能打开的菜单
      Close-LsDialogs
      $mw = Get-MainWindow
      if ($mw) {
        Force-Foreground -Hwnd $mw.Handle
        [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
        Start-Sleep -Milliseconds 400
      }
    }
    'shot' {
      $win = Get-LsWindows | Where-Object { $_.Visible -and $_.Width -gt 200 } | Sort-Object { -($_.Width * $_.Height) } | Select-Object -First 1
      Save-Shot -Win $win -Name $arg | Out-Null
    }
    'shotmain' {
      Save-Shot -Win (Get-MainWindow) -Name $arg | Out-Null
    }
    'shotscreen' {
      # 屏幕抓取主窗口区域：能拍到弹出菜单等浮层
      Save-Shot -Win (Get-MainWindow) -Name $arg -Screen | Out-Null
    }
    'shotdlg' {
      # 抓最上层可见对话框（#32770），没有则退回最大可见窗口
      $d = Get-LsDialogs | Sort-Object { -($_.Width * $_.Height) } | Select-Object -First 1
      if (-not $d) {
        $d = Get-LsWindows | Where-Object { $_.Visible -and $_.Width -gt 200 } | Sort-Object { -($_.Width * $_.Height) } | Select-Object -First 1
      }
      Save-Shot -Win $d -Name $arg | Out-Null
    }
    'shotpopup' {
      # 抓 MFC 弹出菜单窗口自身位图（class 形如 Afx:...:800:...），屏幕抓取拍不到它
      $p = Get-LsWindows | Where-Object { $_.Visible -and $_.Class -like 'Afx:*:800:*' } | Sort-Object { ($_.Width * $_.Height) } | Select-Object -First 1
      if (-not $p) {
        Write-Host '[step] shotpopup: 当前没有弹出菜单窗口'
      } else {
        Write-Host ("[step] popup '{0}' {1}x{2} at ({3},{4})" -f $p.Class, $p.Width, $p.Height, $p.Left, $p.Top)
        # 进程已声明 DPI 感知，窗口矩形即真实尺寸；留一点余量防止边缘被裁
        Save-Shot -Win $p -Name $arg -PadW 60 -PadH 60 | Out-Null
      }
    }
    'uiapopup' {
      # 用 UI Automation 读取弹出菜单窗口里的菜单项文字，写入 uia-<name>.txt
      $p = Get-LsWindows | Where-Object { $_.Visible -and $_.Class -like 'Afx:*:800:*' } | Sort-Object { ($_.Width * $_.Height) } | Select-Object -First 1
      $target = if ($p) { $p.Handle } else { (Get-MainWindow).Handle }
      $lines = @()
      try {
        Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes -ErrorAction SilentlyContinue
        $root = [System.Windows.Automation.AutomationElement]::FromHandle($target)
        $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
        $queue = New-Object System.Collections.Queue
        $queue.Enqueue(@($root, 0))
        while ($queue.Count -gt 0) {
          $item = $queue.Dequeue()
          $el = $item[0]; $depth = $item[1]
          if ($depth -gt 4) { continue }
          $ct = ''
          try { $ct = $el.Current.ControlType.ProgrammaticName -replace 'ControlType\.', '' } catch { $ct = '?' }
          $nm = ''
          try { $nm = $el.Current.Name } catch { $nm = '' }
          if ($nm -or $ct -eq 'MenuItem') {
            $lines += ('{0}{1} :: {2}' -f ('  ' * $depth), $ct, $nm)
          }
          $child = $walker.GetFirstChild($el)
          while ($null -ne $child) {
            $queue.Enqueue(@($child, $depth + 1))
            $child = $walker.GetNextSibling($child)
          }
        }
      } catch {
        $lines += "UIA 失败: $($_.Exception.Message)"
      }
      $out = Join-Path $OutDir ("uia-" + $arg + ".txt")
      Set-Content -LiteralPath $out -Value ($lines -join "`r`n") -Encoding UTF8
      Write-Host "[step] uiapopup -> $out（$($lines.Count) 行）"
    }
    'closedialogs' { Close-LsDialogs }
    'dialoglist' {
      $d = Get-LsDialogs
      foreach ($x in $d) { Write-Host ("[dialog] '{0}' class={1} {2}x{3} at ({4},{5})" -f $x.Title, $x.Class, $x.Width, $x.Height, $x.Left, $x.Top) }
    }
    'list' {
      foreach ($x in (Get-LsWindows | Where-Object { $_.Visible })) {
        Write-Host ("[win] '{0}' class={1} {2}x{3} at ({4},{5})" -f $x.Title, $x.Class, $x.Width, $x.Height, $x.Left, $x.Top)
      }
    }
    default { Write-Host "[step] 未知步骤: $Step" }
  }
}

# ------------------------------- 入口 -------------------------------
switch ($Action) {
  'start' { Start-LabelShop; [void](Get-MainWindow); Write-Host '[start] 就绪' }
  'close' {
    Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host '[close] 已关闭 LabelShop'
  }
  'list' {
    if (-not (Get-LsWindows)) { Write-Host '[list] LabelShop 未运行' }
    foreach ($x in (Get-LsWindows | Where-Object { $_.Visible })) {
      Write-Host ("[win] '{0}' class={1} {2}x{3} at ({4},{5})" -f $x.Title, $x.Class, $x.Width, $x.Height, $x.Left, $x.Top)
    }
  }
  'shot' {
    $main = Get-MainWindow
    if (-not $main) { throw 'LabelShop 未运行' }
    Save-Shot -Win $main -Name $Label | Out-Null
  }
  'capture' {
    Start-LabelShop
    $main = Get-MainWindow
    Force-Foreground -Hwnd $main.Handle
    $winTree = @()
    foreach ($x in (Get-LsWindows)) {
      $winTree += [ordered]@{
        class = $x.Class; title = $x.Title; visible = $x.Visible
        rect = @{ left = $x.Left; top = $x.Top; right = $x.Right; bottom = $x.Bottom; width = $x.Width; height = $x.Height }
      }
    }
    Set-Content -LiteralPath (Join-Path $OutDir 'windows.json') -Value ($winTree | ConvertTo-Json -Depth 8) -Encoding UTF8
    Save-Shot -Win $main -Name $Label | Out-Null
    $dlgs = Get-LsDialogs
    foreach ($d in $dlgs) {
      $safe = ($d.Title -replace '[\\/:*?"<>|\s]', '_')
      if ($safe) { Save-Shot -Win $d -Name ("dlg-$safe") | Out-Null }
    }
    $info = @"
# LabelShop 真机取证

- 主窗口标题：$($main.Title)
- 窗口类：$($main.Class)
- 窗口尺寸：$($main.Width) x $($main.Height)
- 采集时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
- 可见窗口：$((Get-LsWindows | Where-Object { $_.Visible } | ForEach-Object { $_.Title }) -join ' | ')
"@
    Set-Content -LiteralPath (Join-Path $OutDir 'README.md') -Value $info -Encoding UTF8
    if (-not $KeepOpen) {
      Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
      Write-Host '[capture] 已关闭 LabelShop'
    }
  }
  'run' {
    Start-LabelShop
    $main = Get-MainWindow
    Force-Foreground -Hwnd $main.Handle
    if ($Keys) { Invoke-Step -Step ("keys:" + $Keys) }
    if ($Point) { Invoke-Step -Step ("click:" + $Point) }
    foreach ($s in $Steps) { Invoke-Step -Step $s }
    if (-not $KeepOpen) {
      Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
      Write-Host '[run] 步骤执行完成，已关闭 LabelShop'
    }
  }
}
