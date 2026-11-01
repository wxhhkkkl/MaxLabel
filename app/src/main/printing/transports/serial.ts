// macOS/Linux serial and Bluetooth SPP transport via the serialport module.
import type { PortConfig } from '../../../shared/domain/printer'
import type { PrintTransportResult } from '../../../shared/ipcContract'
import type { PrinterQueryOptions, PrinterQueryResult, SerialDevice } from './types'

export type SerialPortModule = typeof import('serialport')

const PARITY: Record<string, 'none' | 'odd' | 'even' | 'mark' | 'space'> = {
  none: 'none', odd: 'odd', even: 'even', mark: 'mark', space: 'space'
}
const STOP_BITS: Record<string, 1 | 1.5 | 2> = {
  one: 1, onePointFive: 1.5, two: 2
}

export async function listSerialDevices(mod: SerialPortModule): Promise<SerialDevice[]> {
  try {
    const ports = await mod.SerialPort.list()
    return ports.map((port) => ({
      path: port.path,
      manufacturer: port.manufacturer,
      serialNumber: port.serialNumber,
      vendorId: port.vendorId,
      productId: port.productId,
      accessible: true
    }))
  } catch {
    return []
  }
}

/** 串口“查询-回读”：写指令后按静默窗口收集响应。 */
export function querySerial(mod: SerialPortModule, port: PortConfig, data: Buffer, options: PrinterQueryOptions = {}, signal?: AbortSignal): Promise<PrinterQueryResult> {
  if (!port.comPort) return Promise.resolve({ ok: false, message: '未选择串口或蓝牙设备' })
  if (signal?.aborted) return Promise.resolve({ ok: false, canceled: true, message: '已取消' })
  const timeoutMs = options.timeoutMs ?? 3000
  const quietMs = options.quietMs ?? 150
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let settled = false
    let quietTimer: NodeJS.Timeout | undefined
    let overallTimer: NodeJS.Timeout | undefined
    const instance = new mod.SerialPort({
      path: port.comPort!,
      baudRate: port.baudRate ?? 9600,
      dataBits: port.dataBits ?? 8,
      parity: PARITY[port.parity ?? 'none'] ?? 'none',
      stopBits: STOP_BITS[port.stopBits ?? 'one'] ?? 1,
      rtscts: port.flowControl === 'rtsCts',
      xon: port.flowControl === 'xonXoff',
      xoff: port.flowControl === 'xonXoff',
      autoOpen: false
    })
    const finish = (result: PrinterQueryResult) => {
      if (settled) return
      settled = true
      if (quietTimer) clearTimeout(quietTimer)
      if (overallTimer) clearTimeout(overallTimer)
      signal?.removeEventListener('abort', onAbort)
      try { instance.close(() => resolve(result)) } catch { resolve(result) }
    }
    const done = () => finish(chunks.length
      ? { ok: true, text: Buffer.concat(chunks).toString('latin1') }
      : { ok: false, message: '串口没有返回数据（超时）' })
    const onAbort = () => finish({ ok: false, canceled: true, message: '已取消' })
    signal?.addEventListener('abort', onAbort, { once: true })
    overallTimer = setTimeout(done, timeoutMs)
    instance.on('data', (chunk: Buffer | Uint8Array) => {
      chunks.push(Buffer.from(chunk))
      if (quietTimer) clearTimeout(quietTimer)
      quietTimer = setTimeout(done, quietMs)
    })
    instance.open((openError) => {
      if (openError) return finish({ ok: false, message: `串口打开失败：${openError.message}` })
      if (signal?.aborted) return onAbort()
      instance.write(data, (writeError) => {
        if (writeError) finish({ ok: false, message: `串口发送失败：${writeError.message}` })
      })
    })
  })
}

export function sendSerial(mod: SerialPortModule, port: PortConfig, data: Buffer, signal?: AbortSignal): Promise<PrintTransportResult> {
  if (!port.comPort) return Promise.resolve({ ok: false, status: 'failed', message: '未选择串口或蓝牙设备' })
  if (signal?.aborted) return Promise.resolve({ ok: false, canceled: true, status: 'canceled', message: '已取消打印' })
  const baudRate = port.baudRate ?? 9600
  return new Promise((resolve) => {
    let settled = false
    const instance = new mod.SerialPort({
      path: port.comPort!,
      baudRate,
      dataBits: port.dataBits ?? 8,
      parity: PARITY[port.parity ?? 'none'] ?? 'none',
      stopBits: STOP_BITS[port.stopBits ?? 'one'] ?? 1,
      rtscts: port.flowControl === 'rtsCts',
      xon: port.flowControl === 'xonXoff',
      xoff: port.flowControl === 'xonXoff',
      autoOpen: false
    })
    const finish = (result: PrintTransportResult) => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      resolve(result)
    }
    const onAbort = () => {
      try { instance.close(() => finish({ ok: false, canceled: true, status: 'canceled', message: '已取消打印' })) } catch { finish({ ok: false, canceled: true, status: 'canceled', message: '已取消打印' }) }
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    instance.open((openError) => {
      if (openError) return finish({ ok: false, status: 'failed', message: `串口打开失败：${openError.message}` })
      if (signal?.aborted) return onAbort()
      instance.write(data, (writeError) => {
        if (writeError) {
          instance.close(() => finish({ ok: false, status: 'failed', message: `串口发送失败：${writeError.message}` }))
          return
        }
        instance.drain((drainError) => {
          instance.close(() => {
            if (drainError) return finish({ ok: false, status: 'unknown', message: `串口未确认完成写入：${drainError.message}` })
            finish({ ok: true, status: 'accepted', bytesWritten: data.byteLength, message: `已发送到串口 ${port.comPort}（${baudRate} bps）` })
          })
        })
      })
    })
  })
}
