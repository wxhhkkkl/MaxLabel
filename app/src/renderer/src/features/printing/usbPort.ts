import { usbPortName, type PrinterConfig } from '../../../../shared/domain/printer'

export type ListPorts = () => Promise<{ usbPrinterPorts?: string[] }>
type ListQueues = () => Promise<{ printers?: Array<{ name: string; displayName: string; port?: string; hasQueue?: boolean }> }>

/**
 * USB 打印机没记住端口时补一次枚举。
 *
 * 新建标签的端口枚举是异步的：枚举还没回来就确认时，偏好/模板会存成「USB + 空端口」。
 * 多台设备时只使用与所选打印机队列对应的端口。
 */
export async function withResolvedUsbPort(
  printer: PrinterConfig,
  listPorts: ListPorts,
  listQueues?: ListQueues,
  signal?: AbortSignal
): Promise<PrinterConfig> {
  if (printer.port.type !== 'usb' || signal?.aborted) return printer
  const existing = printer.port.usbPort?.trim()
  if (existing) return printer
  const printerName = printer.printerName?.trim().toLowerCase()
  const enumeration = Promise.allSettled([
    listPorts(),
    printerName && listQueues ? listQueues() : undefined
  ])
  let cancel!: () => void
  const canceled = new Promise<undefined>((resolve) => { cancel = () => resolve(undefined) })
  signal?.addEventListener('abort', cancel, { once: true })
  const result = await Promise.race([enumeration, canceled]).finally(() => signal?.removeEventListener('abort', cancel))
  if (!result) return printer
  const [portsResult, queuesResult] = result
  if (portsResult.status !== 'fulfilled') return printer
  const ports = [...new Set((portsResult.value.usbPrinterPorts ?? []).map((port) => port.trim()).filter(Boolean))]
  const queues = queuesResult.status === 'fulfilled' ? queuesResult.value?.printers ?? [] : []
  const matching = printerName ? queues.filter((queue) => queue.hasQueue !== false &&
    [queue.name, queue.displayName].some((name) => name.trim().toLowerCase() === printerName)) : []
  const namedPorts = new Set(matching.map((queue) => queue.port?.trim().toUpperCase()).filter(Boolean))
  if (namedPorts.size) {
    const candidates = ports.filter((port) => namedPorts.has(port.toUpperCase()) ||
      (/^USB\d+$/i.test(usbPortName(port)) && namedPorts.has(usbPortName(port))))
    return candidates.length === 1 ? { ...printer, port: { ...printer.port, usbPort: candidates[0] } } : printer
  }
  return ports.length === 1 ? { ...printer, port: { ...printer.port, usbPort: ports[0] } } : printer
}
