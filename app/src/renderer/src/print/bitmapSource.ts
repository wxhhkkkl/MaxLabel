// ---------- 渲染层位图预处理（浏览器 Canvas，指令打印嵌入图片/中文用） ----------
// 将图片 dataURL 或文本渲染为打印机点阵单色位图（1=黑），供 TSPL PUTBMP / ZPL ^GFA 嵌入。
import { PX_PER_MM, type DataCtx, type ImageObj, type LabelDoc, type LabelObject, type MonoBitmap, type PrinterConfig, type TextObj } from '../types'
import { alignedSymbolLeftMm, makeObject, resolveImageSource } from '../rendering/fabricObjects'
import { TWO_DIMENSIONAL_SYMBOLOGIES, type BarcodeObj } from '../../../shared/domain/objects'
import { renderBarcodeCanvasAtDpi } from '../editor/barcode'
import { renderLabel } from './renderLabel'
import { GDI_RENDER_FALLBACK, nativeTextPrintEnabled, nativeTextPrintRequested, rasterizeTextMonoForPrint } from './nativeText'
import { isSmallPrintText, nativeTextAppliesSmall } from '../../../shared/print/nativeText'
import { attachSceneBitmaps, attachSceneHumanTextBitmaps, attachScenePageBitmap, isPrimitiveFullyWithinLabel, materializeScenePrimitive, type ResolvedPrintJob, type ResolvedPrintPrimitive, type ResolvedPrintScene, type SceneHumanTextBitmap } from '../../../shared/print/scene'
import { primitiveIsolatable, primitiveNeedsRasterization, printerCapabilities, sceneHasRepeatedObjectInstances, sceneNeedsPageBitmap, textNeedsBitmap } from '../../../shared/print/capabilities'
import { centeredObjectBounds, rotatedObjectBounds } from '../../../shared/print/bounds'
import { paperPath } from '../../../shared/domain/paper'

const bitmapCache = new Map<string, MonoBitmap>()
const bitmapWarnings = new WeakMap<MonoBitmap, string[]>()
let bitmapCacheBytes = 0
const MAX_BITMAP_CACHE_BYTES = 64 * 1024 * 1024

function cachedBitmap(key: string): MonoBitmap | undefined {
  const value = bitmapCache.get(key)
  if (value) {
    bitmapCache.delete(key)
    bitmapCache.set(key, value)
  }
  return value
}

function cacheBitmap(key: string, value: MonoBitmap): MonoBitmap {
  const previous = bitmapCache.get(key)
  if (previous) bitmapCacheBytes -= previous.bytes.byteLength
  if (value.bytes.byteLength > MAX_BITMAP_CACHE_BYTES) {
    bitmapCache.delete(key)
    return value
  }
  bitmapCache.set(key, value)
  bitmapCacheBytes += value.bytes.byteLength
  while (bitmapCacheBytes > MAX_BITMAP_CACHE_BYTES && bitmapCache.size > 1) {
    const first = bitmapCache.keys().next().value as string
    const evicted = bitmapCache.get(first)
    bitmapCache.delete(first)
    bitmapCacheBytes -= evicted?.bytes.byteLength ?? 0
  }
  return value
}

async function getPrintBitmap(
  key: string,
  render: (report: (message: string) => void) => Promise<MonoBitmap>,
  onQualityWarning?: (message: string) => void
): Promise<MonoBitmap> {
  let bitmap = cachedBitmap(key)
  if (!bitmap) {
    const warnings = new Set<string>()
    bitmap = await render((message) => warnings.add(message))
    if (warnings.size) bitmapWarnings.set(bitmap, [...warnings])
    if (!warnings.has(GDI_RENDER_FALLBACK)) cacheBitmap(key, bitmap)
  }
  if (onQualityWarning) bitmapWarnings.get(bitmap)?.forEach(onQualityWarning)
  return bitmap
}

/** FNV-1a 增量哈希：位图缓存 key 只需要一个短的确定性指纹。 */
function hashValues(values: unknown[]): string {
  let hash = 1469598103934665603n
  const mask = 0xffffffffffffffffn
  const add = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= BigInt(value.charCodeAt(index))
      hash = (hash * 1099511628211n) & mask
    }
  }
  const addValue = (value: unknown): void => {
    if (Array.isArray(value)) {
      add('['); for (const item of value) addValue(item); add(']')
    } else if (value !== null && typeof value === 'object') {
      add('{')
      for (const key of Object.keys(value).sort()) { addValue(key); addValue((value as Record<string, unknown>)[key]) }
      add('}')
    } else {
      const text = String(value)
      add(`${typeof value}:${text.length}:`); add(text)
    }
  }
  addValue(values)
  return hash.toString(16)
}

function sceneFingerprint(scene: ResolvedPrintScene): string {
  const primitives = scene.primitives.flatMap((primitive) => [
    [primitive.labelIndex, primitive.context],
    [primitive.kind, primitive.object],
    'value' in primitive ? primitive.value : undefined,
    'sourceValue' in primitive ? primitive.sourceValue : undefined
  ])
  return hashValues([scene.labelShape, scene.paperGeometry, scene.labelCells, scene.colorIndexTable, scene.labelIndex, scene.copy, primitives])
}

