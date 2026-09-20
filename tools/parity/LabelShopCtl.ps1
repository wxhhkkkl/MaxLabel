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
  # 1) 优先用 .NET 的 MainWindowHandle，但要求它确实是主框架（够大），
  #    否则某些时刻（向导/模态切换）MainWindowHandle 会指向小浮窗（曾抓到 141x67）
  foreach ($p in (Get-Process -Name LabelShop -ErrorAction SilentlyContinue)) {
    $mh = $p.MainWindowHandle
    if ($mh -ne 0) {
      $hit = $wins | Where-Object { $_.Handle -eq [IntPtr]$mh }
      if ($hit -and $hit.Visible -and $hit.Width -gt 800) { return $hit }
    }
  }
  # 注意：PS 5.1 里「单元素查询结果」的 .Count 可能是 $null，所有筛选必须用 @() 强制成数组再判空
  # 2) 退化：可见且面积最大的 Afx: 窗口
  $cands = @($wins | Where-Object { $_.Visible -and $_.Class -like 'Afx:*' } | Sort-Object { -($_.Width * $_.Height) })
  if ($cands.Count -gt 0) { return $cands[0] }
  # 3) 再退化：可见且面积最大的窗口
  $cands2 = @($wins | Where-Object { $_.Visible -and $_.Width -gt 300 } | Sort-Object { -($_.Width * $_.Height) })
  if ($cands2.Count -gt 0) { return $cands2[0] }
  # 4) 兜底：连可见性都不要求（某些模态切换瞬间主窗会被判定为不可见）
  $cands3 = @($wins | Where-Object { $_.Class -like 'Afx:*' -and $_.Width -gt 800 } | Sort-Object { -($_.Width * $_.Height) })
  if ($cands3.Count -gt 0) { return $cands3[0] }
  return $null
}

function Get-LsDialogs {
  # EnumWindows 按 z-order 返回（最上层在前），所以这里保持顺序 = 从上到下
  $wins = Get-LsWindows
  return @($wins | Where-Object { $_.Visible -and $_.Class -eq '#32770' })
}

function Get-TopDialog {
  # 取最上层的可见对话框（不要用面积最大：高级打印选项那类会选错）
  $d = @(Get-LsDialogs)
  if ($d.Count -eq 0) { return $null }
  return $d[0]
}

function Get-DocViewWindow {
  # 精确定位「当前标签文档」的画布视图窗口：
  #   1) 先找标题=文档名的文档框架子窗口（class 形如 Afx:00CC0000:...），再取它下面的 AfxFrameOrView* 视图
  #   2) 退化：所有可见且宽度 > 800 的 AfxFrameOrView* 里，排除「启始页」视图后取枚举顺序第一个
  param([string]$DocName)
  $main = Get-MainWindow
  if (-not $main) { return $null }
  $frame = $null
  foreach ($c in [LS32]::Kids($main.Handle)) {
    $cls = [LS32]::C($c)
    if ($cls -like 'Afx:00CC0000:*' -and $DocName -and ([LS32]::T($c) -like "*$DocName*")) { $frame = $c; break }
  }
  if ($frame) {
    foreach ($v in [LS32]::Kids($frame)) {
      if ([LS32]::C($v) -like '*AfxFrameOrView*') {
        $r = New-Object LS32+RECT
        [void][LS32]::GetWindowRect($v, [ref]$r)
        if (($r.Right - $r.Left) -gt 800) {
          return [pscustomobject]@{ Handle = $v; Class = [LS32]::C($v); Title = [LS32]::T($v); W = ($r.Right - $r.Left); H = ($r.Bottom - $r.Top) }
        }
      }
    }
  }
  $views = @()
  foreach ($c in [LS32]::Kids($main.Handle)) {
    $cls = [LS32]::C($c)
    if ($cls -like '*AfxFrameOrView*' -and [LS32]::IsWindowVisible($c)) {
      $r = New-Object LS32+RECT
      [void][LS32]::GetWindowRect($c, [ref]$r)
      # 宽度过滤：排除左侧图层树视图（298px 宽）
      if (($r.Right - $r.Left) -gt 800) {
        $views += [pscustomobject]@{ Handle = $c; Class = $cls; Title = [LS32]::T($c); W = ($r.Right - $r.Left); H = ($r.Bottom - $r.Top) }
      }
    }
  }
  if ($views.Count -eq 0) { return $null }
  $notStart = @($views | Where-Object { $_.Title -notlike '*启始页*' })
  if ($notStart.Count -ge 1) { return $notStart[0] }
  return $views[0]
}

