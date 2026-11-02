import type { PrinterConfig } from '../../../../shared/domain/printer'

export type ListPorts = () => Promise<{ usbPrinterPorts?: string[] }>

/**
 * USB 打印机没记住端口时补一次枚举。
 *
 * 新建标签的端口枚举是异步的：枚举还没回来就确认时，偏好/模板会存成「USB + 空端口」。
 * 设置页里的「刷新USB端口」做的就是这次枚举，所以现场表现为「进设置刷新一下才能打印」。
 * 打印前用这里兜底，并按打印机名缓存结果，避免每打一次都跑一遍 PowerShell。
 */
export async function withResolvedUsbPort(
  printer: PrinterConfig,
  listPorts: ListPorts,
  cache?: Record<string, string>
): Promise<PrinterConfig> {
  if (printer.port.type !== 'usb') return printer
  const existing = printer.port.usbPort?.trim()
  if (existing) return printer
  const key = printer.printerName ?? printer.model ?? 'usb'
  let usbPort = cache?.[key]
  if (!usbPort) {
    try {
      usbPort = (await listPorts()).usbPrinterPorts?.[0]
    } catch {
      return printer
    }
    if (usbPort && cache) cache[key] = usbPort
  }
  return usbPort ? { ...printer, port: { ...printer.port, usbPort } } : printer
}