/** 对象位图的缓存指纹：对象本身 + 解析后的值 + 渲染上下文（动态颜色依赖它）。 */
function primitiveFingerprint(primitive: ResolvedPrintPrimitive): string {
  return hashValues([
    primitive.kind,
    primitive.object,
    'value' in primitive ? primitive.value : undefined,
    'sourceValue' in primitive ? primitive.sourceValue : undefined,
    primitive.context
  ])
}

function monoFromImageData(img: ImageData): MonoBitmap {
  const width = img.width
  const height = img.height
  const bytesPerRow = Math.ceil(width / 8)
  const bytes = new Uint8Array(bytesPerRow * height)
  const d = img.data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const alpha = d[i + 3] / 255
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * alpha + 255 * (1 - alpha)
      if (lum < 128) {
        bytes[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }
  return { width, height, bytesPerRow, bytes }
}

/** 位图四周留的余量（毫米）：描边与抗锯齿不应该被裁掉。 */
const BITMAP_PADDING_MM = 0.4

/**
 * 把对象位图裁到标签/纸张范围。单标签里越界的对象改为「对象位图 + 裁剪」后，
 * 不再需要整页位图；负坐标 BITMAP 也不会发给打印机。
 */
export function clipMonoBitmap(
  bitmap: MonoBitmap,
  rect: { x: number; y: number; w: number; h: number },
  dpi: number
): MonoBitmap {
  const dpm = dpi / 25.4
  const ox = bitmap.originXMm ?? 0
  const oy = bitmap.originYMm ?? 0
  const left = Math.max(0, Math.round((rect.x - ox) * dpm))
  const top = Math.max(0, Math.round((rect.y - oy) * dpm))
  const right = Math.min(bitmap.width, Math.round((rect.x + rect.w - ox) * dpm))
  const bottom = Math.min(bitmap.height, Math.round((rect.y + rect.h - oy) * dpm))
  if (right - left < 1 || bottom - top < 1) {
    return { width: 1, height: 1, bytesPerRow: 1, bytes: new Uint8Array([0]),
      originXMm: rect.x, originYMm: rect.y, ...(bitmap.opaque ? { opaque: true } : {}) }
  }
  const width = right - left
  const height = bottom - top
  const bytesPerRow = Math.ceil(width / 8)
  const bytes = new Uint8Array(bytesPerRow * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sx = left + x
      const sy = top + y
      if (bitmap.bytes[sy * bitmap.bytesPerRow + (sx >> 3)] & (0x80 >> (sx & 7))) {
        bytes[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }
  return {
    width, height, bytesPerRow, bytes,
    originXMm: ox + left / dpm,
    originYMm: oy + top / dpm,
    ...(bitmap.opaque ? { opaque: true } : {})
  }
}

/** 对象在画布上的真实包围盒（弧/圆文字、溢出对象框的一维码都要实测，不能用 w/h 推）。 */
async function measuredObjectBoundsMm(object: LabelObject, paddingMm: number, ctx?: DataCtx): Promise<{ x: number; y: number; w: number; h: number }> {
  try {
    // 与打印位图同一条渲染通路（矢量片段按画布绘制），否则量到的宽度和实际画出来的
    // 宽度可能差一两个像素。
    const fabricObject = await makeObject(object, PX_PER_MM, { ctx, vectorBarcodes: 'canvas' } as never)
    if (fabricObject) {
      fabricObject.setCoords()
      const rect = fabricObject.getBoundingRect()
      if (Number.isFinite(rect.width) && Number.isFinite(rect.height) && rect.width > 0 && rect.height > 0) {
        return {
          x: rect.left / PX_PER_MM - paddingMm,
          y: rect.top / PX_PER_MM - paddingMm,
          w: rect.width / PX_PER_MM + paddingMm * 2,
          h: rect.height / PX_PER_MM + paddingMm * 2
        }
      }
    }
  } catch {
    // 量不出来就按对象框处理，至少不会裁掉整个对象。
  }
  return rotatedObjectBounds(object, paddingMm)
}

/**
 * 按纸型把「可打印区域」之外的点涂白。
 * 带内径的光盘：外圆内、中心孔外；圆角标签：圆角之外。
 * 对象位图是唯一能被裁剪的形式（原生指令没有裁剪），所以遮罩加在这里。
 */
function applyPrintableMask(
  canvas: HTMLCanvasElement,
  bounds: { x: number; y: number; w: number; h: number },
  dpi: number,
  scene: ResolvedPrintScene | undefined
): void {
  const geometry = scene?.paperGeometry
  if (!scene || !geometry) return
  const hasHole = (geometry.innerDiameterMm ?? 0) > 0
  const joint = geometry.jointWidthMm ?? 0
  if ((!geometry.shape || geometry.shape === 'rect') && !hasHole && joint <= 0) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const px = (mm: number) => (mm * dpi) / 25.4
  const path = new Path2D()
  path.rect(0, 0, canvas.width, canvas.height)
  const cells = scene.labelCells ?? [{ x: 0, y: 0, widthMm: scene.widthMm, heightMm: scene.heightMm }]
  for (const cell of cells) {
    const scale = px(1)
    const transform = new DOMMatrix([scale, 0, 0, scale, px(cell.x - bounds.x), px(cell.y - bounds.y)])
    path.addPath(new Path2D(paperPath(cell.widthMm, cell.heightMm, geometry)), transform)
  }
  ctx.save()
  // 画布可能带着绘制人读文字时留下的 translate/scale（见 drawHumanTextLayout），
  // 不清掉变换直接填路径会把白色盖到错误的位置，连码一起擦掉。
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#ffffff'
  ctx.fill(path, 'evenodd')
  ctx.restore()
}

function strokeWidthOf(object: object): number {
  const value = object as { strokeWidth?: number; borderWidth?: number }
  return Math.max(Number(value.strokeWidth ?? 0), Number(value.borderWidth ?? 0))
}

function isPaperFillColor(value: string | undefined): boolean {
  const color = (value ?? '').trim().toLowerCase()
  return color === '' || color === 'transparent' || color === '#fff' || color === '#ffffff' || color === 'white'
}

/** 对象是否自带不透明底色：这种位图必须覆盖下层内容（TSPL mode=0），不能 OR 叠加。 */
function hasOpaqueBackground(object: LabelObject): boolean {
  if (object.type === 'rect') {
    const rect = object as { fillEnabled?: boolean; fill?: string }
    return rect.fillEnabled !== false && !isPaperFillColor(rect.fill)
  }
  if (object.type === 'text') {
    const text = object as { backgroundTransparent?: boolean; reverse?: boolean }
    return text.reverse === true || text.backgroundTransparent === false
  }
  if (object.type === 'barcode') {
    return (object as { backgroundTransparent?: boolean }).backgroundTransparent === false
  }
  return false
}

/**
 * 对象位图要覆盖的实际范围（毫米）。
 *
 * 一维码按「窄条宽度恒定、数据变长向右溢出」绘制，符号可能比对象框宽；位图若只按
 * 对象框裁，超出部分会被整条裁掉（GS1 DataBar 这类没有原生指令的码制打印出来左右缺失）。
 * 文字同理：fabric.Text 既不换行也不受对象框宽度约束，编辑器里照常画出框外，位图只取
 * 对象框就会把多出来的字裁掉（按 2 字宽的框装 3 字，打出左右各缺一截）。
 * 弧形文字还必须按 fabric 实测包围盒裁。
 */
export async function objectBitmapBoundsMm(
  object: LabelObject,
  paddingMm: number,
  ctx?: DataCtx
): Promise<{ x: number; y: number; w: number; h: number }> {
  const curved = object.type === 'text' && ((object as TextObj).arc === true || (object as TextObj).textType === 'circle')
  const box = rotatedObjectBounds(object, paddingMm)
  if (curved) return measuredObjectBoundsMm(object, paddingMm, ctx)
  if (object.type === 'image' || object.type === 'line') {
    const bounds = object.type === 'image' ? await measuredObjectBoundsMm(object, paddingMm, ctx) : box
    const x = Math.max(0, bounds.x)
    const y = Math.max(0, bounds.y)
    return { x, y, w: Math.max(0.01, bounds.x + bounds.w - x), h: Math.max(0.01, bounds.y + bounds.h - y) }
  }
  // 二维条码按对象框等比缩放，不会溢出；一维码与文字需要把实测范围并进来。
  const overflowsBox = object.type === 'text' ||
    (object.type === 'barcode' && !TWO_DIMENSIONAL_SYMBOLOGIES.has(object.symbology))
  if (!overflowsBox) return box
  const measured = await measuredObjectBoundsMm(object, paddingMm, ctx)
  const unionLeft = Math.min(box.x, measured.x)
  const unionTop = Math.min(box.y, measured.y)
  const right = Math.max(box.x + box.w, measured.x + measured.w)
  const bottom = Math.max(box.y + box.h, measured.y + measured.h)
  // 实测只允许在**真的溢出**时扩框；否则保留原对象框，避免浮点/像素取整让位图尺寸漂移
  // （0.02mm ≈ 203dpi 下 0.16px，肉眼看不出；不压住它位图会多出半个像素，导致
  // 对象位图与整页预览的亚像素落点不同、边缘抗锯齿像素对不上）。
  const EPSILON_MM = 0.02
  if (box.x - unionLeft <= EPSILON_MM && box.y - unionTop <= EPSILON_MM &&
    right - (box.x + box.w) <= EPSILON_MM && bottom - (box.y + box.h) <= EPSILON_MM) {
    return box
  }
  // BITMAP 指令不接受负坐标：符号居中溢出到标签左侧时，从 0 起裁，左边那截本来就在纸外。
  const left = Math.max(0, unionLeft)
  const top = Math.max(0, unionTop)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

/** 把单个对象按「旋转包围盒 + 余量」渲染成单色位图，并记录落点（包围盒左上角）。 */
async function renderObjectBitmap(
  object: LabelObject,
  dpi: number,
  paddingMm: number,
  options: { opaque?: boolean; scene?: ResolvedPrintScene; ctx?: DataCtx; onQualityWarning?: (message: string) => void; clipMm?: { x: number; y: number; w: number; h: number } } = {}
): Promise<MonoBitmap> {
  const bounds = await objectBitmapBoundsMm(object, paddingMm, options.ctx)
  const local = { ...object, x: object.x - bounds.x, y: object.y - bounds.y }
  const canvas = await renderLabel({
    version: 1, name: 'bitmap', widthMm: bounds.w, heightMm: bounds.h, objects: [local],
    colorIndexTable: options.scene?.colorIndexTable ? [...options.scene.colorIndexTable] : undefined
  }, { dpi, ctx: options.ctx, monochromeImages: object.type === 'image',
    bitmapOriginDots: { x: Math.round(bounds.x * dpi / 25.4), y: Math.round(bounds.y * dpi / 25.4) },
    onQualityWarning: options.onQualityWarning })
  applyPrintableMask(canvas, bounds, dpi, options.scene)
  const bitmap: MonoBitmap = {
    ...monoFromImageData(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)),
    originXMm: bounds.x,
    originYMm: bounds.y,
    ...(options.opaque ? { opaque: true } : {})
  }
  const clip = options.clipMm ?? (options.scene ? { x: 0, y: 0, w: options.scene.widthMm, h: options.scene.heightMm } : undefined)
  return clip ? clipMonoBitmap(bitmap, clip, dpi) : bitmap
}

/** Rasterize images using the shared object geometry before monochrome conversion. */
export async function dataUrlToMonoBitmap(src: string, widthMm: number, heightMm: number, dpi: number): Promise<MonoBitmap> {
  return renderObjectBitmap({ id: 'image', type: 'image', x: 0, y: 0, w: widthMm, h: heightMm, rotation: 0, src }, dpi, BITMAP_PADDING_MM)
}

/** The text is already evaluated; do not apply substring/formatting a second time. */
export async function textToMonoBitmap(text: string, obj: TextObj, dpi: number): Promise<MonoBitmap> {
  // 指令打印的中文文本同样走 GDI：1-bit 位图直接下发，不再经过 canvas 阈值化。
  const native = await rasterizeTextMonoForPrint(obj, text, dpi)
  if (native) return native
  return renderObjectBitmap({
    ...obj,
    source: { kind: 'constant', value: text },
    subSources: undefined,
    format: undefined,
    substr: undefined,
    lengthLimit: undefined,
    charTemplate: undefined
  }, dpi, BITMAP_PADDING_MM, { opaque: hasOpaqueBackground(obj as unknown as LabelObject) })
}

/** 任意图元的对象位图（旋转/斜线/椭圆/不支持的码制等原生还原不了的情况）。 */
async function objectToMonoBitmap(primitive: ResolvedPrintPrimitive, dpi: number, scene: ResolvedPrintScene, onQualityWarning?: (message: string) => void): Promise<MonoBitmap> {
  const object = materializeScenePrimitive(primitive)
  const clip = primitive.clipCell
    ? { x: primitive.clipCell.x, y: primitive.clipCell.y, w: primitive.clipCell.widthMm, h: primitive.clipCell.heightMm }
    : { x: 0, y: 0, w: scene.widthMm, h: scene.heightMm }
  if (primitive.kind === 'text') {
    // 中文/小字号文本走 GDI 位图；不适用时自动回退下面的浏览器渲染。
    const native = await rasterizeTextMonoForPrint(primitive.object, primitive.value, dpi, onQualityWarning)
    if (native) return clipMonoBitmap(native, clip, dpi)
  }
  if (object.type === 'barcode' && TWO_DIMENSIONAL_SYMBOLOGIES.has(object.symbology) &&
    Math.abs(object.rotation) < 0.001 && object.flipX !== true && object.flipY !== true &&
    (!object.colorChange || object.colorChange.mode === 'fixed')) {
    // 二维码：按打印 DPI 直接生成（模组 = 整数点），码区对齐对象框，人读文字在框外。
    const bar = object
    const rendered = await renderBarcodeCanvasAtDpi(bar, 'value' in primitive ? primitive.value : '', dpi, onQualityWarning)
    const dpm = dpi / 25.4
    const symbolWidthMm = rendered.symbolWidthPx / dpm
    // 落点对齐到整点：整张位图平移 <0.5 点，不影响模组的整数性。
    const snap = (mm: number) => Math.round(mm * dpm) / dpm
    const symbolLeftMm = bar.symbology === 'qrcode' ? alignedSymbolLeftMm(bar, symbolWidthMm) : bar.x + (bar.w - symbolWidthMm) / 2
    const originXmm = snap(symbolLeftMm) - rendered.symbolLeftPx / dpm
    const originYmm = snap(bar.y - rendered.symbolTopPx / dpm)
    applyPrintableMask(rendered.canvas, {
      x: originXmm,
      y: originYmm,
      w: snap(rendered.canvas.width / dpm),
      h: snap(rendered.canvas.height / dpm)
    }, dpi, scene)
    // 负坐标的 BITMAP 在打印机上不合法（会被丢弃或画到标签外）：
    // 靠边放置的码 + 比码宽的人读文字会把图片拉到负坐标，这里按需裁掉越界的那一边。
    let canvas = rendered.canvas
    let originX = originXmm
    let originY = originYmm
    const cropLeft = Math.max(0, Math.round(-originX * dpm))
    const cropTop = Math.max(0, Math.round(-originY * dpm))
    const cropRight = 0
    const cropBottom = 0
    if (cropLeft || cropTop || cropRight || cropBottom) {
      const cropped = document.createElement('canvas')
      cropped.width = Math.max(1, canvas.width - cropLeft - cropRight)
      cropped.height = Math.max(1, canvas.height - cropTop - cropBottom)
      const context = cropped.getContext('2d')
      if (context) {
        context.drawImage(canvas, -cropLeft, -cropTop)
        canvas = cropped
        originX = originX + cropLeft / dpm
        originY = originY + cropTop / dpm
      }
    }
    return clipMonoBitmap({
      ...monoFromImageData(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)),
      originXMm: originX,
      originYMm: originY,
      ...(hasOpaqueBackground(object) || bar.symbology === 'qrcode' ? { opaque: true } : {})
    }, clip, dpi)
  }
  return renderObjectBitmap(object, dpi, Math.max(BITMAP_PADDING_MM, strokeWidthOf(object)), {
    onQualityWarning,
    opaque: hasOpaqueBackground(object),
    scene,
    ctx: primitive.context,
    clipMm: clip
  })
}

/**
 * 条码人读文字位图：用画布同款字体渲染并裁出文字区域。
 *
 * 原生 TSPL 的 `TEXT` 只能按打印机固件字宽估算位置；汉印/TSC 等机型字宽不同，
 * 数字会相对条码偏移、靠边时被裁。文字位图与画布完全同源，柱体仍走原生 BARCODE。
 */
async function humanTextBitmapFor(
  primitive: Extract<ResolvedPrintPrimitive, { kind: 'barcode' }>,
  dpi: number
): Promise<SceneHumanTextBitmap | null> {
  const bar = materializeScenePrimitive(primitive) as BarcodeObj
  if (!primitive.value) return null
  const rendered = await renderBarcodeCanvasAtDpi(bar, primitive.value, dpi)
  const human = rendered.humanTextPx
  if (!human) return null
  const dpm = dpi / 25.4
  const imageWidthMm = rendered.canvas.width / dpm
  const imageHeightMm = rendered.canvas.height / dpm
  // 与 barcodePlacement 的一维码规则一致：整张图（柱体+文字）按 barcodeAlign 落位，
  // 图片在对象框内水平对齐、垂直居中。
  const align = bar.barcodeAlign ?? 'center'
  const imageLeftMm = align === 'left'
    ? bar.x
    : align === 'right'
      ? bar.x + bar.w - imageWidthMm
      : bar.x + (bar.w - imageWidthMm) / 2
  const imageTopMm = bar.y + bar.h / 2 - imageHeightMm / 2
  const cropX = Math.max(0, Math.floor(human.left))
  const cropY = Math.max(0, Math.floor(human.top))
  const cropW = Math.min(rendered.canvas.width - cropX, Math.ceil(human.width))
  const cropH = Math.min(rendered.canvas.height - cropY, Math.ceil(human.height))
  if (cropW <= 0 || cropH <= 0) return null
  const crop = document.createElement('canvas')
  crop.width = cropW
  crop.height = cropH
  const context = crop.getContext('2d')
  if (!context) return null
  context.drawImage(rendered.canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
  return {
    bitmap: {
      ...monoFromImageData(context.getImageData(0, 0, cropW, cropH)),
      originXMm: imageLeftMm + cropX / dpm,
      originYMm: imageTopMm + cropY / dpm
    }
  }
}

/** 图片对象位图：保留旋转，按包围盒裁切。 */
async function sceneToMonoBitmap(scene: ResolvedPrintScene, printer: PrinterConfig, onQualityWarning?: (message: string) => void): Promise<MonoBitmap> {
  const doc: LabelDoc = {
    version: 1,
    name: 'native-raster',
    widthMm: scene.widthMm,
    heightMm: scene.heightMm,
    colorIndexTable: scene.colorIndexTable ? [...scene.colorIndexTable] : undefined,
    objects: scene.primitives
      .filter((primitive) => primitive.kind !== 'rfid')
      .map((primitive) => materializeScenePrimitive(primitive))
  }
  const dpi = printer.driver === 'cpcl' ? 200 : printer.dpi
  const canvas = await renderLabel(doc, { dpi, scene, nativeText: true, monochromeImages: true, onQualityWarning })
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建打印位图上下文')
  return monoFromImageData(context.getImageData(0, 0, canvas.width, canvas.height))
}

/** A separately emitted image cannot lighten ink already printed underneath it. */
/** 两个位图在重叠区域里是否都有实际墨点。 */
function bitmapsOverlapInk(a: MonoBitmap, b: MonoBitmap, dpi: number): boolean {
  const dpm = dpi / 25.4
  const ax = a.originXMm ?? 0
  const ay = a.originYMm ?? 0
  const bx = b.originXMm ?? 0
  const by = b.originYMm ?? 0
  const left = Math.max(ax, bx)
  const top = Math.max(ay, by)
  const right = Math.min(ax + a.width / dpm, bx + b.width / dpm)
  const bottom = Math.min(ay + a.height / dpm, by + b.height / dpm)
  if (right <= left || bottom <= top) return false
  const cols = Math.ceil((right - left) * dpm)
  const rows = Math.ceil((bottom - top) * dpm)
  if (cols * rows > 4_000_000) return true
  for (let y = 0; y < rows; y++) {
    const py = top + (y + 0.5) / dpm
    const ayPix = Math.floor((py - ay) * dpm)
    const byPix = Math.floor((py - by) * dpm)
    for (let x = 0; x < cols; x++) {
      const px = left + (x + 0.5) / dpm
      const axPix = Math.floor((px - ax) * dpm)
      const bxPix = Math.floor((px - bx) * dpm)
      const aInk = a.bytes[ayPix * a.bytesPerRow + (axPix >> 3)] & (0x80 >> (axPix & 7))
      const bInk = b.bytes[byPix * b.bytesPerRow + (bxPix >> 3)] & (0x80 >> (bxPix & 7))
      if (aInk && bInk) return true
    }
  }
  return false
}

const imageOpacityCache = new Map<string, Promise<boolean>>()

/** 图片是否每个像素都不透明（JPEG/实底 PNG）；只看 128×128 采样，失败按透明处理。 */
async function imageIsOpaque(src: string): Promise<boolean> {
  if (!src) return false
  const cached = imageOpacityCache.get(src)
  if (cached) return cached
  const promise = (async () => {
    try {
      const image = new Image()
      image.src = src
      await (image.decode ? image.decode() : new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('image load failed'))
      }))
      if (!image.naturalWidth || !image.naturalHeight) return false
      const canvas = document.createElement('canvas')
      canvas.width = Math.min(128, image.naturalWidth)
      canvas.height = Math.min(128, image.naturalHeight)
      const context = canvas.getContext('2d')
      if (!context) return false
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data
      for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return false
      return true
    } catch {
      return false
    }
  })()
  imageOpacityCache.set(src, promise)
  return promise
}

