// ---------- ESC/POS（热敏票据/标签机，Epson 兼容） ----------
import type { TextObj } from '../domain/objects'
import type { PrinterConfig } from '../domain/printer'
import type { MonoBitmap } from '../domain/units'
import { readableBarcodeText, validateBarcodeContent } from '../domain/barcodeCharset'
import type { ResolvedPrintScene } from './scene'
import { escposProfileFor, type EscPosProfile } from './escposProfiles'
import { pushProtocolWarning, type WarningTarget } from './warnings'

const ESC = '\x1b'
const GS = '\x1d'

const CODE_PAGE: Record<string, number> = {
  CP437: 0,
  CP850: 2,
  CP1252: 16,
  CP936: 255
}

const ONE_D_BARCODE: Record<string, number> = {
  upca: 65,
  upce: 66,
  ean13: 67,
  ean8: 68,
  code39: 69,
  itf14: 70,
  interleaved2of5: 70,
  code128: 73
}

type EscPosPart = string | Uint8Array

function commandBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (char) => char.charCodeAt(0))
}

export function escPos1DData(symbology: string, value: string): { mode: number; data: string } | null {
  const mode = ONE_D_BARCODE[symbology]
  if (!mode || !/^[\x20-\x7e]+$/.test(value)) return null
  if (symbology === 'upce') {
    // Seven legacy digits can mean six digits + check digit. Epson reads them
    // as number system + six digits. Keep the template meaning via raster.
    return /^(?:\d{6}|0\d{7})$/.test(value) ? { mode, data: value } : null
  }
  if (!validateBarcodeContent(symbology, value).ok) return null
  let data = readableBarcodeText(symbology, value)
  if (symbology === 'code128') data = '{B' + value.replace(/\{/g, '{{')
  if (symbology === 'code39') data = value.toUpperCase()
  if (data.length > 255 || mode === 70 && (!/^\d+$/.test(data) || data.length % 2 !== 0)) return null
  return { mode, data }
}

const TWO_D = new Set(['qrcode', 'pdf417', 'datamatrix'])

function qrNative(value: string): string {
  const data = value.slice(0, 7089)
  const storeLength = data.length + 3
  const pL = storeLength & 0xff
  const pH = (storeLength >> 8) & 0xff
  return [
    `${GS}(k\x04\x00\x31\x41\x32\x00`,
    `${GS}(k\x03\x00\x31\x43\x03`,
    `${GS}(k\x03\x00\x31\x45\x31`,
    `${GS}(k${String.fromCharCode(pL, pH)}\x31\x50\x30${data}`,
    `${GS}(k\x03\x00\x31\x51\x30`
  ].join('')
}

/**
 * PDF417/DataMatrix use the ESC/POS 2D store/print pair. Exact function codes
 * vary by firmware; the profile gates native use and the hardware matrix is
 * the final authority.
 */
function twoDNative(cn: number, value: string): string {
  const data = value.slice(0, 4096)
  const storeLength = data.length + 3
  const pL = storeLength & 0xff
  const pH = (storeLength >> 8) & 0xff
  return `${GS}(k${String.fromCharCode(pL, pH)}${String.fromCharCode(cn)}\x50\x30${data}${GS}(k\x03\x00${String.fromCharCode(cn)}\x51\x30`
}

function rasterCommand(mono: MonoBitmap, placeholder: string): EscPosPart[] {
  const xL = mono.bytesPerRow & 0xff
  const xH = (mono.bytesPerRow >> 8) & 0xff
  const yL = mono.height & 0xff
  const yH = (mono.height >> 8) & 0xff
  return [Uint8Array.of(0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH), placeholder]
}

function pagePlaceholder(index: number): string {
  return `@@PAGE_RAW:${index}@@`
}

function objectPlaceholder(labelIndex: number, objectId: string): string {
  return `@@RAW:${labelIndex}:${objectId}@@`
}

function styleCommands(text: TextObj, warnings: WarningTarget): string[] {
  const commands: string[] = []
  const align = text.align === 'center' ? 1 : text.align === 'right' ? 2 : 0
  commands.push(`${ESC}a${String.fromCharCode(align)}`)
  commands.push(`${ESC}E${String.fromCharCode(text.bold ? 1 : 0)}`)
  commands.push(`${ESC}-${String.fromCharCode(text.underline ? 1 : 0)}`)
  commands.push(`${GS}B${String.fromCharCode(text.reverse ? 1 : 0)}`)
  if (text.backgroundColor) pushProtocolWarning(warnings, 'escpos-background-color', 'ESC/POS 不支持文字背景色，已忽略', 'warning')
  return commands
}

function textCommand(primitive: Extract<ResolvedPrintScene['primitives'][number], { kind: 'text' }>, profile: EscPosProfile, warnings: WarningTarget): EscPosPart[] {
  if (primitive.bitmap) return rasterCommand(primitive.bitmap, objectPlaceholder(primitive.labelIndex, primitive.object.id))
  const nonAscii = /[^\x00-\x7F]/.test(primitive.value)
  const cjkPage = profile.codePages.some((page) => page === 'CP936' || page === 'CP932' || page === 'CP950' || page === 'CP949')
  if (nonAscii && !cjkPage) {
    pushProtocolWarning(warnings, 'escpos-non-ascii', `打印机档案 ${profile.id} 没有中日韩代码页，文本需要位图回退`, 'error')
    return []
  }
  return [commandBytes(styleCommands(primitive.object, warnings).join('')), primitive.value,
    commandBytes(`${ESC}a\x00${ESC}E\x00${ESC}-\x00${GS}B\x00`)]
}

function barcodeCommand(primitive: Extract<ResolvedPrintScene['primitives'][number], { kind: 'barcode' }>, profile: EscPosProfile, warnings: WarningTarget): EscPosPart[] {
  if (primitive.bitmap) return rasterCommand(primitive.bitmap, objectPlaceholder(primitive.labelIndex, primitive.object.id))
  const symbology = primitive.object.symbology.toLowerCase()
  if (TWO_D.has(symbology)) {
    // Layout printing uses a bitmap for 2D symbols. Keep the native compatibility
    // path for printable ASCII, for which character and wire byte counts agree.
    if (/^[\x20-\x7e]+$/.test(primitive.value)) {
      if (symbology === 'qrcode' && profile.supportsQR) return [commandBytes(qrNative(primitive.value))]
      if (symbology === 'pdf417' && profile.supportsPDF417) return [commandBytes(twoDNative(0x30, primitive.value))]
      if (symbology === 'datamatrix' && profile.supportsDataMatrix) return [commandBytes(twoDNative(0x32, primitive.value))]
    }
    pushProtocolWarning(warnings, 'escpos-2d-fallback', `${symbology} 在档案 ${profile.id} 中需要位图回退`, 'error')
    return []
  }
  const entry = escPos1DData(symbology, primitive.value)
  if (!entry || !profile.supports1D) {
    pushProtocolWarning(warnings, 'escpos-barcode-fallback', `${symbology} 在档案 ${profile.id} 中需要位图回退`, 'error')
    return []
  }
  return [commandBytes(`${GS}k${String.fromCharCode(entry.mode, entry.data.length)}${entry.data}`)]
}

export function buildEscPosParts(scene: ResolvedPrintScene, printer: PrinterConfig, warnings: WarningTarget, pageToken = String(Math.max(0, scene.labelIndex - 1))): EscPosPart[] {
  const profile = escposProfileFor(printer)
  const commands: EscPosPart[] = [commandBytes(`${ESC}@`)]
  const codePage = printer.escposCodePage ?? profile.defaultCodePage
  const codePageNumber = CODE_PAGE[codePage]
  if (codePageNumber !== undefined) commands.push(commandBytes(`${ESC}t${String.fromCharCode(codePageNumber)}`))

  if (scene.pageBitmap) {
    commands.push(...rasterCommand(scene.pageBitmap, pagePlaceholder(Number(pageToken))))
  }
  for (const primitive of scene.primitives) {
    if (scene.pageBitmap && primitive.kind !== 'rfid') continue
    switch (primitive.kind) {
      case 'rfid':
        throw new Error('ESC/POS 不支持 RFID 写入')
      case 'text':
        commands.push(...textCommand(primitive, profile, warnings))
        break
      case 'barcode':
        commands.push(...barcodeCommand(primitive, profile, warnings))
        break
      case 'image':
        if (primitive.bitmap) commands.push(...rasterCommand(primitive.bitmap, objectPlaceholder(primitive.labelIndex, primitive.object.id)))
        else pushProtocolWarning(warnings, 'escpos-missing-image', '图片缺少预渲染位图，ESC/POS 无法完整输出', 'error')
        break
      default: {
        const bitmap = 'bitmap' in primitive ? primitive.bitmap as MonoBitmap | undefined : undefined
        if (bitmap) commands.push(...rasterCommand(bitmap, objectPlaceholder(primitive.labelIndex, primitive.object.id)))
        else pushProtocolWarning(warnings, 'escpos-shape-fallback', `${primitive.kind} 需要位图回退`, 'error')
        break
      }
    }
  }

  const feed = printer.escposFeedLines ?? 0
  if (feed > 0) commands.push(commandBytes(`${ESC}d${String.fromCharCode(Math.max(0, Math.min(10, Math.floor(feed))))}`))
  if (printer.escposCut === 'full' || printer.escposCut === 'partial') {
    if (profile.supportsCut === 'none') pushProtocolWarning(warnings, 'escpos-cut-unsupported', '打印机档案不支持切纸，已忽略切纸命令', 'warning')
    else commands.push(commandBytes(`${GS}V${String.fromCharCode(printer.escposCut === 'partial' ? 1 : 0)}`))
  }
  if (printer.escposDrawer === 'pin2' || printer.escposDrawer === 'pin5') {
    if (!profile.supportsDrawer) pushProtocolWarning(warnings, 'escpos-drawer-unsupported', '打印机档案不支持钱箱，已忽略钱箱命令', 'warning')
    else commands.push(commandBytes(`${ESC}p${String.fromCharCode(printer.escposDrawer === 'pin5' ? 1 : 0)}\x19\xfa`))
  }
  return commands
}
