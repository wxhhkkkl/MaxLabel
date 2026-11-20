// ---------- SATO SBPL 指令适配器（CLNX / CL4NX 系列） ----------
//
// 真机 golden（SATO CLNX-N）：
//   STX ESC A … ESC Z ETX CRLF            每个帧以 STX/ETX 包裹
//   ESC A1V0160H0504                      标签高度/宽度（dot）
//   ESC H0472 ESC V0111                   位置（dot）
//   ESC BG02080>I12345678                 Code128：窄条 02、高 080、Start C = >I
//   ESC PS ESC L0202 ESC U12345678        文字：比例间距、放大 2×2、字库 U
//   ESC GP00677,<PCX>                     内联 PCX 位图（长度含 128 字节文件头）
//   ESC Q1                                份数
//
// 文字/图形/不支持的码制走 PCX 位图；Code128 走原生 BG。

import type { PrinterConfig } from '../domain/printer'
import type { MonoBitmap } from '../domain/units'
import { barcodeHumanTextBlockMm, type BarcodeObj, type TextObj } from '../domain/objects'
import type { ResolvedPrintScene } from './scene'
import { pushProtocolWarning, type WarningTarget } from './warnings'

const STX = '\x02'
const ESC = '\x1b'
const ETX = '\x03'

function frame(body: string): string {
  return STX + ESC + 'A' + body + ESC + 'Z' + ETX + '\r\n'
}

function dots(mm: number, dpi: number): number {
  return Math.max(0, Math.round((mm / 25.4) * dpi))
}

function pad(value: number, width: number): string {
  return String(Math.max(0, Math.round(value))).padStart(width, '0')
}

/** SATO 内建字库：基准点阵（203dpi）与切换命令字母。 */
export const SATO_FONT_METRICS: Record<string, { width: number; height: number }> = {
  U: { width: 5, height: 9 },
  S: { width: 8, height: 15 },
  M: { width: 13, height: 20 },
  WB: { width: 18, height: 30 },
  WL: { width: 28, height: 52 },
  XU: { width: 5, height: 9 },
  XS: { width: 17, height: 17 },
  XM: { width: 24, height: 24 },
  XB: { width: 48, height: 48 },
  XL: { width: 48, height: 48 },
  OA: { width: 15, height: 22 },
  OB: { width: 20, height: 24 }
}

export const SATO_NATIVE_FONTS: ReadonlySet<string> = new Set(Object.keys(SATO_FONT_METRICS))

/**
 * LabelShop 的 SATO 驱动只对 Code39/Code93/Codabar/Code128 发原生命令；
 * EAN/UPC/ITF 在 golden 中仍输出位图，这里保持一致。
 */
const SATO_BARCODE_TYPES: Record<string, string> = {
  codabar: '0',
  code39: '1',
  code93: 'C',
  code128: 'G'
}

export const SATO_NATIVE_BARCODES: ReadonlySet<string> = new Set(Object.keys(SATO_BARCODE_TYPES))

/** 按码制整理要发给打印机的数据；返回 undefined 表示该码制/内容应走位图。 */
function satoBarcodePayload(bar: BarcodeObj, value: string): string | undefined {
  if (!value || /[^\x20-\x7e]/.test(value) || value.includes('\n')) return undefined
  const options = bar.barcodeOptions ?? {}
  switch (bar.symbology) {
    case 'code128':
      // 纯数字偶数长度用 Start C；其余用 Start B。
      return /^\d+$/.test(value) && value.length % 2 === 0 ? '>I' + value : '>H' + value
    case 'code39':
      // golden：数据自带 * 起止符（BT/BW 组合）。
      return value.includes('*') || !/^[0-9A-Z\-. $/+%]+$/i.test(value) ? undefined : `*${value}*`
    case 'code93':
      return value.length <= 99 ? value : undefined
    case 'codabar': {
      if (options.codabarCheck && options.codabarCheck !== 'none') return undefined
      if (!/^[0-9\-$:/.+]+$/.test(value)) return undefined
      const start = (options.codabarStart ?? 'a').toUpperCase()
      const stop = (options.codabarStop ?? 'b').toUpperCase()
      return start + value + stop
    }
    default:
      return undefined
  }
}

