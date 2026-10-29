// ---------- 渲染层位图预处理（浏览器 Canvas，指令打印嵌入图片/中文用） ----------
// 将图片 dataURL 或文本渲染为打印机点阵单色位图（1=黑），供 TSPL PUTBMP / ZPL ^GFA 嵌入。
import { PX_PER_MM, type DataCtx, type ImageObj, type LabelDoc, type LabelObject, type MonoBitmap, type PrinterConfig, type TextObj } from '../types'
import { makeObject, resolveImageSource } from '../rendering/fabricObjects'
import { TWO_DIMENSIONAL_SYMBOLOGIES } from '../../../shared/domain/objects'
import { renderBarcodeCanvasAtDpi } from '../editor/barcode'
import { renderLabel } from './renderLabel'
import { attachSceneBitmaps, attachScenePageBitmap, materializeScenePrimitive, type ResolvedPrintJob, type ResolvedPrintPrimitive, type ResolvedPrintScene } from '../../../shared/print/scene'
import { primitiveIsolatable, primitiveNeedsRasterization, printerCapabilities, sceneNeedsPageBitmap, textNeedsBitmap } from '../../../shared/print/capabilities'
import { rotatedObjectBounds } from '../../../shared/print/bounds'

const bitmapCache = new Map<string, MonoBitmap>()
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
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      if (lum < 128) {
        bytes[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }
  return { width, height, bytesPerRow, bytes }
}

/** 位图四周留的余量（毫米）：描边与抗锯齿不应该被裁掉。 */
const BITMAP_PADDING_MM = 0.4

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
  if (geometry.shape === 'rect' && !hasHole) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const px = (mm: number) => (mm * dpi) / 25.4
  const left = px(-bounds.x)
  const top = px(-bounds.y)
  const width = px(scene.widthMm)
  const height = px(scene.heightMm)
  const path = new Path2D()
  path.rect(0, 0, canvas.width, canvas.height)
  if (geometry.shape === 'ellipse') {
    path.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2)
  } else if (geometry.shape === 'roundRect' && typeof path.roundRect === 'function') {
    path.roundRect(left, top, width, height, Math.max(0, px(geometry.cornerRadiusMm ?? 0)))
  } else {
    path.rect(left, top, width, height)
  }
  if (hasHole) {
    const radius = px((geometry.innerDiameterMm ?? 0) / 2)
    path.ellipse(left + width / 2, top + height / 2, radius, radius, 0, 0, Math.PI * 2)
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
 * 弧形文字同理，必须按 fabric 实测包围盒裁。
 */
export async function objectBitmapBoundsMm(
  object: LabelObject,
  paddingMm: number,
  ctx?: DataCtx
): Promise<{ x: number; y: number; w: number; h: number }> {
  const curved = object.type === 'text' && ((object as TextObj).arc === true || (object as TextObj).textType === 'circle')
  const box = rotatedObjectBounds(object, paddingMm)
  if (curved) return measuredObjectBoundsMm(object, paddingMm, ctx)
  // 二维条码按对象框等比缩放，不会溢出；只有一维码需要把实测范围并进来。
  if (object.type !== 'barcode' || TWO_DIMENSIONAL_SYMBOLOGIES.has(object.symbology)) return box
  const measured = await measuredObjectBoundsMm(object, paddingMm, ctx)
  const unionLeft = Math.min(box.x, measured.x)
  const unionTop = Math.min(box.y, measured.y)
  const right = Math.max(box.x + box.w, measured.x + measured.w)
  const bottom = Math.max(box.y + box.h, measured.y + measured.h)
  // 实测只允许在**真的溢出**时扩框；否则保留原对象框，避免浮点误差让位图尺寸漂移。
  const EPSILON_MM = 0.01
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
  options: { opaque?: boolean; scene?: ResolvedPrintScene; ctx?: DataCtx } = {}
): Promise<MonoBitmap> {
  const bounds = await objectBitmapBoundsMm(object, paddingMm, options.ctx)
  const local = { ...object, x: object.x - bounds.x, y: object.y - bounds.y }
  const canvas = await renderLabel({ version: 1, name: 'bitmap', widthMm: bounds.w, heightMm: bounds.h, objects: [local] }, { dpi, ctx: options.ctx })
  applyPrintableMask(canvas, bounds, dpi, options.scene)
  return {
    ...monoFromImageData(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)),
    originXMm: bounds.x,
    originYMm: bounds.y,
    ...(options.opaque ? { opaque: true } : {})
  }
}

/** Rasterize images using the shared object geometry before monochrome conversion. */
export async function dataUrlToMonoBitmap(src: string, widthMm: number, heightMm: number, dpi: number): Promise<MonoBitmap> {
  return renderObjectBitmap({ id: 'image', type: 'image', x: 0, y: 0, w: widthMm, h: heightMm, rotation: 0, src }, dpi, BITMAP_PADDING_MM)
}

