import { createConnection } from 'node:net'
import type { PortConfig } from '../../../shared/domain/printer'
import type { PrintTransportResult } from '../../../shared/ipcContract'

export function sendTcp(data: Buffer, port: PortConfig, signal?: AbortSignal): Promise<PrintTransportResult> {
  if (signal?.aborted) return Promise.resolve({ ok: false, canceled: true, status: 'canceled', message: '已取消打印' })
  const host = port.tcpHost
  const portNumber = port.tcpPort
  if (!host || !portNumber) return Promise.resolve({ ok: false, status: 'failed', message: 'TCP 端口未配置主机 / IP 或端口号' })
  const endpoint = `${host}:${portNumber}`
  return new Promise((resolve) => {
    const socket = createConnection({ host, port: portNumber })
    let settled = false
    let writeStarted = false
    const finish = (result: PrintTransportResult) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      resolve(result)
    }
    const interrupt = (message: string, canceled = false) => {
      if (writeStarted) finish({ ok: false, status: 'unknown', message: `无法确认 ${endpoint} 是否完整接收：${message}` })
      else if (canceled) finish({ ok: false, status: 'canceled', canceled: true, message })
      else finish({ ok: false, status: 'failed', message })
      socket.destroy()
    }
    const onAbort = () => interrupt('已取消打印', true)
    signal?.addEventListener('abort', onAbort, { once: true })
    socket.setTimeout(8000, () => interrupt(`连接超时：${endpoint}`))
    socket.once('connect', () => {
      if (settled) return
      if (signal?.aborted) return onAbort()
      // An error from this point may leave bytes at the printer, even if the write callback fails.
      writeStarted = true
      socket.write(data, (error) => {
        if (settled) return
        if (error) return interrupt('发送失败：' + error.message)
        socket.end(() => finish({ ok: true, status: 'accepted', bytesWritten: data.byteLength, message: `已发送到 ${endpoint}（打印机是否完成打印需以设备状态为准）` }))
      })
    })
    socket.on('error', (error) => interrupt('连接失败：' + error.message))
    socket.once('close', () => {
      if (!settled) interrupt('连接已关闭')
    })
  })
}
