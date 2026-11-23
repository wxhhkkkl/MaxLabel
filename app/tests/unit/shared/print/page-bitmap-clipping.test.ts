import { describe, expect, it } from 'vitest'
import { attachScenePageBitmap, resolvePrintScene } from '@shared/print/scene'
import { primitiveNeedsRasterization, sceneNeedsPageBitmap } from '@shared/print/capabilities'
import { buildResolvedCommands } from '@shared/print/engine'
import { clipMonoBitmap, imageOverlapsEarlierInk, markOverlayBarcodes } from '@/print/bitmapSource'
import { dataCtx, printerConfig, sampleDoc, tinyMono } from '../../../helpers/factories'

describe('单标签越界对象的位图裁剪', () => {
  it('越界矩形可隔离时不再整页位图，内部条码保持原生', () => {
    const doc = sampleDoc({ objects: [
      ...sampleDoc().objects,
      { id: 'outside', type: 'rect', x: 55, y: 0, w: 10, h: 10, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 0.3 }
    ] })
    const scene = resolvePrintScene(doc, dataCtx())
    const printer = printerConfig({ driver: 'tspl' })
    const barcode = scene.primitives.find((primitive) => primitive.kind === 'barcode')!
    expect(sceneNeedsPageBitmap(scene, printer)).toBe(false)
    expect(primitiveNeedsRasterization(barcode, printer)).toBe(false)
  })

  it('位图裁到标签范围并同步平移原点', () => {
    const bytes = new Uint8Array(20) // 2 bytes/row × 10 rows
    bytes.fill(0xff)
    const clipped = clipMonoBitmap({ width: 20, height: 10, bytesPerRow: 2, bytes, originXMm: 0, originYMm: 0 },
      { x: 0.5, y: 0, w: 1, h: 1 }, 254)
    expect(clipped.width).toBe(10)
    expect(clipped.height).toBe(10)
    expect(clipped.originXMm).toBeCloseTo(0.5, 3)
    expect(clipped.bytesPerRow).toBe(2)
    for (let y = 0; y < clipped.height; y++) {
      expect(clipped.bytes[y * 2]).toBe(0xff)
      expect(clipped.bytes[y * 2 + 1]).toBe(0xc0)
    }
  })
})

describe('图片重叠按透明度判断', () => {
  const scene = () => {
    const base = sampleDoc()
    const objects = [
      { id: 't', type: 'text', x: 0, y: 0, w: 10, h: 10, rotation: 0, fontFamily: 'Arial', fontSize: 4, bold: false, align: 'left', color: '#000', source: { kind: 'constant', value: 'T' } },
      { id: 'i', type: 'image', x: 9, y: 0, w: 10, h: 10, rotation: 0, src: 'x', imgType: 'embed' }
    ]
    return resolvePrintScene({ ...base, objects } as never, dataCtx())
  }

  it('半透明图片与先前内容包围盒相交时整页合成', () => {
    expect(imageOverlapsEarlierInk(scene(), 254, () => false)).toBe(true)
  })

  it('不透明图片可用对象位图覆盖，不整页', () => {
    expect(imageOverlapsEarlierInk(scene(), 254, () => true)).toBe(false)
  })
})


describe('页位图上的原生条码叠加', () => {
  it('最上层条码标记为 overlay，页位图之外仍输出原生 BARCODE', async () => {
    const printer = printerConfig({ driver: 'tspl' })
    const scene = resolvePrintScene(sampleDoc(), dataCtx())
    const marked = await markOverlayBarcodes(scene, printer)
    expect(marked.primitives.some((primitive) => primitive.overlayNative)).toBe(true)
    const page = attachScenePageBitmap(marked, { ...tinyMono(8, 8), originXMm: 0, originYMm: 0 })
    const result = buildResolvedCommands(printer, {
      count: 1, copy: 1, title: 'overlay', datasets: {}, resolvedPages: [page]
    })
    expect(result.text).toContain('BITMAP 0,0')
    expect(result.text).toContain('BARCODE')
  })

  it('后被遮挡的条码不叠加', async () => {
    const printer = printerConfig({ driver: 'tspl' })
    const base = sampleDoc()
    const barcode = base.objects.find((object) => object.type === 'barcode')!
    const cover = { id: 'cover', type: 'rect' as const, x: barcode.x, y: barcode.y, w: barcode.w, h: barcode.h, rotation: 0, fill: '#000', stroke: '#000', strokeWidth: 0 }
    const scene = resolvePrintScene({ ...base, objects: [barcode, cover] } as never, dataCtx())
    expect((await markOverlayBarcodes(scene, printer)).primitives.some((primitive) => primitive.overlayNative)).toBe(false)
  })
})
