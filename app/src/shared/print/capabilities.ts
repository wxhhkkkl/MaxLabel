import type { PrinterConfig } from '../domain/printer'
import type { BarcodeObj, LineObj, RectObj, TableObj, TextObj } from '../domain/objects'
import type { ResolvedPrintScene } from './scene'

export interface PrinterCapabilities {
  driver: PrinterConfig['driver']
  profile: string
  coordinateDpi: number
  nativeBarcodes: ReadonlySet<string>
  supportsBitmap: boolean
  supportsEllipse: boolean
  supportsRfid: boolean
  supportsTable: boolean
  supportsRotation: boolean
  supportsNativeChinese: boolean
  maxCopies: number
}

const TSPL_NATIVE_BARCODES = new Set(['code128', 'ean13', 'ean8', 'upca', 'upce', 'code39', 'code93', 'itf14', 'interleaved2of5', 'codabar', 'qrcode', 'datamatrix', 'pdf417'])
const ZPL_NATIVE_BARCODES = new Set(['code128', 'ean13', 'ean8', 'upca', 'upce', 'code39', 'code93', 'itf14', 'interleaved2of5', 'codabar', 'qrcode', 'datamatrix', 'pdf417'])
const CPCL_NATIVE_BARCODES = new Set(['code128', 'ean13', 'ean8', 'upca', 'upce', 'code39', 'code93', 'itf14', 'interleaved2of5', 'codabar', 'qrcode', 'datamatrix', 'pdf417'])

/** Central capability profile; brand-specific quirks belong in future profiles, not UI branches. */
export function printerCapabilities(printer: PrinterConfig): PrinterCapabilities {
  if (printer.driver === 'cpcl') {
    return { driver: 'cpcl', profile: printer.profile ?? 'generic', coordinateDpi: 200, nativeBarcodes: CPCL_NATIVE_BARCODES, supportsBitmap: true, supportsEllipse: false, supportsRfid: false, supportsTable: true, supportsRotation: false, supportsNativeChinese: false, maxCopies: 9999 }
  }
  if (printer.driver === 'zpl') {
    return { driver: 'zpl', profile: printer.profile ?? 'generic', coordinateDpi: printer.dpi, nativeBarcodes: ZPL_NATIVE_BARCODES, supportsBitmap: true, supportsEllipse: false, supportsRfid: true, supportsTable: true, supportsRotation: true, supportsNativeChinese: false, maxCopies: 99999 }
  }
  return { driver: 'tspl', profile: printer.profile ?? 'generic', coordinateDpi: printer.dpi, nativeBarcodes: TSPL_NATIVE_BARCODES, supportsBitmap: true, supportsEllipse: false, supportsRfid: true, supportsTable: true, supportsRotation: true, supportsNativeChinese: false, maxCopies: 99999 }
}

function rightAngle(value: number): boolean {
  const normalized = ((value % 360) + 360) % 360
  return Math.abs(normalized % 90) < 0.001
}

function hasRotation(value: number): boolean {
  return Math.abs(((value % 360) + 360) % 360) > 0.001
}

function isBlack(value: string): boolean {
  const color = value.trim().toLowerCase()
  return color === '#000' || color === '#000000' || color === 'black' || color === 'rgb(0,0,0)'
}

function isPaperFill(value: string): boolean {
  const color = value.trim().toLowerCase()
  return color === 'transparent' || color === '#fff' || color === '#ffffff' || color === 'white'
}

function hasDynamicColor(object: unknown): boolean {
  if (!object || typeof object !== 'object') return false
  const colorChange = (object as { colorChange?: { mode?: string } }).colorChange
  return colorChange?.mode !== undefined && colorChange.mode !== 'fixed'
}

