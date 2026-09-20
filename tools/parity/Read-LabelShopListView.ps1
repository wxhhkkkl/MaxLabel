# 真机取证：读取 LabelShop 对话框里 SysListView32 的全部行（含各列文字）。
#
# 原理：ListView 的 LVM_GETITEMTEXT 需要一个指向**目标进程地址空间**的 LVITEMW 结构，
# 所以用 VirtualAllocEx 在目标进程里开缓冲、WriteProcessMemory 写 32 位布局的 LVITEMW、
# 发消息后再 ReadProcessMemory 把文字读回来（LabelShop 是 32 位，结构按 32 位布局，指针字段是 4 字节）。
#
#   powershell -File tools\parity\Read-LabelShopListView.ps1 -TitleLike '*安装 LabelShop 打印机*'
#   powershell -File tools\parity\Read-LabelShopListView.ps1 -TitleLike '*安装 LabelShop 打印机*' -OutFile xxx.txt
[CmdletBinding()]
param(
  [string]$TitleLike = '*',
  [string]$OutFile = '',
  [int]$MaxRows = 400,
  [int]$FallbackColumns = 3,
  [int]$SelectRow = -1
)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class LV {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumWindowsProc cb, IntPtr l);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageW(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
  [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] public static extern IntPtr VirtualAllocEx(IntPtr proc, IntPtr addr, IntPtr size, uint type, uint protect);
  [DllImport("kernel32.dll")] public static extern bool VirtualFreeEx(IntPtr proc, IntPtr addr, IntPtr size, uint type);
  [DllImport("kernel32.dll")] public static extern bool WriteProcessMemory(IntPtr proc, IntPtr addr, byte[] buf, IntPtr size, out IntPtr written);
  [DllImport("kernel32.dll")] public static extern bool ReadProcessMemory(IntPtr proc, IntPtr addr, byte[] buf, IntPtr size, out IntPtr read);
  public static string T(IntPtr h){ var sb=new StringBuilder(600); GetWindowTextW(h,sb,600); return sb.ToString(); }
  public static string C(IntPtr h){ var sb=new StringBuilder(300); GetClassNameW(h,sb,300); return sb.ToString(); }
  public static List<IntPtr> Tops(){ var l=new List<IntPtr>(); EnumWindows((h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
  public static List<IntPtr> Kids(IntPtr p){ var l=new List<IntPtr>(); EnumChildWindows(p,(h,x)=>{ l.Add(h); return true; }, IntPtr.Zero); return l; }
  /// 32 位进程里的 LVITEMW：全部字段 4 字节，合计 60 字节。
  public static byte[] LvItem(int iItem, int iSubItem, int pszText, int cchTextMax) {
    var b = new byte[60];
    BitConverter.GetBytes(1).CopyTo(b, 0);          // mask = LVIF_TEXT
    BitConverter.GetBytes(iItem).CopyTo(b, 4);
    BitConverter.GetBytes(iSubItem).CopyTo(b, 8);
    BitConverter.GetBytes(pszText).CopyTo(b, 20);
    BitConverter.GetBytes(cchTextMax).CopyTo(b, 24);
    return b;
  }
}
'@
[void][LV]::SetProcessDPIAware()

$proc = Get-Process -Name LabelShop -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $proc) { Write-Host '[lv] LabelShop 未运行'; exit 1 }

$dlg = $null
foreach ($h in [LV]::Tops()) {
  $wpid = 0
  [void][LV]::GetWindowThreadProcessId($h, [ref]$wpid)
  if ([int]$wpid -ne $proc.Id) { continue }
  if (-not [LV]::IsWindowVisible($h)) { continue }
  if ([LV]::T($h) -notlike $TitleLike) { continue }
  $dlg = $h; break
}
if (-not $dlg) { Write-Host "[lv] 没有匹配 '$TitleLike' 的可见对话框"; exit 1 }

$lists = @()
foreach ($c in [LV]::Kids($dlg)) { if ([LV]::C($c) -like 'SysListView32*') { $lists += $c } }
if ($lists.Count -eq 0) { Write-Host "[lv] '$TitleLike' 里没有 SysListView32"; exit 1 }

$PROCESS_ACCESS = 0x0008 -bor 0x0010 -bor 0x0020 -bor 0x0400   # VM_OPERATION | VM_READ | VM_WRITE | QUERY_INFORMATION
$MEM_COMMIT_RESERVE = 0x3000
$PAGE_READWRITE = 0x04
$MEM_RELEASE = 0x8000
$hProc = [LV]::OpenProcess($PROCESS_ACCESS, $false, [uint32]$proc.Id)
if ($hProc -eq [IntPtr]::Zero) { Write-Host '[lv] OpenProcess 失败（权限不足？）'; exit 1 }

$lines = New-Object System.Collections.ArrayList
try {
  $bufSize = 4096
  $remote = [LV]::VirtualAllocEx($hProc, [IntPtr]::Zero, [IntPtr]$bufSize, $MEM_COMMIT_RESERVE, $PAGE_READWRITE)
  if ($remote -eq [IntPtr]::Zero) { throw 'VirtualAllocEx 失败' }
  $textRemote = [IntPtr]::Add($remote, 512)

  foreach ($lv in $lists) {
    $count = [int][LV]::SendMessageW($lv, 0x1004, [IntPtr]::Zero, [IntPtr]::Zero)   # LVM_GETITEMCOUNT
    $cols = [int][LV]::SendMessageW($lv, 0x101D, [IntPtr]::Zero, [IntPtr]::Zero)    # LVM_GETHEADER -> 需要转成列数
    # 列头文字：LVM_GETCOLUMNW (0x105F)
    $header = [LV]::SendMessageW($lv, 0x101D, [IntPtr]::Zero, [IntPtr]::Zero)
    $colCount = 0
    if ($header -ne [IntPtr]::Zero) {
      $colCount = [int][LV]::SendMessageW($header, 0x1200, [IntPtr]::Zero, [IntPtr]::Zero)  # HDM_GETITEMCOUNT
    }
    if ($colCount -le 0) { $colCount = $FallbackColumns }
    $colNames = @()
    for ($j = 0; $j -lt $colCount; $j++) {
      $written = [IntPtr]::Zero
      $item = [LV]::LvItem(0, $j, [int]$textRemote.ToInt64(), 512)
      [void][LV]::WriteProcessMemory($hProc, $remote, $item, [IntPtr]$item.Length, [ref]$written)
      # LVCOLUMNW: mask, fmt, cx, pszText, cchTextMax, iSubItem, iImage, iOrder, cxMin, cxDefault, cxIdeal
      $col = New-Object byte[] 44
      [BitConverter]::GetBytes(1).CopyTo($col, 0)                       # mask = LVCF_TEXT
      [BitConverter]::GetBytes([int]$textRemote.ToInt64()).CopyTo($col, 12)
      [BitConverter]::GetBytes(512).CopyTo($col, 16)
      [void][LV]::WriteProcessMemory($hProc, [IntPtr]::Add($remote, 1024), $col, [IntPtr]$col.Length, [ref]$written)
      [void][LV]::SendMessageW($lv, 0x105F, [IntPtr]$j, [IntPtr]::Add($remote, 1024))  # LVM_GETCOLUMNW
      $rb = New-Object byte[] 1024
      $read = [IntPtr]::Zero
      [void][LV]::ReadProcessMemory($hProc, $textRemote, $rb, [IntPtr]$rb.Length, [ref]$read)
      $colNames += ([Text.Encoding]::Unicode.GetString($rb) -split "`0")[0]
    }
    [void]$lines.Add(("=== LISTVIEW handle=0x{0:X}  rows={1}  cols={2} :: {3} ===" -f $lv.ToInt64(), $count, $colNames.Count, ($colNames -join ' | ')))
    $rows = [Math]::Min($count, $MaxRows)
    for ($i = 0; $i -lt $rows; $i++) {
      $cells = @()
      for ($j = 0; $j -lt [Math]::Max($colNames.Count, 1); $j++) {
        $written = [IntPtr]::Zero
        $item = [LV]::LvItem($i, $j, [int]$textRemote.ToInt64(), 512)
        [void][LV]::WriteProcessMemory($hProc, $remote, $item, [IntPtr]$item.Length, [ref]$written)
        [void][LV]::SendMessageW($lv, 0x1073, [IntPtr]$i, [IntPtr]$remote)   # LVM_GETITEMTEXTW
        $rb = New-Object byte[] 1024
        $read = [IntPtr]::Zero
        [void][LV]::ReadProcessMemory($hProc, $textRemote, $rb, [IntPtr]$rb.Length, [ref]$read)
        $cells += ([Text.Encoding]::Unicode.GetString($rb) -split "`0")[0]
      }
      [void]$lines.Add(('{0,3} | {1}' -f $i, ($cells -join ' | ')))
    }
    if ($SelectRow -ge 0) {
      # 选中某一行：LVITEM{ mask=LVIF_STATE, state=LVIS_SELECTED|LVIS_FOCUSED, stateMask=同 }
      $written = [IntPtr]::Zero
      $sel = New-Object byte[] 60
      [BitConverter]::GetBytes(8).CopyTo($sel, 0)          # mask = LVIF_STATE
      [BitConverter]::GetBytes($SelectRow).CopyTo($sel, 4) # iItem
      [BitConverter]::GetBytes(3).CopyTo($sel, 12)         # state = SELECTED|FOCUSED
      [BitConverter]::GetBytes(3).CopyTo($sel, 16)         # stateMask
      [void][LV]::WriteProcessMemory($hProc, $remote, $sel, [IntPtr]$sel.Length, [ref]$written)
      [void][LV]::SendMessageW($lv, 0x102B, [IntPtr]::Zero, [IntPtr]$remote)   # LVM_SETITEMSTATE
      [void][LV]::SendMessageW($lv, 0x1013, [IntPtr]$SelectRow, [IntPtr]::Zero) # LVM_ENSUREVISIBLE
      Write-Host "[lv] 已选中第 $SelectRow 行"
    }
  }
  [void][LV]::VirtualFreeEx($hProc, $remote, [IntPtr]::Zero, $MEM_RELEASE)
} finally {
  [void][LV]::CloseHandle($hProc)
}

$lines | ForEach-Object { Write-Host $_ }
if ($OutFile) {
  Set-Content -LiteralPath $OutFile -Value ($lines -join "`r`n") -Encoding UTF8
  Write-Host "[lv] -> $OutFile（$($lines.Count) 行）"
}
