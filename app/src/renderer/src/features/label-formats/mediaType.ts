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
