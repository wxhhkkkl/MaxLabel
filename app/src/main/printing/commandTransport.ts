import { createConnection } from 'node:net'
import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import { formatUsbPrinterPort, type PortConfig } from '../../shared/domain/printer'
import type { PrintTransportResult } from '../../shared/ipcContract'

const execFileAsync = promisify(execFile)

async function writeSerialWindows(portName: string, baud: number, data: Buffer, signal?: AbortSignal): Promise<PrintTransportResult> {
  const temporaryFile = join(tmpdir(), `maxlabel-serial-${randomUUID()}.bin`)
  await writeFile(temporaryFile, data)
  const ps = (value: string) => value.replace(/'/g, "''")
  const script = [
    "$ErrorActionPreference='Stop'", 'try {',
    `  $p = New-Object System.IO.Ports.SerialPort('${ps(portName)}', ${Math.max(1, Math.trunc(baud))}, [System.IO.Ports.Parity]::None, 8, [System.IO.Ports.StopBits]::One)`,
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
      ? writeSerialWindows(port.comPort, port.baudRate ?? 115200, data, signal)
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
  if (port.type === 'usb') return { ok: false, status: 'failed', message: 'USB 设备请使用系统打印驱动或对应的 USB 虚拟串口' }
  return { ok: false, status: 'failed', message: '该端口类型不支持原生指令传输' }
}
