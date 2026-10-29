import { describe, expect, it } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { RectObj } from '@shared/domain/objects'
import type { ResolvedPrintPrimitive } from '@shared/print/scene'
import { prepareDocumentForPrint } from '@shared/print/layout'
import { primitiveNeedsRasterization } from '@shared/print/capabilities'
import { dataCtx, printerConfig, sampleDoc } from '../../../helpers/factories'

const borderOf = (doc: LabelDoc) => doc.objects.find((object) => object.id === '__print-border')

function layout(shape: 'rect' | 'roundRect' | 'ellipse' | 'disc', cornerRadiusMm?: number) {
  return { rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0, shape, cornerRadiusMm }
}

describe('打印标签边框', () => {
  it('矩形标签：0.3mm 线宽，内缩半个线宽', () => {
    const border = borderOf(prepareDocumentForPrint(sampleDoc(), { printBorder: true }))
    expect(border).toMatchObject({
      type: 'rect', x: 0.15, y: 0.15, w: 59.7, h: 39.7,
      stroke: '#000000', strokeWidth: 0.3, fillEnabled: false
    })
  })

  it('圆角标签跟随圆角半径', () => {
    const doc = sampleDoc({ layout: layout('roundRect', 2) })
    const border = borderOf(prepareDocumentForPrint(doc, { printBorder: true })) as RectObj
    expect(border.shape).toBe('roundRect')
    expect(border.cornerRadius).toBeCloseTo(2)
  })

  it('椭圆 / 圆盘标签画椭圆边框', () => {
    for (const shape of ['ellipse', 'disc'] as const) {
      const doc = sampleDoc({ layout: layout(shape) })
      expect((borderOf(prepareDocumentForPrint(doc, { printBorder: true })) as { type?: string }).type).toBe('ellipse')
    }
  })

  it('旋转 90° 的标签用旋转后的尺寸画边框', () => {
    const doc = sampleDoc({ orientation: 90 })
    expect(borderOf(prepareDocumentForPrint(doc, { printBorder: true }))).toMatchObject({ w: 39.7, h: 59.7 })
  })

  it('未勾选时不加边框', () => {
    expect(borderOf(prepareDocumentForPrint(sampleDoc(), {}))).toBeUndefined()
  })

  it('重复调用不会叠出第二圈', () => {
    const once = prepareDocumentForPrint(sampleDoc(), { printBorder: true })
    const twice = prepareDocumentForPrint(once, { printBorder: true })
    expect(twice.objects.filter((object) => object.id === '__print-border')).toHaveLength(1)
  })

  it('圆角矩形边框必须走位图：原生 BOX/^GB 画不出圆角', () => {
    const rect: RectObj = {
      id: 'b', type: 'rect', x: 0, y: 0, w: 30, h: 20, rotation: 0,
      fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3, fillEnabled: false, shape: 'roundRect', cornerRadius: 1
    }
    const primitive = { kind: 'rect', object: rect, labelIndex: 1, context: dataCtx() } as ResolvedPrintPrimitive
    expect(primitiveNeedsRasterization(primitive, printerConfig())).toBe(true)
  })
})
