// macOS/Linux transport adapter. CUPS/serial/USB implementations land in US3.
import { createConnection } from 'node:net'
import type { PortConfig } from '../../../shared/domain/printer'
import type { PrintTransportResult } from '../../../shared/ipcContract'
import type { PlatformTransportAdapter, PrinterFacts, SerialDevice } from './types'

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

export const unixTransportAdapter: PlatformTransportAdapter = {
  kind: 'unix',
  async sendCommand(data, port, signal) {
    if (port.type === 'tcp' || port.type === 'cloudbox') return sendTcp(data, port, signal)
    if (port.type === 'file') return { ok: false, status: 'failed', message: '文件端口由打印执行器处理' }
    if (port.type === 'lpt') return { ok: false, status: 'failed', message: '当前平台不支持 LPT 端口' }
    if (port.type === 'com' || port.type === 'bluetooth') return { ok: false, status: 'failed', message: '当前平台的串口传输适配器尚未配置' }
    if (port.type === 'usb') return { ok: false, status: 'failed', message: '当前平台的 USB 传输适配器尚未配置' }
    return { ok: false, status: 'failed', message: '该端口类型不支持原生指令传输' }
  },
  async listSerialPorts(): Promise<SerialDevice[]> {
    return []
  },
  async listUsbPrinterPorts(): Promise<string[]> {
    return []
  },
  async listPrinterFacts(): Promise<PrinterFacts> {
    return { ports: {}, defaultName: '' }
  }
}
