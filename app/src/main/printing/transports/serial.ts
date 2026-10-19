// macOS/Linux serial and Bluetooth SPP transport via the serialport module.
import type { PortConfig } from '../../../shared/domain/printer'
import type { PrintTransportResult } from '../../../shared/ipcContract'
import type { SerialDevice } from './types'

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
