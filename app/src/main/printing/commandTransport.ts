import { createConnection } from 'node:net'
import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { formatUsbPrinterPort, SERIAL_DEFAULT_BAUD_RATE, usbPortName, type PortConfig } from '../../shared/domain/printer'
import type { PrintTransportResult } from '../../shared/ipcContract'

const execFileAsync = promisify(execFile)

async function writeSerialWindows(portName: string, baud: number, data: Buffer, signal?: AbortSignal, framing?: Pick<PortConfig, 'dataBits' | 'parity' | 'stopBits' | 'flowControl'>): Promise<PrintTransportResult> {
  const temporaryFile = join(tmpdir(), `maxlabel-serial-${randomUUID()}.bin`)
  await writeFile(temporaryFile, data)
  const ps = (value: string) => value.replace(/'/g, "''")
  // 串口帧格式与流控制按真机「端口」页的 5 项参数输出，缺省 None/8/One/None（与真机默认值一致）。
  const parity = { none: 'None', odd: 'Odd', even: 'Even', mark: 'Mark', space: 'Space' }[framing?.parity ?? 'none'] ?? 'None'
  const stopBits = { one: 'One', onePointFive: 'OnePointFive', two: 'Two' }[framing?.stopBits ?? 'one'] ?? 'One'
  const handshake = { none: 'None', rtsCts: 'RequestToSend', xonXoff: 'XOnXOff' }[framing?.flowControl ?? 'none'] ?? 'None'
  const dataBits = framing?.dataBits ?? 8
  const script = [
    "$ErrorActionPreference='Stop'", 'try {',
    `  $p = New-Object System.IO.Ports.SerialPort('${ps(portName)}', ${Math.max(1, Math.trunc(baud))}, [System.IO.Ports.Parity]::${parity}, ${dataBits}, [System.IO.Ports.StopBits]::${stopBits})`,
    `  $p.Handshake = [System.IO.Ports.Handshake]::${handshake}`,
    '  $p.WriteTimeout = 10000', '  $p.Open()',
    `  $b = [System.IO.File]::ReadAllBytes('${ps(temporaryFile)}')`,
    '  $p.Write($b, 0, $b.Length)', '  $p.Close()', "  Write-Output 'OK'",
    '} catch { Write-Output $_.Exception.Message; exit 1 }'
  ].join('\n')
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 30000, windowsHide: true, signal })
    return stdout.includes('OK')
      ? { ok: true, status: 'accepted', bytesWritten: data.byteLength, message: `已发送到串口 ${portName}（${baud} bps）` }
      : { ok: false, status: 'unknown', message: `串口 ${portName} 未确认完成写入` }
  } catch (error) {
    if (signal?.aborted || (error as { name?: string }).name === 'AbortError') return { ok: false, canceled: true, status: 'canceled', message: '已取消打印' }
    const detail = (error as { stderr?: string; message?: string }).stderr || (error as { message?: string }).message || '未知错误'
    return { ok: false, status: 'failed', message: '串口发送失败：' + String(detail).slice(0, 300) }
  } finally {
    await rm(temporaryFile, { force: true }).catch(() => {})
  }
}

export async function listWindowsComPorts(): Promise<string[]> {
  if (process.platform !== 'win32') return []
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '[System.IO.Ports.SerialPort]::GetPortNames()'], { timeout: 15000, windowsHide: true })
    return stdout.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)
  } catch { return [] }
}

/**
 * 打印对话框「打印机 名称 / 位置」要用的 Windows 侧事实：
 * 每台打印队列的**端口名**与**默认打印机名**。真机在该处显示的就是这两样
 * （`parity/reference/labelshop/probe-63-30-print-dialog.png`：`名称: Microsoft Print to PDF` / `位置: PORTPROMPT:`）。
 * Electron 的 `getPrintersAsync()` 两者都不给（`PrinterInfo` 只有 name/displayName/description/options），
 * 所以这里从 `Win32_Printer` 取，取不到就返回空表 —— 不编造端口。
 */
export interface WindowsPrinterFacts {
  /** 打印机名（小写）→ 端口名，如 `microsoft print to pdf` → `PORTPROMPT:`。 */
  ports: Record<string, string>
  /** 原始大小写的默认打印机名；没有默认打印机时为空串。 */
  defaultName: string
}

