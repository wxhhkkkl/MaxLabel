import type { CommandSet, PortType } from '../../../../shared/domain/printer'
import { TWO_DIMENSIONAL_SYMBOLOGIES } from '../../../../shared/domain/objects'

/**
 * 「字体」页首行「字体类别」的三项。
 * 本程序不自带字体，`system` 与 `truetype` 共用同一份系统字体清单（`FONTS`）；
 * 只有 `printer` 的清单随打印机驱动变化。
 */
export type FontCategory = 'system' | 'truetype' | 'printer'

/** TSPL 内建字库：Font0–8 都是点阵；Font0 基准 8×12，Font1–8 各有固定格尺寸（按字号换算倍率）。 */
const TSPL_PRINTER_FONTS = ['Font0', 'Font1', 'Font2', 'Font3', 'Font4', 'Font5', 'Font6', 'Font7', 'Font8']
/** ZPL 内建字库：A–Z 与 0（同 shared/print/capabilities 与 zpl.ts）。 */
const ZPL_PRINTER_FONTS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0']
/** CPCL 内建字库：Font0–Font7（TEXT / BARCODE-TEXT 的 font 参数就是数字 0–7）。 */
const CPCL_PRINTER_FONTS = ['Font0', 'Font1', 'Font2', 'Font3', 'Font4', 'Font5', 'Font6', 'Font7']

/** 当前驱动可选的打印机内建字库标识；ESC-POS 没有内建字库，返回空数组。 */
export function printerFontOptions(driver: CommandSet | undefined): string[] {
  if (driver === 'tspl') return [...TSPL_PRINTER_FONTS]
  if (driver === 'zpl') return [...ZPL_PRINTER_FONTS]
  if (driver === 'cpcl') return [...CPCL_PRINTER_FONTS]
  return []
}

/**
 * 该码制能否使用打印机内建字体。
 * 二维条码整码强制位图（保证符号与画布一致），供人识读文字也画在位图里，只有系统 / TrueType 字体有效。
 */
export function supportsPrinterFont(symbology: string): boolean {
  return !TWO_DIMENSIONAL_SYMBOLOGIES.has(symbology.toLowerCase())
}

/** 打开对话框时的初始类别：已绑定打印机字体 → 打印机自建，否则系统。 */
export function initialFontCategory(printerFont: string | undefined): FontCategory {
  return printerFont ? 'printer' : 'system'
}

export type PrinterFontNotice = 'driver-port' | 'no-builtin-fonts' | 'ready'

/**
 * 「打印机自建」类别下方的说明该说哪一套。
 *
 * 驱动端口走 Chromium 图形输出，打印机内建字体根本不会被读取（`renderLabelSvg` 不认 `printerFont`），
 * 所以优先提示它；文件端口写的是指令流，字库照常生效，不在此列。
 */
export function printerFontNotice(portType: PortType | undefined, driver: CommandSet | undefined): PrinterFontNotice {
  if (portType === 'driver') return 'driver-port'
  return printerFontOptions(driver).length > 0 ? 'ready' : 'no-builtin-fonts'
}
