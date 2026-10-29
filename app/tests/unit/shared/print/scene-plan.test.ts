import { describe, expect, it } from 'vitest'
import { sceneNeedsPageBitmap, sceneNeedsRasterization, textNeedsBitmap } from '@shared/print/capabilities'
import { buildCommands } from '@shared/print/engine'
import type { ResolvedPrintScene } from '@shared/print/scene'
import { barcodeObject, colorCtx, lineObject, textObject } from '../../../helpers/color'
import { printerConfig, tinyMono } from '../../../helpers/factories'

const tspl = printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } })
const zpl = printerConfig({ driver: 'zpl', port: { type: 'file', encoding: 'utf8' } })
const escpos = printerConfig({ driver: 'escpos', port: { type: 'file', encoding: 'utf8' } })

function scene(primitives: Array<Record<string, unknown>>): ResolvedPrintScene {
  return {
    widthMm: 60,
    heightMm: 40,
    labelIndex: 1,
    copy: 1,
    primitives: primitives.map((primitive) => ({ ...primitive, labelIndex: 1, context: colorCtx() }))
  } as unknown as ResolvedPrintScene
}

describe('逐对象位图判定', () => {
  it('绑定内建字库的纯 ASCII 文本可以走原生指令', () => {
    expect(textNeedsBitmap(textObject({ printerFont: 'Font0' }), 'ABC', tspl)).toBe(false)
    expect(textNeedsBitmap(textObject({ printerFont: 'A' }), 'ABC', zpl)).toBe(false)
  })

  it('浏览器字体、中文、加粗都需要位图', () => {
    expect(textNeedsBitmap(textObject({ fontFamily: '微软雅黑' }), 'ABC', tspl)).toBe(true)
    expect(textNeedsBitmap(textObject({ printerFont: 'Font0' }), '中文', tspl)).toBe(true)
    expect(textNeedsBitmap(textObject({ printerFont: 'Font0', bold: true }), 'ABC', tspl)).toBe(true)
  })

  it('普通「条码 + 文字」标签不再整页位图', () => {
    const value = scene([
      { kind: 'barcode', object: barcodeObject(), value: '123456' },
      { kind: 'text', object: textObject(), value: 'ABC' }
    ])
    expect(sceneNeedsPageBitmap(value, tspl)).toBe(false)
  })

  it('加粗、旋转的文字也只是对象级位图', () => {
    expect(sceneNeedsPageBitmap(scene([{ kind: 'text', object: textObject({ bold: true }), value: 'AB' }]), tspl)).toBe(false)
    expect(sceneNeedsPageBitmap(scene([{ kind: 'text', object: textObject({ rotation: 45 }), value: 'AB' }]), tspl)).toBe(false)
  })

  it('斜线、旋转矩形、椭圆、45° 条码都只转自己，不整页', () => {
    expect(sceneNeedsPageBitmap(scene([{ kind: 'line', object: lineObject({ w: 20, h: 4 }) }]), tspl)).toBe(false)
    expect(sceneNeedsPageBitmap(scene([{ kind: 'rect', object: { id: 'r', type: 'rect', x: 1, y: 1, w: 10, h: 10, rotation: 30, fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3 } }]), tspl)).toBe(false)
    expect(sceneNeedsPageBitmap(scene([{ kind: 'ellipse', object: { id: 'e', type: 'ellipse', x: 1, y: 1, w: 10, h: 10, rotation: 0, fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3 } }]), tspl)).toBe(false)
    expect(sceneNeedsPageBitmap(scene([{ kind: 'barcode', object: barcodeObject({ rotation: 45 }) }]), tspl)).toBe(false)
  })

  it('二维码打印走对象位图：尺寸和人读文字与画布一致', () => {
    const value = scene([{ kind: 'barcode', object: barcodeObject({ symbology: 'qrcode', showText: true }), value: '123456' }])
    expect(sceneNeedsRasterization(value, tspl)).toBe(true)
    expect(sceneNeedsPageBitmap(value, tspl)).toBe(false)
    const dm = scene([{ kind: 'barcode', object: barcodeObject({ symbology: 'datamatrix', showText: true }), value: '123456' }])
    expect(sceneNeedsRasterization(dm, tspl)).toBe(true)
  })

  it('CodaBar 隐藏起始符/终止符时退回对象位图（原生文字由打印机生成）', () => {
    const barcode = barcodeObject({ symbology: 'codabar', showText: true, barcodeOptions: { codabarShowStartStop: false } })
    const value = scene([{ kind: 'barcode', object: barcode, value: '1234' }])
    expect(sceneNeedsRasterization(value, tspl)).toBe(true)
    expect(sceneNeedsPageBitmap(value, tspl)).toBe(false)
  })

  it('旋转的表格也只转自己，不整页', () => {
    const table = { id: 'tbl', type: 'table', x: 5, y: 5, w: 20, h: 10, rotation: 15, rows: 2, cols: 2, borderWidth: 0.3, borderColor: '#000000' }
    expect(sceneNeedsPageBitmap(scene([{ kind: 'table', object: table }]), tspl)).toBe(false)
  })

  it('弧形文字可以逐对象裁图，不再整页', () => {
    expect(sceneNeedsPageBitmap(scene([{ kind: 'text', object: textObject({ arc: true }), value: 'AB' }]), tspl)).toBe(false)
    expect(sceneNeedsPageBitmap(scene([{ kind: 'text', object: textObject({ textType: 'circle' }), value: 'AB' }]), tspl)).toBe(false)
  })

  it('光盘标签：可打印区域内的原生图元不整页，越界的才整页', () => {
    const disc = (barcode: Record<string, unknown>) => ({
      ...scene([{ kind: 'barcode', object: barcode, value: '123456' }]),
      paperGeometry: { shape: 'ellipse' as const, innerDiameterMm: 5 }
    })
    expect(sceneNeedsPageBitmap(disc(barcodeObject({ x: 10, y: 8, w: 20, h: 6 })), tspl)).toBe(false)
    expect(sceneNeedsPageBitmap(disc(barcodeObject({ x: 50, y: 34, w: 20, h: 6 })), tspl)).toBe(true)
    // 盖住中心孔的也不行
    expect(sceneNeedsPageBitmap(disc(barcodeObject({ x: 4, y: 14, w: 40, h: 10 })), tspl)).toBe(true)
  })

  it('ESC/POS 的非文本图元仍需整页位图', () => {
    expect(sceneNeedsPageBitmap(scene([{ kind: 'rect', object: { id: 'r', type: 'rect', x: 1, y: 1, w: 10, h: 10, rotation: 0, fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3 } }]), escpos)).toBe(true)
  })

  it('透明位图用 OR，带不透明底色的位图用覆盖模式', () => {
    const build = (opaque: boolean) => buildCommands({} as never, tspl, {
      count: 1,
      copy: 1,
      title: 'mode',
      datasets: {},
      resolvedPages: [scene([{
        kind: 'text',
        object: textObject({ printerFont: 'Font0' }),
        value: 'ABC',
        bitmap: { ...tinyMono(8, 2), originXMm: 10, originYMm: 5, ...(opaque ? { opaque: true } : {}) }
      }])]
    }).text
    expect(build(false)).toContain('BITMAP 80,40,1,2,1,')
    expect(build(true)).toContain('BITMAP 80,40,1,2,0,')
  })

  it('混合输出：条码原生 + 文字对象位图，没有整页位图', () => {
    const mixed = scene([
      { kind: 'barcode', object: barcodeObject(), value: '123456' },
      {
        kind: 'text',
        object: textObject({ printerFont: 'Font0' }),
        value: 'ABC',
        bitmap: { ...tinyMono(8, 2), originXMm: 10, originYMm: 5 }
      }
    ])
    const result = buildCommands({} as never, tspl, {
      count: 1,
      copy: 1,
      title: 'mixed',
      datasets: {},
      resolvedPages: [mixed]
    })
    expect(result.text).toContain('BARCODE')
    expect(result.text).toContain('BITMAP 80,40,1,2,1,')
    expect(result.text).not.toContain('TEXT')
    expect(result.text).not.toContain('PAGE_RAW')
    expect(result.segments.some((segment) => segment.type === 'bin')).toBe(true)
  })
})