export async function listWindowsPrinterFacts(): Promise<WindowsPrinterFacts> {
  if (process.platform !== 'win32') return { ports: {}, defaultName: '' }
  const script = [
    "$ErrorActionPreference='Stop'",
    "$items = @(Get-CimInstance Win32_Printer | ForEach-Object { [pscustomobject]@{ name=$_.Name; port=$_.PortName; def=[bool]$_.Default } })",
    "$items | ConvertTo-Json -Compress"
  ].join('; ')
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 15000, windowsHide: true, maxBuffer: 1024 * 1024 })
    const parsed = JSON.parse(stdout.trim() || '[]') as unknown
    const items = Array.isArray(parsed) ? parsed : [parsed]
    const ports: Record<string, string> = {}
    let defaultName = ''
    for (const item of items) {
      if (!item || typeof item !== 'object') continue
      const value = item as Record<string, unknown>
      const name = typeof value.name === 'string' ? value.name.trim() : ''
      if (!name) continue
      const port = typeof value.port === 'string' ? value.port.trim() : ''
      if (port) ports[name.toLowerCase()] = port
      if (value.def === true && !defaultName) defaultName = name
    }
    return { ports, defaultName }
  } catch { return { ports: {}, defaultName: '' } }
}

/**
 * Electron 的 getPrintersAsync 只能返回已经注册到 Windows 打印队列的设备。
 * USB 标签机在安装厂商驱动前，通常只出现在 USBPRINT/PnP 设备树中；LabelShop
 * 仍会把这类设备展示为可配置的打印机，所以这里补充一层只读设备枚举。
 */
export interface WindowsPrinterDevice {
  name: string
  displayName: string
  status: number
}

export async function listWindowsPrinterDevices(): Promise<WindowsPrinterDevice[]> {
  if (process.platform !== 'win32') return []
  const script = [
    "$ErrorActionPreference='Stop'",
    "$items = @(Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like 'USBPRINT\\*' -or $_.Class -eq 'Printer' } | ForEach-Object { [pscustomobject]@{ name=$_.FriendlyName; displayName=$_.FriendlyName; status=0 } })",
    "$items | ConvertTo-Json -Compress"
  ].join('; ')
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 15000, windowsHide: true, maxBuffer: 1024 * 1024 })
    const parsed = JSON.parse(stdout.trim() || '[]') as unknown
    const items = Array.isArray(parsed) ? parsed : [parsed]
    return items.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const value = item as Record<string, unknown>
      const name = typeof value.name === 'string' ? value.name.trim() : ''
      const displayName = typeof value.displayName === 'string' ? value.displayName.trim() : name
      return name ? [{ name, displayName: displayName || name, status: 0 }] : []
    })
  } catch { return [] }
}

/**
 * 「打印机属性 → 端口 → 类型 = USB 打印机端口」时，「端口(O)」下拉里的候选。
 * 真机显示形如 `USB001 (Gprinter GP-1324D)`（`parity/reference/labelshop/probe-14-printer-props-combos.txt`）：
 * Windows 只把 USB 标签机登记成 PnP 设备（`USBPRINT\...\7&3521C07E&0&USB001`），设备 ID 末尾就是端口名，
 * 因此这里从 DeviceID 里取端口、用 FriendlyName 当设备名，格式化成真机那种「端口 (设备)」。
 */
export async function listWindowsUsbPrinterPorts(): Promise<string[]> {
  if (process.platform !== 'win32') return []
  const script = [
    "$ErrorActionPreference='Stop'",
    "$items = @(Get-CimInstance Win32_PnPEntity | Where-Object { $_.DeviceID -like 'USBPRINT\\*' } | ForEach-Object {",
    "  $m = [regex]::Match($_.DeviceID, '&(USB\\d+)$')",
    "  [pscustomobject]@{ port = $(if ($m.Success) { $m.Groups[1].Value } else { '' }); device = $_.Name }",
    "})",
    "$items | ConvertTo-Json -Compress"
  ].join('; ')
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 15000, windowsHide: true, maxBuffer: 1024 * 1024 })
    const parsed = JSON.parse(stdout.trim() || '[]') as unknown
    const items = Array.isArray(parsed) ? parsed : [parsed]
    return items.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const value = item as Record<string, unknown>
      const portName = typeof value.port === 'string' ? value.port.trim() : ''
      const deviceName = typeof value.device === 'string' ? value.device : ''
      return portName ? [formatUsbPrinterPort(portName, deviceName)] : []
    })
  } catch { return [] }
}

