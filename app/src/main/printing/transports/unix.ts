// macOS/Linux transport adapter: CUPS/lp, serialport and usb/libusb.
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm, writeFile } from 'node:fs/promises'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { PortConfig } from '../../../shared/domain/printer'
import type { PrintTransportResult } from '../../../shared/ipcContract'
import type { PlatformTransportAdapter, PrinterFacts, SerialDevice } from './types'
import { listSerialDevices, sendSerial, type SerialPortModule } from './serial'
import { listUsbDevices, sendUsb, usbLabel, type UsbModule } from './usb'

export type ExecFileAsync = (file: string, args: string[], options?: Record<string, unknown>) => Promise<{ stdout: string; stderr?: string }>

export interface UnixAdapterDeps {
  execFileAsync?: ExecFileAsync
  serialPort?: SerialPortModule
  usb?: UsbModule
}

const defaultExecFile = promisify(execFile) as unknown as ExecFileAsync

function sendTcp(data: Buffer, port: PortConfig, signal?: AbortSignal): Promise<PrintTransportResult> {
  const host = port.tcpHost
  const portNumber = port.tcpPort
  if (!host || !portNumber) return Promise.resolve({ ok: false, status: 'failed', message: 'TCP 端口未配置主机 / IP 或端口号' })
  if (signal?.aborted) return Promise.resolve({ ok: false, canceled: true, status: 'canceled', message: '已取消打印' })
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

function parseCupsQueues(stdout: string): string[] {
  return stdout.split(/\r?\n/).flatMap((line) => {
    const match = /^printer\s+(\S+)/i.exec(line.trim())
    return match ? [match[1]] : []
  })
}

function parseCupsDefault(stdout: string): string {
  const match = /system default destination:\s*(\S+)/i.exec(stdout)
  return match ? match[1] : ''
}

export async function listCupsFacts(deps: UnixAdapterDeps = {}): Promise<PrinterFacts> {
  const run = deps.execFileAsync ?? defaultExecFile
  try {
    const [printers, defaultQueue] = await Promise.all([
      run('lpstat', ['-p'], { timeout: 15000 }),
      run('lpstat', ['-d'], { timeout: 15000 })
    ])
    const names = parseCupsQueues(printers.stdout)
    const ports: Record<string, string> = {}
    for (const name of names) ports[name.toLowerCase()] = name
    return { ports, defaultName: parseCupsDefault(defaultQueue.stdout) }
  } catch {
    return { ports: {}, defaultName: '' }
  }
}

/** Raw CUPS submission used by driver/raw paths; never interpolates a shell. */
export async function sendRawToCups(data: Buffer, queue: string, deps: UnixAdapterDeps = {}): Promise<PrintTransportResult> {
  const target = String(queue ?? '').trim()
  if (!target || /[\u0000-\u001f]/.test(target)) return { ok: false, status: 'failed', message: 'CUPS 队列名无效' }
  const run = deps.execFileAsync ?? defaultExecFile
  const temporaryFile = join(tmpdir(), `maxlabel-cups-${randomUUID()}.bin`)
  try {
    await writeFile(temporaryFile, data)
    await run('lp', ['-d', target, '-o', 'raw', temporaryFile], { timeout: 30000 })
    return { ok: true, status: 'accepted', bytesWritten: data.byteLength, message: `已提交到 CUPS 队列 ${target}` }
  } catch (error) {
    return { ok: false, status: 'failed', message: 'CUPS 提交失败：' + String((error as { message?: string }).message ?? error).slice(0, 300) }
  } finally {
    await rm(temporaryFile, { force: true }).catch(() => undefined)
  }
}

export function createUnixAdapter(deps: UnixAdapterDeps = {}): PlatformTransportAdapter {
  async function serialModule(): Promise<SerialPortModule | null> {
    if (deps.serialPort) return deps.serialPort
    try { return await import('serialport') } catch { return null }
  }
  async function usbModule(): Promise<UsbModule | null> {
    if (deps.usb) return deps.usb
    try { return await import('usb') } catch { return null }
  }

  return {
    kind: 'unix',
    async sendCommand(data, port, signal) {
      if (port.type === 'tcp' || port.type === 'cloudbox') return sendTcp(data, port, signal)
      if (port.type === 'file') return { ok: false, status: 'failed', message: '文件端口由打印执行器处理' }
      if (port.type === 'driver') return { ok: false, status: 'failed', message: '驱动打印由主进程 Electron 打印流程处理' }
      if (port.type === 'lpt') return { ok: false, status: 'failed', message: '当前平台不支持 LPT 端口' }
      if (port.type === 'com' || port.type === 'bluetooth') {
        const mod = await serialModule()
        if (!mod) return { ok: false, status: 'failed', message: 'serialport 模块不可用，请检查安装包/权限' }
        return sendSerial(mod, port, data, signal)
      }
      if (port.type === 'usb') {
        const mod = await usbModule()
        if (!mod) return { ok: false, status: 'failed', message: 'usb 模块不可用，请检查安装包/权限' }
        return sendUsb(mod, port.usbPort, data, signal)
      }
      return { ok: false, status: 'failed', message: '该端口类型不支持原生指令传输' }
    },
    async listSerialPorts(): Promise<SerialDevice[]> {
      const mod = await serialModule()
      return mod ? listSerialDevices(mod) : []
    },
    async listUsbPrinterPorts(): Promise<string[]> {
      const mod = await usbModule()
      if (!mod) return []
      const devices = await listUsbDevices(mod)
      return devices.filter((device) => device.accessible).map((device) => usbLabel(device.vendorId, device.productId))
    },
    listPrinterFacts(): Promise<PrinterFacts> {
      return listCupsFacts(deps)
    }
  }
}

export const unixTransportAdapter = createUnixAdapter()