type InkBounds = { x: number; y: number; w: number; h: number }

/**
 * 图片与先前内容是否重叠。完全不透明且驱动支持覆盖的图片可以用对象位图盖住下层，
 * 不需要整页；半透明图片仍要整页合成（否则 alpha 混合会错）。
 */
export function imageOverlapsEarlierInk(
  scene: ResolvedPrintScene,
  dpi: number,
  isOpaque: (primitive: ResolvedPrintPrimitive) => boolean = () => false
): boolean {
  if (!scene.primitives.some((p, index) => index > 0 && p.kind === 'image')) return false
  type Earlier = { bounds: InkBounds; opaque: boolean }
  const earlier: Earlier[] = []
  const bitmapBounds = (bitmap: MonoBitmap, object: LabelObject): InkBounds => ({
    x: bitmap.originXMm ?? object.x, y: bitmap.originYMm ?? object.y,
    w: bitmap.width * 25.4 / dpi, h: bitmap.height * 25.4 / dpi
  })
  for (const primitive of scene.primitives) {
    if (primitive.kind === 'rfid') continue
    const object = primitive.object
    const bitmap = 'bitmap' in primitive ? primitive.bitmap : undefined
    const bounds = bitmap ? bitmapBounds(bitmap, object) : rotatedObjectBounds(object, strokeWidthOf(object))
    if (primitive.kind === 'image') {
      const opaque = isOpaque(primitive)
      // 不透明图片会按对象位图覆盖下层，不需要整页；半透明按包围盒保守合成。
      if (!opaque && earlier.some((prior) =>
        bounds.x < prior.bounds.x + prior.bounds.w && prior.bounds.x < bounds.x + bounds.w &&
        bounds.y < prior.bounds.y + prior.bounds.h && prior.bounds.y < bounds.y + bounds.h)) return true
    }
    earlier.push({ bounds, opaque: primitive.kind === 'image' ? isOpaque(primitive) : false })
    if (primitive.kind === 'barcode' && primitive.humanTextBitmap) {
      earlier.push({ bounds: bitmapBounds(primitive.humanTextBitmap, object), opaque: true })
    }
  }
  return false
}