function hasUnsupportedBarcodeOptions(object: BarcodeObj, printer: PrinterConfig): boolean {
  const options = object.barcodeOptions
  if (!options) return false
  const allowed = new Set(['xSizeMm', 'w2n'])
  if (object.symbology === 'qrcode' || object.symbology === 'datamatrix' || object.symbology === 'pdf417') allowed.add('eclevel')
  if (printer.driver === 'zpl' && object.symbology === 'pdf417') allowed.add('truncated')
  return Object.keys(options).some((key) => !allowed.has(key))
}

/** Built-in printer fonts intentionally opt out of browser font metrics. */
export function sceneNeedsNativeFontRasterization(scene: ResolvedPrintScene): boolean {
  return scene.primitives.some((primitive) => primitive.kind === 'text' && Boolean((primitive.object as TextObj).fontFamily) && !(primitive.object as TextObj).printerFont)
}

/**
 * Native commands intentionally cover only primitives whose visual semantics are
 * portable between printer firmwares.  Returning true here makes the renderer
 * produce one exact page bitmap instead of silently dropping styles or transforms.
 */
export function sceneNeedsRasterization(scene: ResolvedPrintScene, printer: PrinterConfig): boolean {
  const capabilities = printerCapabilities(printer)
  if (scene.labelShape && scene.labelShape !== 'rect') return true
  for (const primitive of scene.primitives) {
    const object = primitive.object
    if (object.flipX || object.flipY) return true
    if ((primitive.kind === 'text' || primitive.kind === 'barcode') && /[\u0000-\u001f\u007f]/.test(primitive.value)) return true
    if ((primitive.kind === 'text' || primitive.kind === 'rect' || primitive.kind === 'ellipse') && hasDynamicColor(object)) return true
    if (primitive.kind === 'text' && /[^\x00-\x7F]/.test(primitive.value) && hasRotation(object.rotation)) return true
    if (hasRotation(object.rotation) && !capabilities.supportsRotation) return true
    if (primitive.kind === 'ellipse' && !capabilities.supportsEllipse) return true
    if (primitive.kind === 'image' && !capabilities.supportsBitmap) return true
    if (primitive.kind === 'table' && !capabilities.supportsTable) return true
    if (primitive.kind === 'rfid' && !capabilities.supportsRfid) return true
    if ((primitive.kind === 'rect' || primitive.kind === 'line' || primitive.kind === 'table' || primitive.kind === 'image') && Math.abs(object.rotation) > 0.001) return true
    if (primitive.kind === 'rect') {
      const rect = primitive.object as RectObj
      if (!isPaperFill(rect.fill) || !isBlack(rect.stroke)) return true
    }
    if (primitive.kind === 'line' && !isBlack((primitive.object as LineObj).stroke)) return true
    if (primitive.kind === 'table' && !isBlack((primitive.object as TableObj).borderColor)) return true
    if (primitive.kind === 'barcode' && (!capabilities.nativeBarcodes.has(primitive.object.symbology.toLowerCase()) || !rightAngle(object.rotation) || (printer.driver === 'cpcl' && [180, 270].includes(((Math.round(object.rotation / 90) % 4) + 4) % 4 * 90)))) return true
    if (primitive.kind === 'barcode' && hasUnsupportedBarcodeOptions(primitive.object, printer)) return true
    if (primitive.kind === 'text') {
      const text = primitive.object as TextObj
      if (!rightAngle(object.rotation)) return true
      if (!isBlack(text.color)) return true
      if (text.printerFont) {
        const validFont = printer.driver === 'tspl'
          ? /^Font[0-8]$/i.test(text.printerFont)
          : printer.driver === 'zpl'
            ? /^[A-Z0]$/i.test(text.printerFont)
            : false
        if (!validFont) return true
      }
      if (text.bold || text.italic || text.underline || text.strikeout || text.reverse || text.backgroundColor) return true
      if (text.align === 'justify' || text.verticalAlign === 'middle' || text.verticalAlign === 'bottom') return true
      if (text.lineSpacing !== undefined || text.arc || text.textType === 'circle') return true
    }
  }
  return false
}