/** The text is already evaluated; do not apply substring/formatting a second time. */
export async function textToMonoBitmap(text: string, obj: TextObj, dpi: number): Promise<MonoBitmap> {
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
async function objectToMonoBitmap(primitive: ResolvedPrintPrimitive, dpi: number, scene: ResolvedPrintScene): Promise<MonoBitmap> {
  const object = materializeScenePrimitive(primitive)
  if (object.type === 'barcode' && TWO_DIMENSIONAL_SYMBOLOGIES.has(object.symbology) &&
    Math.abs(object.rotation) < 0.001 && object.flipX !== true && object.flipY !== true) {
    // 二维码：按打印 DPI 直接生成（模组 = 整数点），码区对齐对象框，人读文字在框外。
    const bar = object
    const rendered = await renderBarcodeCanvasAtDpi(bar, 'value' in primitive ? primitive.value : '', dpi)
    const dpm = dpi / 25.4
    const symbolWidthMm = rendered.symbolWidthPx / dpm
    // 落点对齐到整点：整张位图平移 <0.5 点，不影响模组的整数性。
    const snap = (mm: number) => Math.round(mm * dpm) / dpm
    const originXmm = snap(bar.x + (bar.w - symbolWidthMm) / 2 - rendered.symbolLeftPx / dpm)
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
    return {
      ...monoFromImageData(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)),
      originXMm: originX,
      originYMm: originY,
      ...(hasOpaqueBackground(object) ? { opaque: true } : {})
    }
  }
  return renderObjectBitmap(object, dpi, Math.max(BITMAP_PADDING_MM, strokeWidthOf(object)), {
    opaque: hasOpaqueBackground(object),
    scene,
    ctx: primitive.context
  })
}

/** 图片对象位图：保留旋转，按包围盒裁切。 */
async function imageToMonoBitmap(src: string, object: ImageObj, dpi: number, scene: ResolvedPrintScene, ctx?: DataCtx): Promise<MonoBitmap> {
  return renderObjectBitmap({ id: object.id, type: 'image', x: object.x, y: object.y, w: object.w, h: object.h, rotation: object.rotation, src }, dpi, BITMAP_PADDING_MM, { scene, ctx })
}

async function sceneToMonoBitmap(scene: ResolvedPrintScene, printer: PrinterConfig): Promise<MonoBitmap> {
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
  const canvas = await renderLabel(doc, { dpi, scene })
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法创建打印位图上下文')
  return monoFromImageData(context.getImageData(0, 0, canvas.width, canvas.height))
}

/** Resolve bitmaps from an already materialized scene; never re-evaluates a data source. */
export async function prepareBitmapsForScene(scene: ResolvedPrintScene, printer: PrinterConfig): Promise<ResolvedPrintScene> {
  const coordinateDpi = printerCapabilities(printer).coordinateDpi
  if (sceneNeedsPageBitmap(scene, printer)) {
    const fingerprint = sceneFingerprint(scene)
    const key = `page|${printer.driver}|${coordinateDpi}|${scene.widthMm}|${scene.heightMm}|${fingerprint}`
    const bitmap = cachedBitmap(key) ?? cacheBitmap(key, await sceneToMonoBitmap(scene, printer))
    return attachScenePageBitmap(scene, bitmap)
  }
  const bitmaps = new Map<string, MonoBitmap>()
  for (const primitive of scene.primitives) {
    const key = `${primitive.labelIndex}:${primitive.object.id}`
    if (primitive.kind === 'image') {
      // 图片对象永远需要自己的位图（原生图片指令也吃位图），旋转交给包围盒裁切。
      const materialized = materializeScenePrimitive(primitive)
      const src = await resolveImageSource(materialized as ImageObj, primitive.context)
      if (!src) throw new Error('图片没有可用内容：' + primitive.object.id)
      const cacheKey = `image|${hashValues([src, primitive.object.w, primitive.object.h, primitive.object.rotation])}|${coordinateDpi}`
      bitmaps.set(key, cachedBitmap(cacheKey) ?? cacheBitmap(cacheKey, await imageToMonoBitmap(src, primitive.object as ImageObj, coordinateDpi, scene, primitive.context)))
      continue
    }
    if (primitive.kind === 'rfid') continue
    // 逐对象裁图：原生还原不了的图元只把自己转成位图，其它元素继续保持原生。
    // 文字要把「浏览器字体 / 中文」也算进来（textNeedsBitmap 比 primitiveNeedsRasterization 多这两条）。
    const needsBitmap = primitive.kind === 'text'
      ? textNeedsBitmap(primitive.object as TextObj, primitive.value, printer)
      : primitiveNeedsRasterization(primitive, printer)
    if (!needsBitmap || !primitiveIsolatable(primitive, printer)) continue
    const cacheKey = `obj|${printer.driver}|${coordinateDpi}|${primitiveFingerprint(primitive)}`
    bitmaps.set(key, cachedBitmap(cacheKey) ?? cacheBitmap(cacheKey, await objectToMonoBitmap(primitive, coordinateDpi, scene)))
  }
  return attachSceneBitmaps(scene, bitmaps)
}

/** Prepare only the current batch. The returned scenes are the same values used by protocol adapters. */
export async function prepareBitmapsForPrintJob(job: ResolvedPrintJob, printer: PrinterConfig): Promise<ResolvedPrintJob> {
  const pages: ResolvedPrintJob['pages'][number][] = []
  for (const [index, page] of job.pages.entries()) {
    if (index > 0 && index % 4 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0))
    pages.push(Object.freeze({ ...page, scene: await prepareBitmapsForScene(page.scene, printer) }))
  }
  return Object.freeze({ ...job, pages: Object.freeze(pages) })
}