/** 原生 1D 码制；GS1/附加码/起始符等特殊选项必须走位图。 */
export function satoNativeBarcodeEligible(bar: BarcodeObj, value: string): boolean {
  if (!SATO_NATIVE_BARCODES.has(bar.symbology)) return false
  if (Math.abs(((bar.rotation ?? 0) % 360 + 360) % 360) > 0.001) return false
  const options = bar.barcodeOptions ?? {}
  const allowed = new Set(['xSizeMm', 'xSizeMil', 'w2n', 'codabarStart', 'codabarStop', 'codabarCheck'])
  if (!Object.keys(options).every((key) => allowed.has(key))) return false
  return satoBarcodePayload(bar, value) !== undefined
}

export function satoNativeTextEligible(text: TextObj, value: string): boolean {
  if (!text.printerFont || !SATO_NATIVE_FONTS.has(text.printerFont)) return false
  if (!value || /[^\x20-\x7e]/.test(value) || value.includes('\n')) return false
  if (text.align !== 'left') return false
  // golden 中 WB/WL/XM/OA/OB 带粗体仍走原生（WB/WL 用命令参数 1）；SATO 字库不提供
  // 其它粗体表达，粗体在这里不改变命令形态。
  if (text.italic || text.underline || text.strikeout || text.reverse) return false
  if (text.backgroundColor) return false
  if (text.verticalAlign !== undefined && text.verticalAlign !== 'top') return false
  if (text.lineSpacing !== undefined || text.lineSpacingMm !== undefined) return false
  if (text.arc || text.textType === 'circle') return false
  if ((text.fontWidthScale ?? 1) !== 1) return false
  if ((text.charSpacing ?? 0) !== 0) return false
  if (text.flipX || text.flipY) return false
  if (Math.abs(((text.rotation % 360) + 360) % 360) > 0.001) return false
  if (!/^#(000|000000)$|^black$/i.test(text.color.trim())) return false
  return true
}

function position(xDots: number, yDots: number): string {
  return `${ESC}H${pad(xDots, 4)}${ESC}V${pad(yDots, 4)}`
}

function satoTextCommand(text: TextObj, value: string, dpi: number): string {
  const metrics = SATO_FONT_METRICS[text.printerFont!]
  const scale = dpi / 203
  const baseHeight = metrics.height * scale
  const targetDots = (text.fontSize / 25.4) * dpi
  const vertical = Math.max(1, Math.min(12, Math.round(targetDots / baseHeight)))
  const horizontal = Math.max(1, Math.min(12, vertical))
  // golden：WB/WL 后面紧跟参数 1（加粗/平滑），其它字库直接跟数据。
  const fontParameter = text.printerFont === 'WB' || text.printerFont === 'WL' ? '1' : ''
  return (
    position(dots(text.x, dpi), dots(text.y, dpi)) +
    `${ESC}PS${ESC}L${pad(horizontal, 2)}${pad(vertical, 2)}${ESC}${text.printerFont}${fontParameter}${value}`
  )
}

function satoBarcodeCommand(bar: BarcodeObj, value: string, dpi: number, humanText?: MonoBitmap): string {
  const narrow = Math.max(1, Math.min(12, Math.round(((bar.barcodeOptions?.xSizeMm ?? 0.25) / 25.4) * dpi)))
  const wide = Math.max(narrow, Math.min(36, Math.round(narrow * (bar.barcodeOptions?.w2n ?? 3))))
  const textBlockMm = bar.showText && humanText ? barcodeHumanTextBlockMm(bar, bar.barcodeOptions) : 0
  const barHeight = Math.max(1, Math.min(999, dots(Math.max(0.1, bar.h - textBlockMm), dpi)))
  const type = SATO_BARCODE_TYPES[bar.symbology]
  const payload = satoBarcodePayload(bar, value) ?? value
  if (bar.symbology === 'code39' || bar.symbology === 'codabar') {
    // golden：先 BT 注册比例（类型 + 窄条/宽条/窄空/宽空），再用 BW 指定比例表 01 输出。
    return (
      position(dots(bar.x, dpi), dots(bar.y, dpi)) +
      `${ESC}BT${type}${pad(narrow, 2)}${pad(wide, 2)}${pad(narrow, 2)}${pad(wide, 2)}` +
      `${ESC}BW01${pad(barHeight, 3)}${payload}`
    )
  }
  if (bar.symbology === 'code93') {
    // golden：BC + 窄条 + 高度 + 数据长度（2 位）。
    return `${position(dots(bar.x, dpi), dots(bar.y, dpi))}${ESC}BC${pad(narrow, 2)}${pad(barHeight, 3)}${pad(payload.length, 2)}${payload}`
  }
  return `${position(dots(bar.x, dpi), dots(bar.y, dpi))}${ESC}BG${pad(narrow, 2)}${pad(barHeight, 3)}${payload}`
}

function satoBitmapCommand(xMm: number, yMm: number, dpi: number, labelIndex: number, id: string): string {
  return `${position(dots(xMm, dpi), dots(yMm, dpi))}${ESC}GP@@PCX_LEN5:${labelIndex}:${id}@@,@@PCX:${labelIndex}:${id}@@`
}

export function buildSATO(
  scene: ResolvedPrintScene,
  printer: PrinterConfig,
  warnings: WarningTarget,
  pageToken = String(Math.max(0, scene.labelIndex - 1))
): string {
  const dpi = printer.dpi
  const L: string[] = []
  // 清缓冲 + 标签尺寸（高/宽，dot）。
  L.push(frame(''))
  L.push(frame(`${ESC}A1V${pad(dots(scene.heightMm, dpi), 4)}H${pad(dots(scene.widthMm, dpi), 4)}`))

  const body: string[] = [`${ESC}%${Math.max(1, Math.min(9, Math.round(printer.speed)))}`]
  if (scene.pageBitmap) {
    body.push(satoBitmapCommand(0, 0, dpi, scene.labelIndex, 'page'))
    body.push(`${ESC}Q${Math.max(1, scene.copy)}`)
    L.push(frame(body.join('')))
    return L.join('')
  }

  let missing = 0
  for (const primitive of scene.primitives) {
    if (primitive.kind === 'rfid') {
      pushProtocolWarning(warnings, 'sato-rfid', `SATO 不支持 RFID 写入（对象 ${primitive.object.id}），已跳过`, 'warning')
      continue
    }
    if (primitive.kind === 'text') {
      const text = primitive.object
      if (satoNativeTextEligible(text, primitive.value)) {
        body.push(satoTextCommand(text, primitive.value, dpi))
        continue
      }
    }
    if (primitive.kind === 'barcode') {
      const bar = primitive.object
      if (satoNativeBarcodeEligible(bar, primitive.value)) {
        const humanText = primitive.humanTextBitmap
        body.push(satoBarcodeCommand(bar, primitive.value, dpi, humanText))
        if (humanText) {
          body.push(satoBitmapCommand(humanText.originXMm ?? bar.x, humanText.originYMm ?? bar.y, dpi, primitive.labelIndex, `${primitive.object.id}-humantext`))
        } else if (bar.showText && bar.barcodeOptions?.humanPosition !== 'none') {
          pushProtocolWarning(warnings, 'sato-native-hri', `SATO 条码 ${bar.id} 的供人识读文字没有预渲染位图，已省略`, 'warning')
        }
        continue
      }
    }
    const bitmap = 'bitmap' in primitive ? primitive.bitmap : undefined
    if (!bitmap) {
      missing++
      continue
    }
    body.push(satoBitmapCommand(bitmap.originXMm ?? primitive.object.x, bitmap.originYMm ?? primitive.object.y, dpi, primitive.labelIndex, primitive.object.id))
  }
  if (missing > 0) {
    pushProtocolWarning(
      warnings,
      'sato-missing-bitmap',
      `SATO 页面 ${pageToken} 有 ${missing} 个图元缺少预渲染位图，已跳过；请确认打印预览/位图生成链路`,
      'error'
    )
  }
  body.push(`${ESC}Q${Math.max(1, scene.copy)}`)
  L.push(frame(body.join('')))
  return L.join('')
}
