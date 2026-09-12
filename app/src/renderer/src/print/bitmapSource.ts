// ---------- 渲染层位图预处理（浏览器 Canvas，指令打印嵌入图片/中文用） ----------
// 将图片 dataURL 或文本渲染为打印机点阵单色位图（1=黑），供 TSPL PUTBMP / ZPL ^GFA 嵌入。
import type { ImageObj, LabelDoc, MonoBitmap, PrinterConfig, TextObj } from '../types'
import { resolveImageSource } from '../rendering/fabricObjects'
import { renderLabel } from './renderLabel'
import { attachSceneBitmaps, attachScenePageBitmap, materializeScenePrimitive, type ResolvedPrintJob, type ResolvedPrintScene } from '../../../shared/print/scene'
import { printerCapabilities, sceneNeedsNativeFontRasterization, sceneNeedsRasterization } from '../../../shared/print/capabilities'

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

/** Compact deterministic key for raster pages. JSON.stringify(scene) used to
 * allocate the complete embedded image data URL for every page, even when
 * only the record value changed. Hash the fields incrementally instead. */
function sceneFingerprint(scene: ResolvedPrintScene): string {
  let hash = 1469598103934665603n
  const mask = 0xffffffffffffffffn
  const add = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      hash ^= BigInt(value.charCodeAt(index))
      hash = (hash * 1099511628211n) & mask
    }
  }
  for (const primitive of scene.primitives) {
    add(primitive.kind)
    add(primitive.object.id)
    for (const key of Object.keys(primitive.object).sort()) {
      const value = (primitive.object as unknown as Record<string, unknown>)[key]
      add(key)
      // Embedded image payloads can be tens of MB; stream them through the
      // same hash instead of copying them into a JSON fingerprint string.
      if (key === 'src' && typeof value === 'string') add(value)
      else add(typeof value === 'object' ? JSON.stringify(value) : String(value))
    }
    if ('value' in primitive) add(primitive.value)
    if ('sourceValue' in primitive && primitive.sourceValue !== undefined) add(primitive.sourceValue)
  }
  return hash.toString(16)
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

/** Rasterize images using the shared object geometry before monochrome conversion. */
export async function dataUrlToMonoBitmap(src: string, widthMm: number, heightMm: number, dpi: number): Promise<MonoBitmap> {
  const canvas = await renderLabel({ version: 1, name: 'bitmap', widthMm, heightMm, objects: [
    { id: 'image', type: 'image', x: 0, y: 0, w: widthMm, h: heightMm, rotation: 0, src }
  ] }, { dpi })
  return monoFromImageData(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height))
}

/** The text is already evaluated; do not apply substring/formatting a second time. */
export async function textToMonoBitmap(text: string, obj: TextObj, dpi: number): Promise<MonoBitmap> {
  const local: TextObj = { ...obj, x: 0, y: 0, rotation: 0, source: { kind: 'constant', value: text },
    subSources: undefined, format: undefined, substr: undefined, lengthLimit: undefined, charTemplate: undefined }
  const canvas = await renderLabel({ version: 1, name: 'bitmap', widthMm: obj.w, heightMm: obj.h, objects: [local] }, { dpi })
  return monoFromImageData(canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height))
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
  if (sceneNeedsRasterization(scene, printer) || sceneNeedsNativeFontRasterization(scene)) {
    const fingerprint = sceneFingerprint(scene)
    const key = `page|${printer.driver}|${coordinateDpi}|${scene.widthMm}|${scene.heightMm}|${fingerprint}`
    const bitmap = cachedBitmap(key) ?? cacheBitmap(key, await sceneToMonoBitmap(scene, printer))
    return attachScenePageBitmap(scene, bitmap)
  }
  const bitmaps = new Map<string, MonoBitmap>()
  for (const primitive of scene.primitives) {
    const materialized = materializeScenePrimitive(primitive)
    if (primitive.kind === 'image') {
      const src = await resolveImageSource(materialized as ImageObj, primitive.context)
      if (!src) throw new Error('图片没有可用内容：' + primitive.object.id)
      const key = `image|${src}|${primitive.object.w}|${primitive.object.h}|${coordinateDpi}`
      bitmaps.set(`${primitive.labelIndex}:${primitive.object.id}`, cachedBitmap(key) ?? cacheBitmap(key, await dataUrlToMonoBitmap(src, primitive.object.w, primitive.object.h, coordinateDpi)))
    } else if (primitive.kind === 'text' && ((!printerCapabilities(printer).supportsNativeChinese && /[^\x00-\x7F]/.test(primitive.value)) || primitive.object.arc)) {
      const key = `text|${primitive.object.id}|${primitive.value}|${JSON.stringify(primitive.object)}|${coordinateDpi}`
      bitmaps.set(`${primitive.labelIndex}:${primitive.object.id}`, cachedBitmap(key) ?? cacheBitmap(key, await textToMonoBitmap(primitive.value, primitive.object as TextObj, coordinateDpi)))
    }
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