/**
 * USB 打印机的指令输出。
 *
 * 真机靠「内置驱动」直接写 USBPRINT；Windows 不把 `USB001` 暴露成可写设备路径
 * （实测 `\\.\USB001`、`\\.\USBPRINT\…` 都打不开），所以复刻版走**打印后台（spooler）raw 写入**：
 * 先按端口名找到打印队列（`Get-Printer` 里 `PortName` 匹配的那个），再用 winspool 的
 * `OpenPrinter/StartDocPrinter(DATATYPE=RAW)/WritePrinter` 把指令原样发给队列。
 * 机器上没有对应队列时（例如没装厂商驱动）返回明确提示，让用户装官方驱动或改用串口/文件。
 */
async function writeRawToWindowsQueue(portName: string, data: Buffer, signal?: AbortSignal): Promise<PrintTransportResult> {
  if (process.platform !== 'win32') return { ok: false, status: 'failed', message: '当前平台尚未配置 USB 传输适配器' }
  if (signal?.aborted) return { ok: false, canceled: true, status: 'canceled', message: '已取消打印' }
  if (!/^USB[0-9]+$/i.test(portName)) return { ok: false, status: 'failed', message: `USB 端口名无效：${portName || '（空）'}` }
  const temporaryFile = join(tmpdir(), `maxlabel-usb-${randomUUID()}.bin`)
  await writeFile(temporaryFile, data)
  const ps = (value: string) => value.replace(/'/g, "''")
  const script = [
    "$ErrorActionPreference='Stop'",
    `$portName = '${ps(portName.toUpperCase())}'`,
    `$file = '${ps(temporaryFile)}'`,
    "$queue = @(Get-Printer | Where-Object { $_.PortName -eq $portName } | Select-Object -First 1)",
    "if (-not $queue) { Write-Output ('NOQUEUE:' + $portName); exit 0 }",
    "$queueName = $queue[0].Name",
    "Add-Type -TypeDefinition @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public class MaxLabelRawPrint {",
    "  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] public class DOCINFO { [MarshalAs(UnmanagedType.LPWStr)] public string pDocName; [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile; [MarshalAs(UnmanagedType.LPWStr)] public string pDataType; }",
    "  [DllImport(\"winspool.drv\", CharSet=CharSet.Unicode, SetLastError=true)] public static extern bool OpenPrinter(string name, out IntPtr h, IntPtr def);",
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool ClosePrinter(IntPtr h);",
    "  [DllImport(\"winspool.drv\", CharSet=CharSet.Unicode, SetLastError=true)] public static extern int StartDocPrinter(IntPtr h, int level, [In] DOCINFO di);",
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool EndDocPrinter(IntPtr h);",
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool StartPagePrinter(IntPtr h);",
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool EndPagePrinter(IntPtr h);",
    "  [DllImport(\"winspool.drv\", SetLastError=true)] public static extern bool WritePrinter(IntPtr h, IntPtr buf, int count, out int written);",
    "}",
    "'@",
    "$h = [IntPtr]::Zero",
    "if (-not [MaxLabelRawPrint]::OpenPrinter($queueName, [ref]$h, [IntPtr]::Zero)) { Write-Output ('OPENFAIL:' + $queueName); exit 1 }",
    "$di = New-Object MaxLabelRawPrint+DOCINFO",
    "$di.pDocName = 'MaxLabel'; $di.pDataType = 'RAW'",
    "[void][MaxLabelRawPrint]::StartDocPrinter($h, 1, $di)",
    "[void][MaxLabelRawPrint]::StartPagePrinter($h)",
    "$bytes = [System.IO.File]::ReadAllBytes($file)",
    "$buf = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)",
    "[System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $buf, $bytes.Length)",
    "$written = 0",
    "$ok = [MaxLabelRawPrint]::WritePrinter($h, $buf, $bytes.Length, [ref]$written)",
    "[System.Runtime.InteropServices.Marshal]::FreeHGlobal($buf)",
    "[void][MaxLabelRawPrint]::EndPagePrinter($h)",
    "[void][MaxLabelRawPrint]::EndDocPrinter($h)",
    "[void][MaxLabelRawPrint]::ClosePrinter($h)",
    "Write-Output ('OK:' + $queueName + ':' + $written)"
  ].join('\n')
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 30000, windowsHide: true, maxBuffer: 1024 * 1024, signal })
    const text = stdout.trim()
    if (text.startsWith('NOQUEUE:')) {
      return {
        ok: false,
        status: 'failed',
        message: `${portName} 上没有找到 Windows 打印队列：请先安装该打印机的官方驱动（或把端口改为串口/指令文件）`
      }
    }
    if (text.startsWith('OK:')) {
      const [, queueName, written] = text.split(':')
      return { ok: true, status: 'accepted', bytesWritten: Number(written) || data.byteLength, message: `已通过打印队列 ${queueName} 发送 ${written || data.byteLength} 字节（RAW）` }
    }
    return { ok: false, status: 'unknown', message: `USB 打印未确认完成：${text.slice(0, 300) || '无输出'}` }
  } catch (error) {
    if (signal?.aborted || (error as { name?: string }).name === 'AbortError') return { ok: false, canceled: true, status: 'canceled', message: '已取消打印' }
    const detail = (error as { stderr?: string; message?: string }).stderr || (error as { message?: string }).message || '未知错误'
    return { ok: false, status: 'failed', message: 'USB 发送失败：' + String(detail).slice(0, 300) }
  } finally {
    await rm(temporaryFile, { force: true }).catch(() => {})
  }
}

