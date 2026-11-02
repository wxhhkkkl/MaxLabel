import type { LabelDoc } from '../../../../shared/domain/document'
import type { PrinterConfig } from '../../../../shared/domain/printer'

export interface AvailablePrinters {
  /** 本机已安装的 MaxLabel 内置驱动打印机名称。 */
  builtInNames: readonly string[]
  /** 本机 Windows 打印机队列（名称或显示名都可能与模板里保存的值一致）。 */
  systemPrinters: ReadonlyArray<{ name?: string; displayName?: string }>
  /** 本机当前默认打印机配置。 */
  defaultPrinter: PrinterConfig
}

/**
 * 打开模板时：模板绑定的打印机在本机不存在 → 丢掉整份打印机配置，改用当前默认打印机。
 *
 * 只处理绑定了打印机名的配置；TCP/COM/USB 等直连端口没有“本机打印机”概念，
 * 连接信息（主机、端口、波特率）仍保留。枚举失败时按“本机没有”处理。
 */
export function pruneUnavailablePrinter(doc: LabelDoc, available: AvailablePrinters): LabelDoc {
  const name = doc.printer?.printerName?.trim()
  if (!doc.printer || !name) return doc
  const wanted = name.toLowerCase()
  if (available.builtInNames.some((entry) => entry.trim().toLowerCase() === wanted)) return doc
  const found = available.systemPrinters.some((entry) =>
    [entry.name, entry.displayName].some((value) => (value ?? '').trim().toLowerCase() === wanted)
  )
  return found ? doc : { ...doc, printer: available.defaultPrinter }
}
