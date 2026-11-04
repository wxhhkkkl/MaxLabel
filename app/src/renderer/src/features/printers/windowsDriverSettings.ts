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

export type PrinterSettingsEntry =
  | { kind: 'windows'; printerName: string }
  | { kind: 'app' }

/**
 * 打印面板「设置」按钮该打开哪个设置。
 *
 * - Windows 打印队列（驱动端口 + 本机确有这个队列）→ Windows 打印机属性；
 * - MaxLabel 安装的内置驱动打印机（USB 端口）、TCP/COM 等直连端口、或打印机名
 *   在本机已不存在 → 应用内打印机设置页（端口/指令集这些只能在我们的页面里改）。
 */
export function printerSettingsEntry(
  printer: { printerName?: string; port: { type: string } } | undefined,
  installed: readonly InstalledPrinterLike[]
): PrinterSettingsEntry {
  const name = windowsDriverPrinterName(printer ?? { port: { type: 'driver' } }, installed)
  if (!name) return { kind: 'app' }
  const key = name.trim().toLowerCase()
  const inQueue = installed.some((item) => item.name.trim().toLowerCase() === key)
  return inQueue ? { kind: 'windows', printerName: name } : { kind: 'app' }
}
