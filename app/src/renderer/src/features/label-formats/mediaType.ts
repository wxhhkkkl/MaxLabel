import type { PrinterConfig } from '../../../../shared/domain/printer'
import { parseBuiltInPrinterValue } from '../shell/installedPrinters'

/** Picker value meaning “use the already configured printer”. */
export const CONFIGURED_PRINTER_VALUE = '__maxlabel_configured_printer__'

/**
 * 新建标签的默认介质：**一律卷筒标签**（0），不再按打印机型号/驱动名推断平张。
 * 标签软件绝大多数场景是卷筒标签；平张/条幅仍可在对话框里手动选择。
 */
export const DEFAULT_NEW_LABEL_MEDIA: 0 = 0

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
 * - 新建标签默认卷筒（见 `DEFAULT_NEW_LABEL_MEDIA`），但不禁止平张
 */
export function mediaSupportOfSelection(printer: PrinterConfig, selectedPrinter: string): MediaSupport {
  if (parseBuiltInPrinterValue(selectedPrinter)) return { roll: true, sheet: false }
  if (selectedPrinter && selectedPrinter !== CONFIGURED_PRINTER_VALUE) return { roll: true, sheet: true }
  if (printer.port.type !== 'driver') return { roll: true, sheet: false }
  return { roll: true, sheet: true }
}
