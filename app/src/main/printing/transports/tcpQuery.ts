import { createConnection } from 'node:net'
import type { PortConfig } from '../../../shared/domain/printer'
import type { PrinterQueryOptions, PrinterQueryResult } from './types'

/**
 * TCP 直连查询：写指令后读取响应，收到数据后按静默窗口结束；
 * 打印机的状态/计数器响应通常是 ASCII，按 Latin-1 原样带回。
 */
export function queryTcp(data: Buffer, port: Pick<PortConfig, 'tcpHost' | 'tcpPort'>, options: PrinterQueryOptions = {}, signal?: AbortSignal): Promise<PrinterQueryResult> {
  const host = port.tcpHost
  const portNumber = port.tcpPort
  if (!host || !portNumber) return Promise.resolve({ ok: false, message: 'TCP 端口未配置主机 / IP 或端口号' })
  if (signal?.aborted) return Promise.resolve({ ok: false, canceled: true, message: '已取消' })
  const timeoutMs = options.timeoutMs ?? 3000
  const quietMs = options.quietMs ?? 150
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let settled = false
    let quietTimer: NodeJS.Timeout | undefined
    let overallTimer: NodeJS.Timeout | undefined
    const socket = createConnection({ host, port: portNumber })
    const finish = (result: PrinterQueryResult) => {
      if (settled) return
      settled = true
      if (quietTimer) clearTimeout(quietTimer)
      if (overallTimer) clearTimeout(overallTimer)
      signal?.removeEventListener('abort', onAbort)
      socket.destroy()
      resolve(result)
    }
    const done = () => finish(chunks.length
      ? { ok: true, text: Buffer.concat(chunks).toString('latin1') }
      : { ok: false, message: '打印机没有返回数据（超时）' })
    const onAbort = () => finish({ ok: false, canceled: true, message: '已取消' })
    signal?.addEventListener('abort', onAbort, { once: true })
    overallTimer = setTimeout(done, timeoutMs)
    socket.on('connect', () => { if (!signal?.aborted) socket.write(data) })
    socket.on('data', (chunk) => {
      chunks.push(chunk)
      if (quietTimer) clearTimeout(quietTimer)
      quietTimer = setTimeout(done, quietMs)
    })
    socket.on('error', (error) => finish({ ok: false, message: `连接失败：${error.message}` }))
    socket.on('close', () => { if (!settled) done() })
  })
}
