export interface InstalledPrinterLike {
  name: string
  isDefault?: boolean
}

/**
 * 当前模板使用哪个 Windows 队列来打开驱动打印设置。
 * 只有「Windows 驱动」端口才有意义；模板没指定打印机时退回系统默认打印机。
 */
export function windowsDriverPrinterName(
  printer: { printerName?: string; port: { type: string } },
  installed: readonly InstalledPrinterLike[]
): string | undefined {
  if (printer.port.type !== 'driver') return undefined
  const explicit = printer.printerName?.trim()
  if (explicit) return explicit
  return (installed.find((item) => item.isDefault) ?? installed[0])?.name
}
