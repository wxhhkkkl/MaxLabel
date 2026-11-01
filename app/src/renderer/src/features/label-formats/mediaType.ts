import type { PrinterConfig } from '../../../../shared/domain/printer'
import { parseBuiltInPrinterValue } from '../shell/installedPrinters'

/** Picker value meaning “use the already configured printer”. */
export const CONFIGURED_PRINTER_VALUE = '__maxlabel_configured_printer__'

/** Common label-printer driver names; such Windows drivers still use roll media. */
export const ROLL_PRINTER_PATTERN = /(佳博|gprinter|gp[-\s]*\d|zebra|斑马|xprinter|芯烨|hprt|汉印|tsc|argox|立象|zenpert|label)/i

/**
 * 原版 “选择标签格式” media type: 0 = roll, 1 = sheet.
 * Built-in printers are always roll; Windows drivers default to sheet unless the
 * driver name identifies a label printer.
 */
export function mediaTypeOfSelection(printer: PrinterConfig, selectedPrinter: string): 0 | 1 {
  if (parseBuiltInPrinterValue(selectedPrinter)) return 0
  if (selectedPrinter && selectedPrinter !== CONFIGURED_PRINTER_VALUE) {
    return ROLL_PRINTER_PATTERN.test(selectedPrinter) ? 0 : 1
  }
  if (printer.port.type !== 'driver') return 0
  const identity = `${printer.printerName ?? ''} ${printer.model ?? ''} ${printer.profile ?? ''}`
  return ROLL_PRINTER_PATTERN.test(identity) ? 0 : 1
}

export interface MediaSupport {
  roll: boolean
  sheet: boolean
}

/**
 * 当前打印机**能打哪些介质**（020 现场：不能打的介质单选要置灰）。
 *
 * - 内置标签机：只有标签机固件，只支持卷筒
 * - 指令直连（TCP / COM / USB 等非驱动端口）：同样只支持卷筒
 * - **Windows 驱动打印机一律两种都放行** —— 驱动路径是按页面渲染的，页面尺寸可以任意，
 *   「Microsoft Print to PDF」这类虚拟打印机更是没有物理介质限制（020 现场：PDF 打印机
 *   为什么不能打卷筒标签）。
 * - 名称像标签机的驱动仍默认卷筒（见 `mediaTypeOfSelection`），但不禁止平张
 */
export function mediaSupportOfSelection(printer: PrinterConfig, selectedPrinter: string): MediaSupport {
  if (parseBuiltInPrinterValue(selectedPrinter)) return { roll: true, sheet: false }
  if (selectedPrinter && selectedPrinter !== CONFIGURED_PRINTER_VALUE) return { roll: true, sheet: true }
  if (printer.port.type !== 'driver') return { roll: true, sheet: false }
  return { roll: true, sheet: true }
}
