<#
  往 USB 标签打印机发**原始指令**（验收方 round-262）
  用途：Gprinter GP-1324D 走 USB001，用通用驱动建的队列在直发（RAW）模式下会把字节**原样**交给打印机 ✓，
        所以可以发 TSPL 指令画一个**条码**出来 ✓（用户要的"打印一个条形码"）。
  做法：不经过驱动解释 ✗，直接用后台打印程序的 RAW 接口（StartDocPrinter datatype='RAW' + WritePrinter）✓。
  用法：
    powershell -File tools/parity/Send-RawPrint.ps1 -Printer 'Gprinter GP-1324D (USB)' -CommandFile <含 TSPL 的文本文件>
    powershell -File tools/parity/Send-RawPrint.ps1 -Printer '...' -CommandText "CLS`r`nPRINT 1,1`r`n"
#>
param(
  [Parameter(Mandatory = $true)][string]$Printer,
  [string]$CommandFile = '',
  [string]$CommandText = ''
)
$ErrorActionPreference = 'Stop'

if ($CommandFile) {
  if (-not (Test-Path -LiteralPath $CommandFile)) { throw "找不到指令文件：$CommandFile" }
  $CommandText = [IO.File]::ReadAllText($CommandFile, [Text.UTF8Encoding]::new($false))
}
if (-not $CommandText) { throw '没有指令内容（用 -CommandFile 或 -CommandText）' }

# TSPL 要求 CRLF 行尾 ✓；补一个结尾换行 ✓
$CommandText = ($CommandText -replace "`r`n", "`n") -replace "`n", "`r`n"
if (-not $CommandText.EndsWith("`r`n")) { $CommandText += "`r`n" }
$bytes = [Text.Encoding]::ASCII.GetBytes($CommandText)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class RawPrint {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct DOCINFOA { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
                           [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
                           [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, ref DOCINFOA di);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
}
'@

$h = [IntPtr]::Zero
if (-not [RawPrint]::OpenPrinter($Printer, [ref]$h, [IntPtr]::Zero)) { throw "打不开打印机 '$Printer'（错误码 $([Runtime.InteropServices.Marshal]::GetLastWin32Error())）" }
try {
  $di = New-Object RawPrint+DOCINFOA
  $di.pDocName = 'MaxLabel RAW barcode'
  $di.pDataType = 'RAW'
  if (-not [RawPrint]::StartDocPrinter($h, 1, [ref]$di)) { throw "StartDocPrinter 失败（$([Runtime.InteropServices.Marshal]::GetLastWin32Error())）" }
  try {
    if (-not [RawPrint]::StartPagePrinter($h)) { throw 'StartPagePrinter 失败' }
    $ptr = [Runtime.InteropServices.Marshal]::AllocCoTaskMem($bytes.Length)
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
    $written = 0
    $ok = [RawPrint]::WritePrinter($h, $ptr, $bytes.Length, [ref]$written)
    [Runtime.InteropServices.Marshal]::FreeCoTaskMem($ptr)
    if (-not $ok) { throw "WritePrinter 失败（$([Runtime.InteropServices.Marshal]::GetLastWin32Error())）" }
    "已发送 $written 字节到 '$Printer' ✓"
    [void][RawPrint]::EndPagePrinter($h)
  } finally { [void][RawPrint]::EndDocPrinter($h) }
} finally { [void][RawPrint]::ClosePrinter($h) }
