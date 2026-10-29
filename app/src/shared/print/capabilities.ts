import type { PrinterConfig } from '../domain/printer'
import { TWO_DIMENSIONAL_SYMBOLOGIES, type BarcodeObj, type LabelObject, type LineObj, type RectObj, type TableObj, type TextObj } from '../domain/objects'
import type { ResolvedPrintPrimitive, ResolvedPrintScene } from './scene'
import { rotatedObjectBounds } from './bounds'
import { escposProfileFor } from './escposProfiles'

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
  if (printer.driver === 'escpos') {
    const profile = escposProfileFor(printer)
    const barcodes = new Set<string>()
    if (profile.supports1D) {
      for (const symbology of ['code128', 'ean13', 'ean8', 'upca', 'upce', 'code39', 'itf14', 'interleaved2of5']) barcodes.add(symbology)
    }
    if (profile.supportsQR) barcodes.add('qrcode')
    if (profile.supportsPDF417) barcodes.add('pdf417')
    if (profile.supportsDataMatrix) barcodes.add('datamatrix')
    return { driver: 'escpos', profile: profile.id, coordinateDpi: printer.dpi, nativeBarcodes: barcodes, supportsBitmap: true, supportsEllipse: false, supportsRfid: false, supportsTable: false, supportsRotation: false, supportsNativeChinese: profile.codePages.some((page) => page === 'CP936' || page === 'CP932' || page === 'CP950' || page === 'CP949'), maxCopies: 99999 }
  }
  if (printer.driver === 'cpcl') {
    return { driver: 'cpcl', profile: printer.profile ?? 'generic', coordinateDpi: 200, nativeBarcodes: CPCL_NATIVE_BARCODES, supportsBitmap: true, supportsEllipse: false, supportsRfid: false, supportsTable: true, supportsRotation: false, supportsNativeChinese: false, maxCopies: 9999 }
  }
  if (printer.driver === 'zpl') {
    return { driver: 'zpl', profile: printer.profile ?? 'generic', coordinateDpi: printer.dpi, nativeBarcodes: ZPL_NATIVE_BARCODES, supportsBitmap: true, supportsEllipse: false, supportsRfid: true, supportsTable: true, supportsRotation: true, supportsNativeChinese: false, maxCopies: 99999 }
  }
  return { driver: 'tspl', profile: printer.profile ?? 'generic', coordinateDpi: printer.dpi, nativeBarcodes: TSPL_NATIVE_BARCODES, supportsBitmap: true, supportsEllipse: false, supportsRfid: true, supportsTable: true, supportsRotation: true, supportsNativeChinese: false, maxCopies: 99999 }
}

/** 帮助原文（getstart_color.html 特别说明）。 */
export const VARIABLE_COLOR_JUDGE_NOTE = 'MaxLabel 会根据打印机自动判断是否支持可变颜色打印（彩色打印）'
/** 帮助原文（getstart_color.html 特别说明）。 */
export const VARIABLE_COLOR_UNSUPPORTED_NOTE = '普通条码标签打印机无法选择彩色打印'

/**
 * 帮助 getstart_color.html：内置驱动 会根据打印机自动判断是否支持可变颜色打印。
 * 复刻版判据：经 Windows 打印机驱动输出时，目标机型可能是平张页式的激光/喷墨打印机，
 * 具备彩色输出能力；其余端口（USB / TCP-IP / COM / LPT / 蓝牙 / 文件）都是指令集直接
 * 驱动的卷筒式条码标签打印机，按帮助「普通条码标签打印机无法选择彩色打印」处理。
 */