function Force-Foreground {
  param([System.Object]$Hwnd)
  # 容忍 null：某些瞬间（向导/模态切换）拿不到主窗口，不要因为置前失败就整轮崩掉
  if ($null -eq $Hwnd) { Write-Host '[warn] Force-Foreground: 句柄为空，跳过置前'; return }
  if ($Hwnd -isnot [IntPtr]) { $Hwnd = [IntPtr]$Hwnd }
  if ($Hwnd -eq [IntPtr]::Zero) { Write-Host '[warn] Force-Foreground: 句柄为 0，跳过置前'; return }
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
  if ($null -eq $Win) {
    Start-Sleep -Milliseconds 1500
    $Win = Get-MainWindow
    if ($null -eq $Win) { throw '没有可截图的目标窗口（重试后仍为空）' }
  }
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
      $d = Get-TopDialog
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
      $d = Get-TopDialog
      if ($d) { Force-Foreground -Hwnd $d.Handle }
      Write-Host "[step] keydlg: $arg"
      [System.Windows.Forms.SendKeys]::SendWait($arg)
      Start-Sleep -Milliseconds 900
    }
    'listctl' {
      # 枚举子控件（递归）。arg 为空则列全部；否则只列 class/文字 含该子串的。
      # 注意：本机鼠标注入（mouse_event）对原版无效，所以要靠控件枚举 + 窗口消息操作。
      $filter = $arg
      $d = Get-TopDialog
      $rootWin = if ($d) { $d } else { Get-MainWindow }
      $found = 0
      foreach ($c in [LS32]::Kids($rootWin.Handle)) {
        $cls = [LS32]::C($c); $txt = [LS32]::T($c)
        if ($filter -and -not (($cls -like "*$filter*") -or ($txt -like "*$filter*"))) { continue }
        $fr = New-Object LS32+RECT
        [void][LS32]::GetWindowRect($c, [ref]$fr)
        $rel = @{ x = ($fr.Left - $rootWin.Left); y = ($fr.Top - $rootWin.Top); w = ($fr.Right - $fr.Left); h = ($fr.Bottom - $fr.Top) }
        if ($txt -or $cls -match 'Button|Edit|Combo|Static|List|Sys|Afx|Rich') {
          Write-Host ("[ctl] class={0,-28} text='{1}' xy=({2},{3}) wh=({4}x{5}) handle=0x{6:X}" -f $cls, $txt, $rel.x, $rel.y, $rel.w, $rel.h, $c.ToInt64())
          $found++
        }
      }
      Write-Host "[step] listctl: 命中 $found 个控件（根窗口 '$($rootWin.Title)'）"
    }
    'btn' {
      # 用 BM_CLICK 点按钮（窗口消息，不依赖鼠标注入）。arg = 按钮文字（含匹配）
      $d = Get-TopDialog
      $rootWin = if ($d) { $d } else { Get-MainWindow }
      $hit = $null
      foreach ($c in [LS32]::Kids($rootWin.Handle)) {
        if ([LS32]::C($c) -ne 'Button') { continue }
        $txt = [LS32]::T($c) -replace '&', ''
        if ($txt -like "*$arg*") { $hit = $c; break }
      }
      if (-not $hit) { Write-Host "[step] btn: 找不到按钮 '$arg'" }
      else {
        Write-Host ("[step] btn: BM_CLICK '{0}' (0x{1:X})" -f ([LS32]::T($hit)), $hit.ToInt64())
        [void][LS32]::SendMessageW($hit, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero)  # BM_CLICK
        Start-Sleep -Milliseconds 900
      }
    }
    'postclick' {
      # arg = <class子串>|<x>,<y>  给匹配的子窗口投递 WM_LBUTTONDOWN/UP（画布等自绘窗口用）
      $seg = $arg -split '\|', 2
      if ($seg.Count -lt 2) { Write-Host '[step] postclick: 参数格式应为 <class子串>|<x>,<y>'; }
      else {
        $classSub = $seg[0].Trim()
        $xy = $seg[1] -split ','
        $x = [int]$xy[0].Trim(); $y = [int]$xy[1].Trim()
        $main = Get-MainWindow
        $docName = ''
        if ($main -and $main.Title -match '-\s*([^-]+)$') { $docName = $Matches[1].Trim() }
        $target = $null
        if ($classSub -eq 'docview') {
          # 传 docview 时按「当前文档名」定位真正的文档视图窗口（框架窗的客户区原点不是画布原点）
          $dv = Get-DocViewWindow -DocName $docName
          if ($dv) {
            Write-Host ("[step] docview 命中：class={0} title='{1}' {2}x{3}" -f $dv.Class, $dv.Title, $dv.W, $dv.H)
            $target = $dv.Handle
          }
        } else {
          foreach ($c in [LS32]::Kids($main.Handle)) {
            if ([LS32]::C($c) -like "*$classSub*" -and [LS32]::IsWindowVisible($c)) {
              $rc = New-Object LS32+RECT
              [void][LS32]::GetWindowRect($c, [ref]$rc)
              if (($rc.Right - $rc.Left) -gt 100) { $target = $c; break }
            }
          }
        }
        if (-not $target) {
          Write-Host "[step] postclick: 没找到 class 含 '$classSub' 的可见大子窗口"
        } else {
          $lp = [IntPtr](($y -shl 16) -bor ($x -band 0xFFFF))
          Write-Host ("[step] postclick: class={0} 客户端({1},{2})" -f [LS32]::C($target), $x, $y)
          [void][LS32]::PostMessageW($target, 0x0200, [IntPtr]::Zero, $lp)   # WM_MOUSEMOVE
          [void][LS32]::PostMessageW($target, 0x0201, [IntPtr]1, $lp)        # WM_LBUTTONDOWN (MK_LBUTTON)
          Start-Sleep -Milliseconds 150
          [void][LS32]::PostMessageW($target, 0x0202, [IntPtr]::Zero, $lp)   # WM_LBUTTONUP
          Start-Sleep -Milliseconds 900
        }
      }
    }
    'postdbl' {
      # arg = <class子串>|<x>,<y>  双击（WM_LBUTTONDBLCLK），用于打开对象属性
      $seg = $arg -split '\|', 2
      if ($seg.Count -lt 2) { Write-Host '[step] postdbl: 参数格式应为 <class子串>|<x>,<y>'; }
      else {
        $classSub = $seg[0].Trim()
        $xy = $seg[1] -split ','
        $x = [int]$xy[0].Trim(); $y = [int]$xy[1].Trim()
        $main = Get-MainWindow
        $docName = ''
        if ($main -and $main.Title -match '-\s*([^-]+)$') { $docName = $Matches[1].Trim() }
        $target = $null
        if ($classSub -eq 'docview') {
          # 传 docview 时按「当前文档名」定位真正的文档视图窗口（框架窗的客户区原点不是画布原点）
          $dv = Get-DocViewWindow -DocName $docName
          if ($dv) {
            Write-Host ("[step] docview 命中：class={0} title='{1}' {2}x{3}" -f $dv.Class, $dv.Title, $dv.W, $dv.H)
            $target = $dv.Handle
          }
        } else {
          foreach ($c in [LS32]::Kids($main.Handle)) {
            if ([LS32]::C($c) -like "*$classSub*" -and [LS32]::IsWindowVisible($c)) {
              $rc = New-Object LS32+RECT
              [void][LS32]::GetWindowRect($c, [ref]$rc)
              if (($rc.Right - $rc.Left) -gt 100) { $target = $c; break }
            }
          }
        }
        if (-not $target) { Write-Host "[step] postdbl: 没找到 class 含 '$classSub' 的可见大子窗口" }
        else {
          $lp = [IntPtr](($y -shl 16) -bor ($x -band 0xFFFF))
          Write-Host ("[step] postdbl: class={0} 客户端({1},{2})" -f [LS32]::C($target), $x, $y)
          [void][LS32]::PostMessageW($target, 0x0200, [IntPtr]::Zero, $lp)
          [void][LS32]::PostMessageW($target, 0x0201, [IntPtr]1, $lp)
          [void][LS32]::PostMessageW($target, 0x0202, [IntPtr]::Zero, $lp)
          Start-Sleep -Milliseconds 120
          [void][LS32]::PostMessageW($target, 0x0203, [IntPtr]1, $lp)   # WM_LBUTTONDBLCLK
          Start-Sleep -Milliseconds 120
          [void][LS32]::PostMessageW($target, 0x0202, [IntPtr]::Zero, $lp)
          Start-Sleep -Milliseconds 1200
        }
      }
    }
    'postdrag' {
      # arg = <class子串或 docview>|<x1>,<y1>|<x2>,<y2>
      # 原版的对象是「按住拖出一个矩形」创建的（label_object_create_drag.html），单击不会落对象。
      $seg = $arg -split '\|'
      if ($seg.Count -lt 3) { Write-Host '[step] postdrag: 参数格式应为 <class|docview>|<x1>,<y1>|<x2>,<y2>' }
      else {
        $classSub = $seg[0].Trim()
        $p1 = $seg[1] -split ','; $p2 = $seg[2] -split ','
        $x1 = [int]$p1[0].Trim(); $y1 = [int]$p1[1].Trim()
        $x2 = [int]$p2[0].Trim(); $y2 = [int]$p2[1].Trim()
        $main = Get-MainWindow
        $docName = ''
        if ($main -and $main.Title -match '-\s*([^-]+)$') { $docName = $Matches[1].Trim() }
        $target = $null
        if ($classSub -eq 'docview') {
          $dv = Get-DocViewWindow -DocName $docName
          if ($dv) { $target = $dv.Handle; Write-Host ("[step] postdrag 目标：class={0} title='{1}' {2}x{3}" -f $dv.Class, $dv.Title, $dv.W, $dv.H) }
        } else {
          foreach ($c in [LS32]::Kids($main.Handle)) {
            if ([LS32]::C($c) -like "*$classSub*" -and [LS32]::IsWindowVisible($c)) { $target = $c; break }
          }
        }
        if (-not $target) { Write-Host '[step] postdrag: 没找到目标窗口' }
        else {
          $lp = { param($a, $b) [IntPtr](($b -shl 16) -bor ($a -band 0xFFFF)) }
          [void][LS32]::PostMessageW($target, 0x0200, [IntPtr]::Zero, (& $lp $x1 $y1))
          [void][LS32]::PostMessageW($target, 0x0201, [IntPtr]1, (& $lp $x1 $y1))     # 按下
          Start-Sleep -Milliseconds 150
          # 拖拽过程分几步，坐标单调推进，避免被当成抖动
          for ($i = 1; $i -le 5; $i++) {
            $mx = [int]($x1 + ($x2 - $x1) * $i / 5.0)
            $my = [int]($y1 + ($y2 - $y1) * $i / 5.0)
            [void][LS32]::PostMessageW($target, 0x0200, [IntPtr]1, (& $lp $mx $my))
            Start-Sleep -Milliseconds 60
          }
          [void][LS32]::PostMessageW($target, 0x0202, [IntPtr]::Zero, (& $lp $x2 $y2))  # 抬起
          Write-Host ("[step] postdrag: ({0},{1}) -> ({2},{3})" -f $x1, $y1, $x2, $y2)
          Start-Sleep -Milliseconds 1200
        }
      }
    }
    'diag' {
      $all = Get-LsWindows
      Write-Host "[diag] 进程数=$((Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Measure-Object).Count)  窗口数=$($all.Count)  类型=$($all.GetType().Name)"
      $afx = @($all | Where-Object { $_.Visible -and $_.Class -like 'Afx:*' })
      Write-Host "[diag] 可见且 class 以 Afx: 开头=$($afx.Count)"
      foreach ($w in $afx) { Write-Host ("[diag]   -> class='{0}' {1}x{2}" -f $w.Class, $w.Width, $w.Height) }
      $big = @($all | Where-Object { $_.Visible -and $_.Width -gt 300 })
      Write-Host "[diag] 可见且宽>300=$($big.Count)"
      foreach ($w in $big) { Write-Host ("[diag]   -> class='{0}' title='{1}' {2}x{3}" -f $w.Class, $w.Title, $w.Width, $w.Height) }
      $mw = Get-MainWindow
      if ($null -eq $mw) { Write-Host '[diag] Get-MainWindow = null' }
      else { Write-Host ("[diag] Get-MainWindow -> class='{0}' {1}x{2} handle=0x{3:X}" -f $mw.Class, $mw.Width, $mw.Height, $mw.Handle.ToInt64()) }
      $dv = Get-DocViewWindow -DocName '新标签模板1'
      if ($null -eq $dv) { Write-Host '[diag] Get-DocViewWindow = null' }
      else { Write-Host ("[diag] Get-DocViewWindow -> class='{0}' title='{1}' {2}x{3}" -f $dv.Class, $dv.Title, $dv.W, $dv.H) }
    }
    'menupick' {
      # arg = <Alt字母><菜单项字母>，例如 'td' = Alt+T 打开工具菜单，再按 d 选中「数据」
      $alt = $arg.Substring(0, 1)
      $rest = if ($arg.Length -gt 1) { $arg.Substring(1) } else { '' }
      $mw = Get-MainWindow
      Force-Foreground -Hwnd $mw.Handle
      $note = if ($rest) { ' -> ' + $rest } else { '' }
      Write-Host "[step] menupick: Alt+$alt$note"
      [System.Windows.Forms.SendKeys]::SendWait("%$alt")
      Start-Sleep -Milliseconds 900
      if ($rest) {
        [System.Windows.Forms.SendKeys]::SendWait($rest)
        Start-Sleep -Milliseconds 1500
      }
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
      $d = Get-TopDialog
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
    'dump' {
      # arg = <标题子串>|<输出文件后缀>  读当前对话框里所有输入控件的**值**（Edit 走跨进程 WM_GETTEXT），
      # 写入 parity\reference\labelshop\probe-<后缀>.txt —— 对象属性页逐页取证用。
      $seg = $arg -split '\|', 2
      $titleLike = if ($seg[0]) { $seg[0].Trim() } else { '*' }
      $name = if ($seg.Count -gt 1 -and $seg[1].Trim()) { $seg[1].Trim() } else { 'dlg-values' }
      $out = Join-Path $OutDir ("probe-$name.txt")
      $reader = Join-Path $PSScriptRoot 'Read-LabelShopDialogValues.ps1'
      Write-Host "[step] dump: '$titleLike' -> $out"
      & powershell.exe -NoProfile -File $reader -TitleLike $titleLike -OutFile $out -IncludeDisabled | Out-Host
      Start-Sleep -Milliseconds 300
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
