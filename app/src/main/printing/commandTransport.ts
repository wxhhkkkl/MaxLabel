import { createConnection } from 'node:net'
import { execFile } from 'child_process'
import { randomUUID } from 'crypto'
import { rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { promisify } from 'util'
import type { PortConfig } from '../../shared/domain/printer'
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

export async function sendCommand(data: Buffer, port: PortConfig, signal?: AbortSignal): Promise<PrintTransportResult> {
  if (port.type === 'tcp') {
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
  if (port.type === 'usb') return { ok: false, status: 'failed', message: 'USB 设备请使用系统打印驱动或对应的 USB 虚拟串口' }
  return { ok: false, status: 'failed', message: '该端口类型不支持原生指令传输' }
}
