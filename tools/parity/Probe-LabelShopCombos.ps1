# Forensics helper: dump the item lists of the ComboBox controls inside a LabelShop dialog,
# and optionally change the selection of one combo (by y-order index) to see linkage.
#
#   -TitleLike '*选择标签格式*'                 dump combos
#   -TitleLike '*选择标签格式*' -SetCombo 0 -SetIndex 1   change 1st combo (by y) to item 1 and re-dump
#
# Read-only with respect to product code: only window messages to the running app.
[CmdletBinding()]
param(
  [string]$TitleLike = '*',
  [int]$SetCombo = -1,
  [int]$SetIndex = -1,
  [switch]$ListOnly,
  [switch]$IncludeHidden
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class CB {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageW(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageW(IntPtr h, uint msg, IntPtr wp, StringBuilder lp);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
  public static List<IntPtr> Tops(){ var l=new List<IntPtr>(); EnumWindows((h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
  public static List<IntPtr> Kids(IntPtr p){ var l=new List<IntPtr>(); EnumChildWindows(p,(h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
}
'@
[void][CB]::SetProcessDPIAware()
$pids = @(Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
if ($pids.Count -eq 0) { Write-Host '[cb] LabelShop not running'; exit 1 }

$dlg = $null
foreach ($h in [CB]::Tops()) {
  $wpid = 0
  [void][CB]::GetWindowThreadProcessId($h, [ref]$wpid)
  if (-not ($pids -contains [int]$wpid)) { continue }
  if (-not [CB]::IsWindowVisible($h)) { continue }
  if ([CB]::C($h) -ne '#32770') { continue }
  if ([CB]::T($h) -notlike $TitleLike) { continue }
  $dlg = $h; break
}
if (-not $dlg) { Write-Host "[cb] 没有匹配 '$TitleLike' 的可见对话框"; exit 1 }
$r = New-Object CB+RECT
[void][CB]::GetWindowRect($dlg, [ref]$r)
Write-Host ("=== DIALOG '{0}' {1}x{2} at ({3},{4}) ===" -f [CB]::T($dlg), ($r.Right-$r.Left), ($r.Bottom-$r.Top), $r.Left, $r.Top)

function Get-Combos {
  $list = New-Object System.Collections.ArrayList
  foreach ($c in [CB]::Kids($dlg)) {
    $cls = [CB]::C($c)
    if ($cls -notmatch 'ComboBox') { continue }
    # 属性页是多页 #32770：**隐藏页上的下拉也在子窗口列表里**，按 Y 排序后会把索引错位
    # （round-58 实测：条码属性取 combo[0] 拿到的是别的页的控件，-SetCombo 因此改不动码制）。
    # 默认只看当前可见页上的控件。
    if (-not $IncludeHidden -and -not [CB]::IsWindowVisible($c)) { continue }
    $fr = New-Object CB+RECT
    [void][CB]::GetWindowRect($c, [ref]$fr)
    $countRaw = [int64][CB]::SendMessageW($c, 0x0146, [IntPtr]::Zero, [IntPtr]::Zero)  # CB_GETCOUNT
    $count = [int]$countRaw
    $selRaw = [int64][CB]::SendMessageW($c, 0x0147, [IntPtr]::Zero, [IntPtr]::Zero)    # CB_GETCURSEL（-1 = 没有选中项，会回成 4294967295）
    $sel = if ($selRaw -eq 4294967295 -or $selRaw -lt 0) { -1 } else { [int]$selRaw }
    $items = New-Object System.Collections.ArrayList
    for ($i = 0; $i -lt $count; $i++) {
      $sb = New-Object System.Text.StringBuilder 512
      [void][CB]::SendMessageW($c, 0x0148, [IntPtr]$i, $sb)                        # CB_GETLBTEXT
      [void]$items.Add($sb.ToString())
    }
    [void]$list.Add([pscustomobject]@{
      Handle = $c; Id = [CB]::GetDlgCtrlID($c); Y = $fr.Top; X = $fr.Left
      Count = $count; Sel = $sel; Items = $items
    })
  }
  return @($list | Sort-Object Y)
}

function Get-Labels {
  $list = New-Object System.Collections.ArrayList
  foreach ($c in [CB]::Kids($dlg)) {
    if ([CB]::C($c) -notmatch 'Static') { continue }
    $t = [CB]::T($c)
    if (-not $t) { continue }
    $fr = New-Object CB+RECT
    [void][CB]::GetWindowRect($c, [ref]$fr)
    [void]$list.Add([pscustomobject]@{ X = $fr.Left; Y = $fr.Top; Text = $t })
  }
  return @($list)
}
$statics = Get-Labels
function Get-LabelFor($combo) {
  $cand = $statics | Where-Object { $_.X -lt $combo.X -and $_.Y -le $combo.Y -and ($combo.Y - $_.Y) -le 50 } | Sort-Object Y -Descending
  if ($cand.Count -gt 0) { return $cand[0].Text }
  return ''
}

$combos = Get-Combos
$i = 0
foreach ($c in $combos) {
  Write-Host ("--- combo[{0}] '{1}' id={2} xy=({3},{4}) count={5} sel={6} cur='{7}'" -f $i, (Get-LabelFor $c), $c.Id, $c.X, $c.Y, $c.Count, $c.Sel, ($(if ($c.Sel -ge 0 -and $c.Sel -lt $c.Count) { $c.Items[$c.Sel] } else { '' })))
  foreach ($it in $c.Items) { Write-Host ("      | " + $it) }
  $i++
}

if ($SetCombo -ge 0 -and $SetIndex -ge 0 -and -not $ListOnly) {
  if ($SetCombo -ge $combos.Count) { Write-Host "[cb] combo 序号越界（共 $($combos.Count) 个）"; exit 1 }
  $c = $combos[$SetCombo]
  Write-Host ("[cb] 设置 combo[{0}] (id={1}) -> index {2}" -f $SetCombo, $c.Id, $SetIndex)
  [void][CB]::SendMessageW($c.Handle, 0x014E, [IntPtr]$SetIndex, [IntPtr]::Zero)   # CB_SETCURSEL
  $parent = [CB]::GetParent($c.Handle)
  $wp = [IntPtr](($SetIndex -band 0) -bor (1 -shl 16))                             # CBN_SELCHANGE = 1
  [void][CB]::SendMessageW($parent, 0x0111, [IntPtr]((1 -shl 16) -bor $c.Id), $c.Handle)  # WM_COMMAND
  Start-Sleep -Milliseconds 800
  # 属性页里的下拉对 CB_SETCURSEL + WM_COMMAND 不买账（round-58 实测：条码属性码制切不动），
  # 再补一手「给下拉自己发方向键」——从当前项一路按到目标项。
  $before = (Get-Combos)[$SetCombo]
  if ($before -and $before.Sel -ne $SetIndex) {
    $delta = if ($before.Sel -lt 0) { $SetIndex } else { $SetIndex - $before.Sel }
    $vk = if ($delta -ge 0) { 0x28 } else { 0x26 }   # VK_DOWN / VK_UP
    Write-Host ("[cb] CB_SETCURSEL 未生效（sel={0}），改用方向键按 {1} 次" -f $before.Sel, [Math]::Abs($delta))
    for ($k = 0; $k -lt [Math]::Abs($delta); $k++) {
      [void][CB]::SendMessageW($c.Handle, 0x0100, [IntPtr]$vk, [IntPtr]::Zero)
      [void][CB]::SendMessageW($c.Handle, 0x0101, [IntPtr]$vk, [IntPtr]::Zero)
      Start-Sleep -Milliseconds 80
    }
    Start-Sleep -Milliseconds 600
  }
  Write-Host '--- 变更后 ---'
  $combos2 = Get-Combos
  $j = 0
  foreach ($c2 in $combos2) {
    Write-Host ("--- combo[{0}] id={1} count={2} sel={3} cur='{4}'" -f $j, $c2.Id, $c2.Count, $c2.Sel, ($(if ($c2.Sel -ge 0 -and $c2.Sel -lt $c2.Count) { $c2.Items[$c2.Sel] } else { '' })))
    foreach ($it in $c2.Items) { Write-Host ("      | " + $it) }
    $j++
  }
}