export async function sendCommand(data: Buffer, port: PortConfig, signal?: AbortSignal): Promise<PrintTransportResult> {
  if (port.type === 'tcp' || port.type === 'cloudbox') {
    const host = port.tcpHost
    const portNumber = port.tcpPort
    if (!host || !portNumber) return { ok: false, status: 'failed', message: 'TCP 端口未配置主机 / IP 或端口号' }
    if (signal?.aborted) return { ok: false, canceled: true, status: 'canceled', message: '已取消打印' }
    return new Promise((resolve) => {
      const socket = createConnection({ host, port: portNumber })
      let settled = false
      const finish = (result: PrintTransportResult) => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', onAbort)
        resolve(result)
      }
      const onAbort = () => { socket.destroy(); finish({ ok: false, canceled: true, status: 'canceled', message: '已取消打印' }) }
      signal?.addEventListener('abort', onAbort, { once: true })
      socket.setTimeout(8000, () => { socket.destroy(); finish({ ok: false, status: 'failed', message: `连接超时：${host}:${portNumber}` }) })
      socket.on('connect', () => {
        if (signal?.aborted) return onAbort()
        socket.write(data, (error) => {
          if (error) return finish({ ok: false, status: 'failed', message: '发送失败：' + error.message })
          socket.end(() => finish({ ok: true, status: 'accepted', bytesWritten: data.byteLength, message: `已发送到 ${host}:${portNumber}（打印机是否完成打印需以设备状态为准）` }))
        })
      })
      socket.on('error', (error) => finish(signal?.aborted ? { ok: false, canceled: true, status: 'canceled', message: '已取消打印' } : { ok: false, status: 'failed', message: '连接失败：' + error.message }))
      socket.on('close', () => finish({ ok: false, status: 'unknown', message: `连接已关闭，无法确认 ${host}:${portNumber} 是否完整接收` }))
    })
  }
  if (port.type === 'com' || port.type === 'bluetooth') {
    if (!port.comPort) return { ok: false, status: 'failed', message: '未选择串口（COM 端口）' }
    return process.platform === 'win32'
      ? writeSerialWindows(port.comPort, port.baudRate ?? SERIAL_DEFAULT_BAUD_RATE, data, signal, port)
      : { ok: false, status: 'failed', message: '当前平台尚未配置串口传输适配器' }
  }
  if (port.type === 'lpt') {
    const name = (port.lptPort ?? 'LPT1').trim().toUpperCase()
    if (!/^LPT[1-9][0-9]*$/.test(name)) return { ok: false, status: 'failed', message: 'LPT 端口名称无效（例如 LPT1）' }
    if (process.platform !== 'win32') return { ok: false, status: 'failed', message: '当前平台尚未配置 LPT 传输适配器' }
    if (signal?.aborted) return { ok: false, canceled: true, status: 'canceled', message: '已取消打印' }
    try {
      // Windows exposes parallel printer ports as device files. Keeping this
      // in the transport adapter gives LabelShop's LPT workflow a real
      // implementation while leaving the protocol builders platform-neutral.
      await writeFile(`\\\\.\\${name}`, data)
      return { ok: true, status: 'accepted', bytesWritten: data.byteLength, message: `已发送到 ${name}` }
    } catch (error) {
      return { ok: false, status: 'failed', message: `LPT 发送失败：${String((error as { message?: string }).message ?? error).slice(0, 300)}` }
    }
  }
  if (port.type === 'usb') {
    const portName = usbPortName(port.usbPort)
    if (!portName) return { ok: false, status: 'failed', message: '请选择 USB 打印机端口（可点「刷新USB端口」重新枚举）' }
    return writeRawToWindowsQueue(portName, data, signal)
  }
  return { ok: false, status: 'failed', message: '该端口类型不支持原生指令传输' }
}
