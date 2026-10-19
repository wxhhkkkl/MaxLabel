// macOS/Linux raw USB transport via the usb (libusb) module.
import type { PrintTransportResult } from '../../../shared/ipcContract'
import type { UsbDevice } from './types'

export type UsbModule = typeof import('usb')

const PRINTER_CLASS = 7

interface UsbTarget {
  vendorId: number
  productId: number
  busNumber?: number
  deviceAddress?: number
}

/** Unix USB labels use `USB-<vid>:<pid>` plus an optional product suffix. */
export function usbLabel(vendorId: number, productId: number, product?: string): string {
  const base = `USB-${vendorId.toString(16).padStart(4, '0')}:${productId.toString(16).padStart(4, '0')}`
  return product ? `${base} (${product})` : base
}

export function parseUsbLabel(label: string | undefined): UsbTarget | null {
  const match = /^USB-([0-9a-f]{1,4}):([0-9a-f]{1,4})/i.exec((label ?? '').trim())
  if (!match) return null
  return { vendorId: parseInt(match[1], 16), productId: parseInt(match[2], 16) }
}

function isPrinterDevice(device: { deviceDescriptor?: { bDeviceClass?: number }; interfaces?: Array<{ descriptor?: { bInterfaceClass?: number } }> }): boolean {
  if (device.deviceDescriptor?.bDeviceClass === PRINTER_CLASS) return true
  return (device.interfaces ?? []).some((item) => item.descriptor?.bInterfaceClass === PRINTER_CLASS)
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
  try {
    const device = mod.getDeviceList().find((item) => {
      const descriptor = item.deviceDescriptor
      return descriptor?.idVendor === target.vendorId && descriptor?.idProduct === target.productId
    })
    if (!device) return { ok: false, status: 'failed', message: '未找到对应的 USB 打印机' }
    device.open()
    const iface = device.interface(0)
    try { iface.claim() } catch { return { ok: false, status: 'failed', message: 'USB 接口被占用或无权限（Linux 请检查 udev 规则）' } }
    type OutTransferEndpoint = { transfer(buffer: Buffer, callback: (error: Error | undefined) => void): unknown }
    const endpoint = iface.endpoints.find((item) => item.direction === 'out') as unknown as OutTransferEndpoint | undefined
    if (!endpoint) {
      iface.release(true, () => device.close())
      return { ok: false, status: 'failed', message: 'USB 打印机没有可用的输出端点' }
    }
    let offset = 0
    while (offset < data.length) {
      if (signal?.aborted) {
        iface.release(true, () => device.close())
        return { ok: false, canceled: true, status: 'canceled', message: '已取消打印' }
      }
      const chunk = data.subarray(offset, Math.min(data.length, offset + 4096))
      await new Promise<void>((resolve, reject) => endpoint.transfer(chunk, (error) => error ? reject(error) : resolve()))
      offset += chunk.length
    }
    await new Promise<void>((resolve) => iface.release(true, () => resolve()))
    device.close()
    return { ok: true, status: 'accepted', bytesWritten: data.byteLength, message: '已通过 USB 发送（完成状态需以设备为准）' }
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      message: 'USB 发送失败：' + String((error as { message?: string }).message ?? error).slice(0, 300)
    }
  }
}
