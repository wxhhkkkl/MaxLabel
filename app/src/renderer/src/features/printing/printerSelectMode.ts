import { defaultPrinterConfig, type PrinterConfig } from '../../../../shared/domain/printer'
import type { PrinterCatalogEntry } from '../../../../shared/domain/printerCatalog.generated'
import {
  builtInPrinterValue,
  configFromCatalogEntry,
  parseBuiltInPrinterValue
} from '../shell/installedPrinters'

/** 当前模板的打印机是自定义直连端口（不是下拉里的内置打印机）时使用的占位值。 */
export const CURRENT_DIRECT_PRINTER_VALUE = '__maxlabel_current_printer__'

/**
 * 打印面板下拉当前应选中的值。
 *
 * - 空串 = 跟随系统默认打印机（驱动）
 * - `ls:<id>` = 已安装的内置直连打印机
 * - 打印机名 = Windows 驱动打印机
 * - CURRENT_DIRECT_PRINTER_VALUE = 当前模板自己的 TCP/COM/文件等直连配置
 */
export function printerSelectionValue(
  printer: PrinterConfig | undefined,
  builtInPrinters: readonly PrinterCatalogEntry[]
): string {
  if (!printer) return ''
  const name = printer.printerName?.trim() ?? ''
  const builtIn = name ? builtInPrinters.find((entry) => entry.name === name) : undefined
  if (builtIn) return builtInPrinterValue(builtIn.id)
  if ((printer.port.type ?? 'driver') === 'driver') return name
  return CURRENT_DIRECT_PRINTER_VALUE
}

/**
 * 把下拉选择落到一份完整的打印机配置。
 *
 * - 选 Windows 打印机 / 系统默认：端口切到 driver；
 * - 选内置直连打印机：使用它的指令集、DPI 与直连端口；已配置过的同一台打印机保留原端口；
 * - 选当前直连项：保持模板现有配置不变。
 */
export function applyPrinterSelection(
  current: PrinterConfig | undefined,
  value: string,
  builtInPrinters: readonly PrinterCatalogEntry[]
): PrinterConfig {
  const base = current ?? defaultPrinterConfig()
  if (value === CURRENT_DIRECT_PRINTER_VALUE) return base

  const builtInId = parseBuiltInPrinterValue(value)
  if (builtInId) {
    const entry = builtInPrinters.find((item) => item.id === builtInId)
    if (!entry) return base
    // 同一台内置打印机已经配置过 TCP/COM 等端口时，不要切回默认 USB。
    if (base.printerName === entry.name && base.port.type !== 'driver') return base
    return configFromCatalogEntry(entry, base)
  }

  return {
    ...base,
    printerName: value || undefined,
    port: { ...base.port, type: 'driver' }
  }
}
