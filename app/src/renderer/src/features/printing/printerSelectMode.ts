import type { PrinterConfig } from '../../../../shared/domain/printer'

/**
 * 打印面板「打印机」下拉是否可选。
 *
 * 只有走 Windows 驱动时才挑打印机名；文件 / TCP / 串口直连时打印机名不参与。
 * ⚠️ 模板**没有**打印机配置时等同于「系统默认打印机（驱动）」—— 不能因为
 * `printer` 是 undefined 就把下拉禁掉（老模板全是这种）。
 */
export function canChoosePrinter(printer: PrinterConfig | undefined): boolean {
  return (printer?.port.type ?? 'driver') === 'driver'
}