/** 把最上层、无遮挡且原生可打印的条码标记为页位图上的原生叠加层。 */
export async function markOverlayBarcodes(scene: ResolvedPrintScene, printer: PrinterConfig): Promise<ResolvedPrintScene> {
  if (!new Set(['tspl', 'zpl', 'epl', 'cpcl', 'tpcl', 'pgl', 'sato']).has(printer.driver)) return scene
  const dpi = printerCapabilities(printer).coordinateDpi
  const primitives = scene.primitives
  const overlaps = (a: ReturnType<typeof rotatedObjectBounds>, b: ReturnType<typeof rotatedObjectBounds>): boolean =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
  const inkCache = new Map<ResolvedPrintPrimitive, MonoBitmap | undefined>()
  const inkOf = async (primitive: ResolvedPrintPrimitive): Promise<MonoBitmap | undefined> => {
    if (inkCache.has(primitive)) return inkCache.get(primitive)
    let bitmap: MonoBitmap | undefined
    if ('bitmap' in primitive && primitive.bitmap) bitmap = primitive.bitmap
    else {
      try { bitmap = await objectToMonoBitmap(primitive, dpi, scene) } catch { bitmap = undefined }
    }
    inkCache.set(primitive, bitmap)
    return bitmap
  }
  let changed = false
  const marked: ResolvedPrintPrimitive[] = []
  for (const [index, primitive] of primitives.entries()) {
    if (primitive.kind !== 'barcode' || primitive.clipCell || primitive.overlayNative) { marked.push(primitive); continue }
    const within = isPrimitiveFullyWithinLabel(scene, primitive)
    const bounds = centeredObjectBounds(primitive.object, strokeWidthOf(primitive.object))
    const cells = scene.labelCells?.length ? scene.labelCells : [{ x: 0, y: 0, widthMm: scene.widthMm, heightMm: scene.heightMm }]
    const rotatedWithin = cells.some((cell) =>
      bounds.x >= cell.x - 0.01 && bounds.y >= cell.y - 0.01 &&
      bounds.x + bounds.w <= cell.x + cell.widthMm + 0.01 && bounds.y + bounds.h <= cell.y + cell.heightMm + 0.01
    )
    const rotatedPlacement = (printer.driver === 'tspl' || printer.driver === 'epl') && !within && rotatedWithin && Math.abs(primitive.object.rotation % 360) > 0.001
    if (!within && !rotatedPlacement) { marked.push(primitive); continue }
    if (!primitiveIsolatable(primitive, printer) || primitiveNeedsRasterization(primitive, printer)) { marked.push(primitive); continue }
    let occluded = false
    for (const later of primitives.slice(index + 1)) {
      if (later.kind === 'rfid' || later.kind === 'barcode') continue
      if (!overlaps(bounds, centeredObjectBounds(later.object, strokeWidthOf(later.object)))) continue
      // 白底/实底图元会覆盖条码；文字/线/表格按实际墨迹判断。
      if (later.kind === 'rect' || later.kind === 'image' || hasOpaqueBackground(later.object)) { occluded = true; break }
      const candidate = await inkOf(primitive)
      const laterInk = await inkOf(later)
      if (!candidate || !laterInk || bitmapsOverlapInk(candidate, laterInk, dpi)) { occluded = true; break }
    }
    if (occluded) { marked.push(primitive); continue }
    changed = true
    marked.push({ ...primitive, overlayNative: true, ...(rotatedPlacement ? { rotatedPlacement: true } : {}) })
  }
  return changed ? ({ ...scene, primitives: marked } as ResolvedPrintScene) : scene
}

