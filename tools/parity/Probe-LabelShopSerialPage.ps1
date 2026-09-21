# 真机取证（round-60）：把对象属性「数据源」页的下拉切到「序列号」并让页面真正重排，
# 然后 dump 该页上所有 Static/Button/ComboBox/Edit（含隐藏），用来判定序列号子面板的字段集
# ——目的：确认需求清单第 201 条「序列号·边界值」在原版是否存在（EXE 字符串资源里没有「边界值」，
# 但字符串资源里有「归位」「重置初始值:」「立即重置」，需要页面实证）。
#
# 用法：
#   powershell -File tools\parity\Probe-LabelShopSerialPage.ps1 -TitleLike '*条码属性*' -SourceIndex 1
#   SourceIndex：数据源下拉里「序列号」的序号（常量0/序列号1/数据库2/日期3/时间4/键盘输入5/脚本6）
#
# 机制：CB_SETCURSEL 只改选中项、属性页不重排（round-58 实测）。这里改成给父窗口发
# WM_COMMAND + CBN_SELENDOK(=9) 与 CBN_SELCHANGE(=1)，并给下拉本身补一手回车键，
# 尽量触发 MFC 的 OnCbnSelchange/OnCbnSelendok 走完重排逻辑。
[CmdletBinding()]
param(
  [string]$TitleLike = '*条码属性*',
  [int]$SourceIndex = 1,
  [string]$OutFile = ''
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class SP {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr l);
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageW(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
  public static List<IntPtr> Tops(){ var l=new List<IntPtr>(); EnumWindows((h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
  public static List<IntPtr> Kids(IntPtr p){ var l=new List<IntPtr>(); EnumChildWindows(p,(h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
}
'@
[void][SP]::SetProcessDPIAware()
$pids = @(Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id)
if ($pids.Count -eq 0) { Write-Host '[sp] LabelShop 未运行'; exit 1 }
$dlg = $null
foreach ($h in [SP]::Tops()) {
  $wpid = 0
  [void][SP]::GetWindowThreadProcessId($h, [ref]$wpid)
  if (-not ($pids -contains [int]$wpid)) { continue }
  if (-not [SP]::IsWindowVisible($h)) { continue }
  if ([SP]::C($h) -ne '#32770') { continue }
  if ([SP]::T($h) -notlike $TitleLike) { continue }
  $dlg = $h; break
}
if (-not $dlg) { Write-Host "[sp] 没有匹配 '$TitleLike' 的可见对话框"; exit 1 }
Write-Host ("=== DIALOG '{0}' ===" -f [SP]::T($dlg))

# 找「数据源」下拉：当前可见页上 item 数与数据源类型一致（7 项）的那个 ComboBox
$sourceCombo = [IntPtr]::Zero
foreach ($c in [SP]::Kids($dlg)) {
  if ([SP]::C($c) -notmatch 'ComboBox') { continue }
  $n = [int]([int64][SP]::SendMessageW($c, 0x0146, [IntPtr]::Zero, [IntPtr]::Zero))
  if ($n -ge 7 -and [SP]::IsWindowVisible($c)) { $sourceCombo = $c; break }
}
if ($sourceCombo -eq [IntPtr]::Zero) { Write-Host '[sp] 没找到可见的「数据源」下拉（7 项）'; exit 1 }
Write-Host ("[sp] 数据源下拉 hwnd={0} id={1}" -f $sourceCombo, [SP]::GetDlgCtrlID($sourceCombo))
$parent = [SP]::GetParent($sourceCombo)
$id = [SP]::GetDlgCtrlID($sourceCombo)
function Set-Source([int]$index) {
  [void][SP]::SendMessageW($sourceCombo, 0x014E, [IntPtr]$index, [IntPtr]::Zero)         # CB_SETCURSEL
  foreach ($code in @(1, 9)) {                                                          # CBN_SELCHANGE / CBN_SELENDOK
    [void][SP]::SendMessageW($parent, 0x0111, [IntPtr](($code -shl 16) -bor $id), $sourceCombo)
    Start-Sleep -Milliseconds 350
  }
  [void][SP]::SendMessageW($sourceCombo, 0x0100, [IntPtr]0x0D, [IntPtr]::Zero)          # VK_RETURN down
  [void][SP]::SendMessageW($sourceCombo, 0x0101, [IntPtr]0x0D, [IntPtr]::Zero)          # VK_RETURN up
  Start-Sleep -Milliseconds 800
}
# 关键：MFC 的 OnCbnSelendok 只在「选项真的变了」时才重排页面。上一次取证可能已经把下拉
# 留在目标项上（CB_SETCURSEL 改了 sel 但页面没重排），此时再设同一个值等于没变化，页面
# 依旧不动。所以先切回「常量」把页面切成常量态，再切到目标项，制造一次真实变更。
Set-Source 0
Set-Source $SourceIndex
$sel = [int64][SP]::SendMessageW($sourceCombo, 0x0147, [IntPtr]::Zero, [IntPtr]::Zero)
Write-Host ("[sp] 切换后 sel={0}（目标 {1}）" -f $sel, $SourceIndex)

# dump：按「数据源」页（标题为 数据源 的 #32770 子页）里的 Static/Button 文本
$lines = New-Object System.Collections.ArrayList
foreach ($child in [SP]::Kids($dlg)) {
  if ([SP]::C($child) -ne '#32770') { continue }
  $title = [SP]::T($child)
  if ($title -notlike '*数据源*') { continue }
  [void]$lines.Add("=== PAGE '$title' ===")
  foreach ($c in [SP]::Kids($child)) {
    $cls = [SP]::C($c)
    if ($cls -notmatch 'Static|Button|ComboBox|Edit|updown') { continue }
    $vis = if ([SP]::IsWindowVisible($c)) { 'V' } else { ' ' }
    $txt = [SP]::T($c)
    $r = New-Object SP+RECT
    [void][SP]::GetWindowRect($c, [ref]$r)
    [void]$lines.Add(("[{0}] class={1,-18} id={2,-5} text='{3}' xy=({4},{5}) wh=({6}x{7})" -f $vis, $cls, [SP]::GetDlgCtrlID($c), $txt, $r.Left, $r.Top, ($r.Right-$r.Left), ($r.Bottom-$r.Top)))
  }
}
$lines | ForEach-Object { Write-Host $_ }
if ($OutFile) { Set-Content -LiteralPath $OutFile -Value ($lines -join "`r`n") -Encoding UTF8; Write-Host "[sp] -> $OutFile" }