export function printerSupportsVariableColor(printer: PrinterConfig | undefined): boolean {
  if (!printer) return true
  return printer.port?.type === 'driver'
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

/** 条码选项里「指令输出不读、但默认值与指令行为一致」的键：只有偏离默认值才算不支持。 */
const NATIVE_BARCODE_OPTION_DEFAULTS: Record<string, unknown> = {
  humanPosition: 'below',
  humanAlign: 'center',
  humanOffsetMm: 0
}

function hasUnsupportedBarcodeOptions(object: BarcodeObj, printer: PrinterConfig): boolean {
  const options = object.barcodeOptions
  if (!options) return false
  // xSizeMil 只是 UI 的密耳表示，指令输出一律用 xSizeMm。
  const allowed = new Set(['xSizeMm', 'xSizeMil', 'w2n'])
  if (object.symbology === 'qrcode' || object.symbology === 'datamatrix' || object.symbology === 'pdf417') allowed.add('eclevel')
  if (printer.driver === 'zpl' && object.symbology === 'pdf417') allowed.add('truncated')
  return Object.entries(options).some(([key, value]) =>
    !allowed.has(key) && !(key in NATIVE_BARCODE_OPTION_DEFAULTS && NATIVE_BARCODE_OPTION_DEFAULTS[key] === value)
  )
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
/** 条码供人识读文字的默认样式，与 `createLabelObject('barcode')` 的新建默认值一致。 */
const DEFAULT_BARCODE_TEXT_FONT = 'Arial'
const DEFAULT_BARCODE_TEXT_SIZE_MM = (8 * 25.4) / 72

/**
 * 条码的可读文字是否被**改过**字体样式。
 *
 * 新建条码总会带上 Arial / 8pt / 缩放 1 / 字间距 0 —— 那是编辑器自己的默认值，
 * 不能算「自定义」。只有偏离这些默认值的样式才需要整页位图来保证所见即所得。
 */
function barcodeHasCustomTextStyle(bar: BarcodeObj): boolean {
  if (bar.showText !== true || bar.barcodeOptions?.humanPosition === 'none') return false
  return (bar.fontFamily ?? DEFAULT_BARCODE_TEXT_FONT) !== DEFAULT_BARCODE_TEXT_FONT ||
    Math.abs((bar.fontSize ?? DEFAULT_BARCODE_TEXT_SIZE_MM) - DEFAULT_BARCODE_TEXT_SIZE_MM) > 0.001 ||
    (bar.fontWidthScale ?? 1) !== 1 ||
    (bar.charSpacing ?? 0) !== 0 ||
    bar.bold === true || bar.italic === true || bar.underline === true || bar.strikeout === true || bar.reverse === true
}

/**
 * 文本能否单独裁成对象位图。
 * 弧形/圆形文字虽然由整组单字拼成，但可以按 fabric 量出的真实包围盒裁图（见 bitmapSource）。
 */
export function textIsolatable(_text: TextObj): boolean {
  return true
}

/**
 * 这段文本是否必须走位图（原生 TEXT 指令会丢字形或样式）。
 * 任何一条成立都不该交给原生文本指令：
 * 浏览器字体 / 非法内建字库 / 非黑颜色 / 非 90° 旋转 / 原生不支持的样式 /
 * 两端对齐或非顶部垂直对齐 / 行距 / 控制字符 / 动态颜色 / 翻转 / 中文没有原生字库。
 */
export function textNeedsBitmap(text: TextObj, value: string, printer: PrinterConfig): boolean {
  if (!textIsolatable(text)) return true
  if (/[\u0000-\u001f\u007f]/.test(value)) return true
  if (hasDynamicColor(text)) return true
  if (text.flipX || text.flipY) return true
  // 浏览器字体 / 中文没有原生字库：这是「字体」原因，位图才能保住字形。
  if (text.fontFamily && !text.printerFont) return true
  if (/[^\x00-\x7F]/.test(value) && !printerCapabilities(printer).supportsNativeChinese) return true
  return textStyleNeedsRaster(text, printer)
}

/** 文本的样式/几何是否原生指令无法还原（不含「浏览器字体」与「中文」两条字体原因）。 */
function textStyleNeedsRaster(text: TextObj, printer: PrinterConfig): boolean {
  if (!rightAngle(text.rotation)) return true
  if (hasRotation(text.rotation) && !printerCapabilities(printer).supportsRotation) return true
  if (!isBlack(text.color)) return true
  if (text.printerFont) {
    const validFont = printer.driver === 'tspl'
      ? /^Font[0-8]$/i.test(text.printerFont)
      : printer.driver === 'zpl'
        ? /^[A-Z0]$/i.test(text.printerFont)
        : false
    if (!validFont) return true
  }
  const escposStyles = printer.driver === 'escpos' && (text.bold || text.underline || text.reverse)
  if ((!escposStyles && (text.bold || text.underline || text.reverse)) || text.italic || text.strikeout || text.backgroundColor) return true
  if (text.align === 'justify' || text.verticalAlign === 'middle' || text.verticalAlign === 'bottom') return true
  if (text.lineSpacing !== undefined && printer.driver !== 'escpos') return true
  if (text.arc || text.textType === 'circle') return true
  return false
}

/** 单个图元是否不能用原生指令还原（需要位图）。文本这里保持旧口径：不含浏览器字体原因。 */
export function primitiveNeedsRasterization(primitive: ResolvedPrintPrimitive, printer: PrinterConfig): boolean {
  const capabilities = printerCapabilities(printer)
  const object = primitive.object
  if (primitive.kind === 'text') {
    const text = primitive.object as TextObj
    return /[\u0000-\u001f\u007f]/.test(primitive.value) || hasDynamicColor(text) || text.flipX === true || text.flipY === true || textStyleNeedsRaster(text, printer)
  }
  if (primitive.kind === 'barcode' && barcodeHasCustomTextStyle(primitive.object as BarcodeObj)) return true
  // 二维码：原生 QRCODE/DMATRIX 指令既不按对象框定尺寸，也不会画供人识读文字 → 用对象位图，
  // 保证打印和画布完全一致（尺寸、人读内容都在）。
  if (primitive.kind === 'barcode' && TWO_DIMENSIONAL_SYMBOLOGIES.has((primitive.object as BarcodeObj).symbology)) return true
  // CodaBar 隐藏起始符/终止符只影响“供人识读文字”，原生指令的文字由打印机按数据生成 → 退回对象位图。
  if (primitive.kind === 'barcode') {
    const bar = primitive.object as BarcodeObj
    if (bar.symbology === 'codabar' && bar.showText === true && bar.barcodeOptions?.codabarShowStartStop === false) return true
  }
  if (object.flipX || object.flipY) return true
  if (primitive.kind === 'barcode' && /[\u0000-\u001f\u007f]/.test(primitive.value)) return true
  if ((primitive.kind === 'rect' || primitive.kind === 'ellipse' || primitive.kind === 'barcode' || primitive.kind === 'line') && hasDynamicColor(object)) return true
  if (printer.driver === 'tspl' && primitive.kind === 'line') {
    const line = primitive.object as LineObj
    if (Math.abs(line.w) > 0.001 && Math.abs(line.h) > 0.001) return true
  }
  if (hasRotation(object.rotation) && !capabilities.supportsRotation) return true
  if (primitive.kind === 'ellipse' && !capabilities.supportsEllipse) return true
  if (printer.driver === 'escpos' && (primitive.kind === 'rect' || primitive.kind === 'line')) return true
  if (primitive.kind === 'image' && !capabilities.supportsBitmap) return true
  if (primitive.kind === 'table' && !capabilities.supportsTable) return true
  if (primitive.kind === 'rfid' && !capabilities.supportsRfid) return true
  if ((primitive.kind === 'rect' || primitive.kind === 'line' || primitive.kind === 'table' || primitive.kind === 'image') && Math.abs(object.rotation) > 0.001) return true
  if (primitive.kind === 'rect') {
    const rect = primitive.object as RectObj
    // 原生 BOX/^GB 只有直角：圆角矩形和椭圆必须用位图，否则形状画不出来。
    if (rect.shape === 'roundRect' || rect.shape === 'ellipse') return true
    if (!isPaperFill(rect.fill) || !isBlack(rect.stroke)) return true
  }
  if (primitive.kind === 'line' && !isBlack((primitive.object as LineObj).stroke)) return true
  if (primitive.kind === 'table' && !isBlack((primitive.object as TableObj).borderColor)) return true
  if (primitive.kind === 'barcode' && (!capabilities.nativeBarcodes.has(primitive.object.symbology.toLowerCase()) || !rightAngle(object.rotation) || (printer.driver === 'cpcl' && [180, 270].includes(((Math.round(object.rotation / 90) % 4) + 4) % 4 * 90)))) return true
  if (primitive.kind === 'barcode' && hasUnsupportedBarcodeOptions(primitive.object, printer)) return true
  return false
}

export function sceneNeedsRasterization(scene: ResolvedPrintScene, printer: PrinterConfig): boolean {
  if ((scene.paperGeometry?.innerDiameterMm ?? 0) > 0) return true
  return scene.primitives.some((primitive) => primitiveNeedsRasterization(primitive, printer))
}

/**
 * 图元能否单独裁成对象位图。
 *
 * - 弧形/圆形文字依赖整组布局；
 * - RFID 是写入指令，位图替代不了；
 * - ESC/POS 的栅格是顺序输出、没有坐标定位，非文本图元只能整页。
 */
export function primitiveIsolatable(primitive: ResolvedPrintPrimitive, printer: PrinterConfig): boolean {
  if (primitive.kind === 'rfid') return false
  if (primitive.kind === 'text') return textIsolatable(primitive.object as TextObj)
  return printer.driver !== 'escpos'
}

/** 这个图元最终会不会走对象位图（决定它是否受可打印区域裁剪约束）。 */
function plannedAsBitmap(primitive: ResolvedPrintPrimitive, printer: PrinterConfig): boolean {
  if (primitive.kind === 'rfid') return false
  if (!primitiveIsolatable(primitive, printer)) return false
  return primitive.kind === 'text'
    ? textNeedsBitmap(primitive.object as TextObj, primitive.value, printer)
    : primitiveNeedsRasterization(primitive, printer)
}

/**
 * 对象是否完整落在「可打印区域」内（带内径的光盘：外圆内、且不压住中心孔）。
 * 原生指令没有裁剪能力，只有对象位图能被遮罩裁掉；越界的原生图元只能整页位图。
 */
function insidePrintableArea(scene: ResolvedPrintScene, object: LabelObject): boolean {
  const geometry = scene.paperGeometry
  const hole = geometry?.innerDiameterMm ?? 0
  if (hole <= 0) return true
  const box = rotatedObjectBounds({ x: object.x, y: object.y, w: object.w, h: object.h, rotation: object.rotation }, 0)
  const cx = scene.widthMm / 2
  const cy = scene.heightMm / 2
  const points: Array<[number, number]> = [
    [box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h],
    [box.x + box.w / 2, box.y], [box.x + box.w / 2, box.y + box.h], [box.x, box.y + box.h / 2], [box.x + box.w, box.y + box.h / 2]
  ]
  if (geometry?.shape === 'ellipse') {
    const a = scene.widthMm / 2
    const b = scene.heightMm / 2
    if (a <= 0 || b <= 0) return false
    if (!points.every(([x, y]) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 <= 1 + 1e-6)) return false
  }
  const nearX = Math.max(box.x, Math.min(cx, box.x + box.w))
  const nearY = Math.max(box.y, Math.min(cy, box.y + box.h))
  return Math.hypot(nearX - cx, nearY - cy) > hole / 2
}

/**
 * 场景是否**只能**整页位图。
 *
 * 除弧形/圆形文字、RFID、ESC/POS 的非文本图元外，所有「原生还原不了」的图元
 * （旋转/斜线/椭圆/不支持的码制…）都只把自己转成对象位图，不再拖累其它图元。
 */
export function sceneNeedsPageBitmap(scene: ResolvedPrintScene, printer: PrinterConfig): boolean {
  const needsPageForIsolation = scene.primitives.some((primitive) =>
    primitiveNeedsRasterization(primitive, printer) && !primitiveIsolatable(primitive, printer)
  )
  if (needsPageForIsolation) return true
  // 带内径的光盘：原生图元越出可打印区域时无法裁剪，退回整页位图。
  if ((scene.paperGeometry?.innerDiameterMm ?? 0) > 0) {
    return scene.primitives.some((primitive) => !plannedAsBitmap(primitive, printer) && !insidePrintableArea(scene, primitive.object))
  }
  return false
}

export interface PrintModeHint {
  /**
   * native = 全部原生指令；mixed = 指令直连 + 个别元素单独位图；
   * raster = 只能整页位图；driver = Windows 驱动打印；file = 输出指令文件。
   */
  mode: 'native' | 'mixed' | 'raster' | 'driver' | 'file'
  /** 走位图的原因（native / mixed / driver / file 时为 null）。 */
  reason: string | null
}

/**
 * 供界面展示的「当前打印方式 + 原因」。
 *
 * 判定与 `sceneNeedsRasterization` 共用同一批条件，这里只是把最常见的触发点
 * 翻译成人话；顺序与真正打印时的判定一致，保证提示和实际行为不打架。
 */
export function printModeHint(scene: ResolvedPrintScene, printer: PrinterConfig): PrintModeHint {
  // 端口类型先决定走哪条链路，跟版面能否用指令还原无关：
  // 驱动端口由 Chromium 交给 Windows 驱动（会弹系统打印对话框），文件端口写指令文件（会弹保存对话框）。
  if (printer.port.type === 'driver') return { mode: 'driver', reason: null }
  if (printer.port.type === 'file') return { mode: 'file', reason: null }
  if (!sceneNeedsRasterization(scene, printer)) return { mode: 'native', reason: null }
  // 只有整页位图才是「清晰度较低」；个别元素走对象位图时其余仍是原生指令。
  if (!sceneNeedsPageBitmap(scene, printer)) return { mode: 'mixed', reason: null }
  const capabilities = printerCapabilities(printer)
  if ((scene.paperGeometry?.innerDiameterMm ?? 0) > 0) return { mode: 'raster', reason: '标签带内径' }
  for (const primitive of scene.primitives) {
    const object = primitive.object
    const bar = primitive.kind === 'barcode' ? (object as BarcodeObj) : null
    if (bar && barcodeHasCustomTextStyle(bar)) {
      return { mode: 'raster', reason: '条码的可读文字用了自定义字体样式' }
    }
    if (object.flipX || object.flipY) return { mode: 'raster', reason: '对象被翻转' }
    if ((primitive.kind === 'text' || primitive.kind === 'rect' || primitive.kind === 'ellipse' || primitive.kind === 'barcode' || primitive.kind === 'line') && hasDynamicColor(object)) {
      return { mode: 'raster', reason: '对象使用了动态/渐变颜色' }
    }
    if (primitive.kind === 'text') {
      const text = primitive.object as TextObj
      if (!isBlack(text.color)) return { mode: 'raster', reason: '文字不是黑色' }
      if (text.printerFont) {
        const validFont = printer.driver === 'tspl' ? /^Font[0-8]$/i.test(text.printerFont) : printer.driver === 'zpl' ? /^[A-Z0]$/i.test(text.printerFont) : false
        if (!validFont) return { mode: 'raster', reason: `打印机字体「${text.printerFont}」当前驱动不支持` }
      }
      if (!rightAngle(object.rotation)) return { mode: 'raster', reason: '文字有非 90° 的旋转' }
      if (text.italic || text.strikeout || text.backgroundColor) return { mode: 'raster', reason: '文字带打印机不支持的样式' }
      if (printer.driver !== 'escpos' && (text.bold || text.underline || text.reverse)) return { mode: 'raster', reason: '文字带打印机不支持的样式' }
    }
    if (primitive.kind === 'barcode' && (!capabilities.nativeBarcodes.has((object as BarcodeObj).symbology.toLowerCase()) || !rightAngle(object.rotation))) {
      return { mode: 'raster', reason: '该码制或旋转角度打印机不支持原生绘制' }
    }
    if (primitive.kind === 'image' && !capabilities.supportsBitmap) return { mode: 'raster', reason: '打印机不支持位图' }
  }
  return { mode: 'raster', reason: '当前驱动无法用指令还原版面' }
}