/** Resolve bitmaps from an already materialized scene; never re-evaluates a data source. */
export async function prepareBitmapsForScene(scene: ResolvedPrintScene, printer: PrinterConfig, onQualityWarning?: (message: string) => void): Promise<ResolvedPrintScene> {
  const coordinateDpi = printerCapabilities(printer).coordinateDpi
  const gdiRequested = nativeTextPrintRequested()
  const gdiMode = nativeTextPrintEnabled() ? 'gdi' : gdiRequested ? 'unavailable' : 'off'
  const gdiText = (primitive: ResolvedPrintPrimitive) =>
    primitive.kind === 'text' && gdiRequested && isSmallPrintText(primitive.object, primitive.value) &&
    textNeedsBitmap(primitive.object, primitive.value, printer)
  const gdiPage = scene.primitives.some((primitive) => {
    if (!gdiText(primitive) || primitive.kind !== 'text' || !nativeTextAppliesSmall(primitive.object, primitive.value)) return false
    // ESC/POS streams standalone bitmaps in sequence. Compose the page to keep label positions.
    // Rotated text near the printable edge also needs the page's exact clipping.
    const object = primitive.object
    return gdiMode === 'gdi' && (object.rotation % 360 !== 0 ||
      !/^#(?:000|000000)$/i.test(object.color) || scene.labelShape !== 'rect' && scene.labelShape !== undefined)
  })
  const mask = [scene.paperGeometry, scene.widthMm, scene.heightMm, scene.labelCells]
  // 同一页重复逻辑标签（拷贝铺满多联槽位）时，对象位图 key 会冲突（labelIndex+objectId 相同），
  // 只能整页位图，否则后一个拷贝会覆盖前一个、另一个槽位空白。
  if (gdiPage || sceneNeedsPageBitmap(scene, printer) || sceneHasRepeatedObjectInstances(scene)) {
    const overlayScene = await markOverlayBarcodes(scene, printer)
    const overlayIds = overlayScene.primitives.filter((primitive) => primitive.overlayNative).map((primitive) => primitive.object.id)
    const pageScene = overlayIds.length
      ? ({ ...overlayScene, primitives: overlayScene.primitives.filter((primitive) => !primitive.overlayNative) } as ResolvedPrintScene)
      : overlayScene
    const fingerprint = sceneFingerprint(pageScene)
    const key = `page|${printer.driver}|${coordinateDpi}|${gdiMode}|${scene.widthMm}|${scene.heightMm}|${fingerprint}|overlay:${overlayIds.join(',')}`
    const bitmap = await getPrintBitmap(key, (report) => sceneToMonoBitmap(pageScene, printer, report), onQualityWarning)
    return attachScenePageBitmap(overlayScene, bitmap)
  }
  const bitmaps = new Map<string, MonoBitmap>()
  const resolvedImages = new Map<ResolvedPrintPrimitive, ImageObj>()
  const opaqueImages = new Set<ResolvedPrintPrimitive>()
  for (const primitive of scene.primitives) {
    const key = `${primitive.labelIndex}:${primitive.object.id}`
    if (primitive.kind === 'image') {
      // 图片对象永远需要自己的位图（原生图片指令也吃位图），旋转交给包围盒裁切。
      const materialized = materializeScenePrimitive(primitive) as ImageObj
      const src = await resolveImageSource(materialized, primitive.context).catch((error: unknown) => {
        if (materialized.missingImage === 'skip' || materialized.missingImage === 'placeholder') return ''
        throw error
      })
      const image: ImageObj = { ...materialized, src, imgType: 'embed', linkPath: undefined, source: undefined }
      const opaque = printer.driver === 'tspl' && await imageIsOpaque(src)
      if (opaque) opaqueImages.add(primitive)
      resolvedImages.set(primitive, image)
      const cacheKey = `image|${coordinateDpi}|${hashValues([image, mask, scene.colorIndexTable, image.colorChange ? primitive.context : undefined])}`
      const imageClip = primitive.clipCell
        ? { x: primitive.clipCell.x, y: primitive.clipCell.y, w: primitive.clipCell.widthMm, h: primitive.clipCell.heightMm }
        : undefined
      bitmaps.set(key, cachedBitmap(cacheKey) ?? cacheBitmap(cacheKey,
        await renderObjectBitmap(image, coordinateDpi, BITMAP_PADDING_MM, { scene, ctx: primitive.context, opaque, ...(imageClip ? { clipMm: imageClip } : {}) })))
      continue
    }
    if (primitive.kind === 'rfid') continue
    // 逐对象裁图：原生还原不了的图元只把自己转成位图，其它元素继续保持原生。
    // 文字要把「浏览器字体 / 中文」也算进来（textNeedsBitmap 比 primitiveNeedsRasterization 多这两条）。
    const needsBitmap = primitive.kind === 'text'
      ? textNeedsBitmap(primitive.object as TextObj, primitive.value, printer)
      : primitiveNeedsRasterization(primitive, printer)
    // 单标签里越界的原生图元：强制对象位图，并在 renderObjectBitmap 里裁到标签范围。
    const needsClipBitmap = !bitmaps.has(`${primitive.labelIndex}:${primitive.object.id}`) &&
      (Boolean(primitive.clipCell) || !isPrimitiveFullyWithinLabel(scene, primitive))
    if ((!needsBitmap && !needsClipBitmap) || !primitiveIsolatable(primitive, printer)) continue
    const cacheKey = `obj|${printer.driver}|${coordinateDpi}|${gdiMode}|${primitiveFingerprint(primitive)}|${hashValues(mask)}`
    bitmaps.set(key, await getPrintBitmap(cacheKey, (report) => objectToMonoBitmap(primitive, coordinateDpi, scene, report), onQualityWarning))
  }
  // TSPL 原生 BARCODE 的固件人读文字宽度因机型而异；把文字按画布字体单独位图化，
  // 柱体保持原生。整条已位图化的条码跳过（文字已经在对象位图里）。
  const humanText = new Map<string, SceneHumanTextBitmap>()
  if (printer.driver === 'tspl' || printer.driver === 'epl' || printer.driver === 'zpl' || printer.driver === 'cpcl' || printer.driver === 'sato' || printer.driver === 'pgl') {
    for (const primitive of scene.primitives) {
      if (primitive.kind !== 'barcode') continue
      const key = `${primitive.labelIndex}:${primitive.object.id}`
      if (bitmaps.has(key)) continue
      if (primitiveNeedsRasterization(primitive, printer)) continue
      const bar = primitive.object as BarcodeObj
      if (bar.showText !== true || bar.barcodeOptions?.humanPosition === 'none') continue
      if (Math.abs(bar.rotation % 360) >= 0.001) continue
      if (!primitive.value || !/^[\x00-\x7F]*$/.test(primitive.value)) continue
      const entry = await humanTextBitmapFor(primitive, coordinateDpi)
      if (entry) humanText.set(key, entry)
    }
  }
  const prepared = attachSceneHumanTextBitmaps(attachSceneBitmaps(scene, bitmaps), humanText)
  if (!imageOverlapsEarlierInk(prepared, coordinateDpi, (primitive) => opaqueImages.has(primitive))) return prepared
  const overlayScene = await markOverlayBarcodes(scene, printer)
  const composed = {
    ...overlayScene,
    primitives: overlayScene.primitives.map((primitive) =>
      primitive.kind === 'image' ? { ...primitive, object: resolvedImages.get(primitive)! } : primitive)
  }
  const pageScene = composed.primitives.some((primitive) => primitive.overlayNative)
    ? ({ ...composed, primitives: composed.primitives.filter((primitive) => !primitive.overlayNative) } as ResolvedPrintScene)
    : composed
  return attachScenePageBitmap(overlayScene, await sceneToMonoBitmap(pageScene, printer, onQualityWarning))
}

/** Prepare only the current batch. The returned scenes are the same values used by protocol adapters. */
export async function prepareBitmapsForPrintJob(job: ResolvedPrintJob, printer: PrinterConfig, onQualityWarning?: (message: string) => void): Promise<ResolvedPrintJob> {
  const pages: ResolvedPrintJob['pages'][number][] = []
  for (const [index, page] of job.pages.entries()) {
    if (index > 0 && index % 4 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0))
    pages.push(Object.freeze({ ...page, scene: await prepareBitmapsForScene(page.scene, printer, onQualityWarning) }))
  }
  return Object.freeze({ ...job, pages: Object.freeze(pages) })
}
