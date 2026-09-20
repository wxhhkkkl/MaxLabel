# 真机取证：读取某个对话框里所有输入控件的**值**（跨进程 WM_GETTEXT / CB_GETCURSEL）。
#
# 为什么需要它：`Read-LabelShopDialogTree.ps1` 用 GetWindowTextW 读文字，
# 跨进程时对 Edit 取不到内容（真机对象属性页的水平/垂直/宽高全是空的）；
# WM_GETTEXT 是系统会**跨进程封送**的消息，能真正取回输入框里的值。
# ComboBox 则读 CB_GETCURSEL + CB_GETLBTEXT。
#
#   powershell -File tools\parity\Read-LabelShopDialogValues.ps1 -TitleLike '*文字属性*'
#   powershell -File tools\parity\Read-LabelShopDialogValues.ps1 -TitleLike '*文字属性*' -OutFile x.txt
[CmdletBinding()]
param(
  [string]$TitleLike = '*',
  [string]$OutFile = '',
  [switch]$IncludeDisabled
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class DV {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageW(IntPtr h, uint msg, IntPtr wp, StringBuilder lp);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageW(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }

  public static string Text(IntPtr h) { var sb = new StringBuilder(1024); GetWindowTextW(h, sb, sb.Capacity); return sb.ToString(); }
  public static string Class(IntPtr h) { var sb = new StringBuilder(256); GetClassNameW(h, sb, sb.Capacity); return sb.ToString(); }
  /** WM_GETTEXT 由系统跨进程封送，能取到别的进程里 Edit 的真实内容 */
  public static string Value(IntPtr h) { var sb = new StringBuilder(2048); SendMessageW(h, 0x000D, (IntPtr)sb.Capacity, sb); return sb.ToString(); }
  // CB_GETCURSEL 没有选中项时返回 -1：先转 long 再窄化，避免 checked 溢出（同 Probe-LabelShopCombos 的坑）
  public static int ComboSel(IntPtr h) { return (int)(long)SendMessageW(h, 0x0147, IntPtr.Zero, IntPtr.Zero); }        // CB_GETCURSEL
  public static int ComboCount(IntPtr h) { return (int)(long)SendMessageW(h, 0x0146, IntPtr.Zero, IntPtr.Zero); }      // CB_GETCOUNT
  public static string ComboItem(IntPtr h, int i) {
    var sb = new StringBuilder(512);
    SendMessageW(h, 0x0148, (IntPtr)i, sb);                                                                    // CB_GETLBTEXT
    return sb.ToString();
  }
  public static IntPtr Checked(IntPtr h) { return SendMessageW(h, 0x00F0, IntPtr.Zero, IntPtr.Zero); }         // BM_GETCHECK
}
'@
[void][DV]::SetProcessDPIAware()

function Get-Targets {
  param([string]$Like)
  $found = New-Object System.Collections.ArrayList
  $cb = [DV+EnumWindowsProc]{
    param($h, $l)
    if (-not [DV]::IsWindowVisible($h)) { return $true }
    $pid2 = 0; [void][DV]::GetWindowThreadProcessId($h, [ref]$pid2)
    $proc = Get-Process -Id $pid2 -ErrorAction SilentlyContinue
    if (-not $proc -or $proc.ProcessName -ne 'LabelShop') { return $true }
    $t = [DV]::Text($h)
    if ($t -like $Like) {
      $r = New-Object DV+RECT; [void][DV]::GetWindowRect($h, [ref]$r)
      [void]$found.Add([pscustomobject]@{ Handle = $h; Title = $t; Class = [DV]::Class($h); Left = $r.Left; Top = $r.Top; Width = ($r.Right - $r.Left); Height = ($r.Bottom - $r.Top) })
    }
    return $true
  }
  [void][DV]::EnumWindows($cb, [IntPtr]::Zero)
  return $found
}

$targets = Get-Targets -Like $TitleLike
if ($targets.Count -eq 0) { Write-Host "[values] 没有匹配 '$TitleLike' 的可见窗口"; exit 1 }

$lines = New-Object System.Collections.ArrayList
foreach ($tgt in $targets) {
  [void]$lines.Add(("=== WINDOW '{0}' class={1} ===" -f $tgt.Title, $tgt.Class))
  $kids = New-Object System.Collections.ArrayList
  $statics = New-Object System.Collections.ArrayList
  $cb2 = [DV+EnumWindowsProc]{
    param($h, $l)
    if (-not [DV]::IsWindowVisible($h)) { return $true }
    if (-not $IncludeDisabled -and -not [DV]::IsWindowEnabled($h)) { return $true }
    $cls = [DV]::Class($h)
    $r = New-Object DV+RECT; [void][DV]::GetWindowRect($h, [ref]$r)
    $text = [DV]::Text($h)
    $value = ''
    if ($cls -eq 'Edit') { $value = [DV]::Value($h) }
    elseif ($cls -eq 'ComboBox') {
      $sel = [DV]::ComboSel($h)
      $cnt = [DV]::ComboCount($h)
      $value = if ($sel -ge 0 -and $sel -lt $cnt) { [DV]::ComboItem($h, $sel) } else { "<未选中/自定义>" }
      $value = "$value  (选中 $sel / 共 $cnt 项)"
    } elseif ($cls -eq 'Button' -and $text -eq '') {
      $value = 'check=' + ([DV]::Checked($h)).ToString()
    }
    # Static 单独收一份：用来给输入框配「标签」（Static 本身不是要读的值）
    if ($cls -eq 'Static' -and $text) {
      [void]$statics.Add([pscustomobject]@{ Text = $text; Left = $r.Left; Top = $r.Top; Right = $r.Right; Bottom = $r.Bottom })
    }
    if ($cls -in @('Edit', 'ComboBox') -or ($cls -eq 'Button' -and $text -eq '')) {
      [void]$kids.Add([pscustomobject]@{ Class = $cls; Text = $text; Value = $value; Left = $r.Left; Top = $r.Top; Right = $r.Right; Bottom = $r.Bottom })
    }
    return $true
  }
  [void][DV]::EnumChildWindows($tgt.Handle, $cb2, [IntPtr]::Zero)

  foreach ($k in $kids) {
    $label = ''
    foreach ($s in $statics) {
      # 标签在输入框左侧（同一行、结束位置在输入框左侧 40px 内）或正上方
      $sameRow = [Math]::Abs($s.Top - $k.Top) -lt 24 -and $s.Right -le ($k.Left + 8) -and ($k.Left - $s.Right) -lt 40
      $above = [Math]::Abs($s.Left - $k.Left) -lt 40 -and $s.Bottom -le ($k.Top + 6) -and ($k.Top - $s.Bottom) -lt 40
      if ($sameRow -or $above) { $label = $s.Text; break }
    }
    [void]$lines.Add(("  {0,-10} label='{1}' value='{2}' xy=({3},{4})" -f $k.Class, $label, $k.Value, $k.Left, $k.Top))
  }
  [void]$lines.Add('')
}
$lines | ForEach-Object { Write-Host $_ }
if ($OutFile) { Set-Content -LiteralPath $OutFile -Value ($lines -join "`r`n") -Encoding UTF8; Write-Host "[values] -> $OutFile（$($lines.Count) 行）" }
