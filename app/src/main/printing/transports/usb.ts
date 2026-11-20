// macOS/Linux raw USB transport via the usb (libusb) module.
import type { PrintTransportResult } from '../../../shared/ipcContract'
import type { UsbDevice } from './types'

export type UsbModule = typeof import('usb')
type NativeUsbDevice = ReturnType<UsbModule['getDeviceList']>[number]

const PRINTER_CLASS = 7
const TRANSFER_TIMEOUT_MS = 8_000

interface UsbTarget {
  vendorId: number
  productId: number
  location?: string
}

type UsbLocation = Pick<UsbDevice, 'busNumber' | 'deviceAddress' | 'portNumbers'>

function usbLocation(device: UsbLocation): string | undefined {
  if (device.busNumber === undefined) return
  if (device.portNumbers?.length) return `${device.busNumber}-${device.portNumbers.join('.')}`
  if (device.deviceAddress !== undefined) return `${device.busNumber}:${device.deviceAddress}`
}

/** Prefer the physical USB port path since the device address changes on reconnect. */
export function usbLabel(device: UsbDevice): string {
  const base = `USB-${device.vendorId.toString(16).padStart(4, '0')}:${device.productId.toString(16).padStart(4, '0')}`
  const location = usbLocation(device)
  return location ? `${base}@${location}` : base
}

export function parseUsbLabel(label: string | undefined): UsbTarget | null {
  const match = /^USB-([0-9a-f]{1,4}):([0-9a-f]{1,4})(?:@(\d+[-:]\d+(?:\.\d+)*))?(?: \([^)]*\))?$/i.exec((label ?? '').trim())
  if (!match) return null
  return { vendorId: parseInt(match[1], 16), productId: parseInt(match[2], 16), location: match[3] }
}

function isPrinterDevice(device: NativeUsbDevice): boolean {
  if (device.deviceDescriptor?.bDeviceClass === PRINTER_CLASS) return true
  return device.configDescriptor?.interfaces.some((settings) =>
    settings.some((descriptor) => descriptor.bInterfaceClass === PRINTER_CLASS)
  ) ?? false
}

export async function listUsbDevices(mod: UsbModule): Promise<UsbDevice[]> {
  try {
    return mod.getDeviceList().map((device) => {
      const descriptor = device.deviceDescriptor ?? ({} as { idVendor?: number; idProduct?: number })
      return {
        vendorId: descriptor.idVendor ?? 0,
        productId: descriptor.idProduct ?? 0,
        busNumber: device.busNumber,
        deviceAddress: device.deviceAddress,
        portNumbers: device.portNumbers,
        manufacturer: undefined,
        product: undefined,
        accessible: isPrinterDevice(device)
      }
    })
  } catch {
    return []
  }
}

export async function sendUsb(mod: UsbModule, label: string | undefined, data: Buffer, signal?: AbortSignal): Promise<PrintTransportResult> {
  const target = parseUsbLabel(label)
  if (!target) return { ok: false, status: 'failed', message: 'USB 端口名无效（请刷新 USB 设备后重新选择）' }
  if (signal?.aborted) return { ok: false, canceled: true, status: 'canceled', message: '已取消打印' }
  let opened: NativeUsbDevice | undefined
  let claimed: ReturnType<NativeUsbDevice['interface']> | undefined
  let offset = 0
  let writeStarted = false
  const interrupted = (message: string): PrintTransportResult => writeStarted
    ? { ok: false, status: 'unknown', bytesWritten: offset, message }
    : { ok: false, canceled: true, status: 'canceled', message }
  try {
    const devices = mod.getDeviceList().filter((item) => {
      const descriptor = item.deviceDescriptor
      return descriptor?.idVendor === target.vendorId && descriptor?.idProduct === target.productId
        && (!target.location || usbLocation(item) === target.location)
    })
    if (devices.length > 1) return { ok: false, status: 'failed', message: '有多台同型号 USB 打印机，请刷新并选择具体端口' }
    const [device] = devices
    if (!device) return { ok: false, status: 'failed', message: '未找到对应的 USB 打印机' }
    device.open()
    opened = device
    const iface = device.interfaces?.find((item) => item.descriptor.bInterfaceClass === PRINTER_CLASS) ?? device.interface(0)
    try { iface.claim() } catch { return { ok: false, status: 'failed', message: 'USB 接口被占用或无权限（Linux 请检查 udev 规则）' } }
    claimed = iface
    const endpoint = iface.endpoints.find((item) => item.direction === 'out')
    if (!endpoint) {
      return { ok: false, status: 'failed', message: 'USB 打印机没有可用的输出端点' }
    }
    while (offset < data.length) {
      if (signal?.aborted) {
        return interrupted('已取消 USB 打印')
      }
      const chunk = data.subarray(offset, Math.min(data.length, offset + 4096))
      const written = await new Promise<number>((resolve, reject) => {
        const transfer = endpoint.makeTransfer(TRANSFER_TIMEOUT_MS, (error, _buffer, actual) => {
          signal?.removeEventListener('abort', abort)
          if (error) reject(error)
          else resolve(actual)
        })
        const abort = () => {
          try { transfer.cancel() } catch { /* The transfer may have just finished. */ }
        }
        signal?.addEventListener('abort', abort, { once: true })
        try {
          writeStarted = true
          transfer.submit(chunk)
        } catch (error) {
          signal?.removeEventListener('abort', abort)
          reject(error)
        }
      })
      offset += written
      if (written !== chunk.length) return { ok: false, status: 'unknown', bytesWritten: offset, message: 'USB 指令未完整发送' }
    }
    return { ok: true, status: 'accepted', bytesWritten: data.byteLength, message: '已通过 USB 发送（完成状态需以设备为准）' }
  } catch (error) {
    if (signal?.aborted) return interrupted('已取消 USB 打印')
    return {
      ok: false,
      status: writeStarted ? 'unknown' : 'failed',
      ...(writeStarted ? { bytesWritten: offset } : {}),
      message: 'USB 发送失败：' + String((error as { message?: string }).message ?? error).slice(0, 300)
    }
  } finally {
    if (claimed) {
      const iface = claimed
      await new Promise<void>((resolve) => iface.release(true, () => resolve())).catch(() => {})
    }
    try { opened?.close() } catch { /* The device may already be disconnected. */ }
  }
}
