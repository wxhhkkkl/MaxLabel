import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '@shared/domain'
import type { LabelDoc } from '@shared/domain/document'
import type { PrinterConfig } from '@shared/domain/printer'
import { buildCommands } from '@shared/print/engine'
import { printerConfig, sampleDoc } from '../../../helpers/factories'

function tspl(overrides: Partial<PrinterConfig> = {}, options: Record<string, unknown> = {}) {
  return buildCommands(sampleDoc(), printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' }, ...overrides }), {
    count: 1,
    copy: 1,
    title: '测试',
    datasets: {},
    ...options
  })
}

describe('TSPL command output', () => {
  it('emits size, density and speed', () => {
    const { text } = tspl()
    expect(text).toContain('SIZE 60 mm,40 mm')
    expect(text).toContain('DENSITY 8')
    expect(text).toContain('SPEED 4')
  })

  it('emits one CLS per label and the copy count', () => {
    const result = buildCommands(
      sampleDoc(),
      printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }),
      { count: 2, copy: 2, title: '测试', datasets: {} }
    )
    expect(result.text.split('CLS').length - 1).toBe(2)
    expect(result.text).toContain('PRINT 1,2')
    expect(result.labelCount).toBe(4)
    expect(result.encoding).toBe('utf8')
  })

  it('advances serial data per label', () => {
    const { text } = buildCommands(
      sampleDoc(),
      printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }),
      { count: 2, copy: 1, title: '测试', datasets: {} }
    )
    expect(text).toContain('"SN-1001"')
    expect(text).toContain('"SN-1002"')
  })

  it('emits barcode, box and bar commands', () => {
    const { text } = tspl()
    expect(text).toContain('BARCODE')
    expect(text).toContain('"128"')
    expect(text).toContain('BOX ')
    expect(text).toContain('BAR ')
    expect(text).not.toContain('LINE ')
  })

  it('emits numeric font names and bitmap multiples for TSPL font 0', () => {
    const doc = sampleDoc()
    doc.objects[1] = { ...doc.objects[1], source: { kind: 'constant', value: 'ABC' } } as LabelDoc['objects'][number]
    const plain = buildCommands(doc, printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    }).text
    // Font "0" 是 8×12 点阵：5mm @203dpi = 40 dots，40 / 12 ≈ 3 倍。
    expect(plain).toContain('"0",0,3,3,0,')
    expect(plain).not.toContain('"Font0"')

    doc.objects[1] = { ...doc.objects[1], printerFont: 'Font3' } as LabelDoc['objects'][number]
    const font3 = buildCommands(doc, printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    }).text
    expect(font3).toContain('"3",')
    expect(font3).not.toContain('"Font3"')
  })

  it('prints barcode human text with a selected TSPL printer font', () => {
    const doc = sampleDoc()
    doc.objects[2] = { ...doc.objects[2], printerFont: 'Font3' } as LabelDoc['objects'][number]
    const { text } = buildCommands(doc, printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    })
    // 条码本体不再让固件画人读文字，另起一条 TEXT 指令用选中的内建字库。
    expect(text).toMatch(/BARCODE \d+,\d+,"128",\d+,0,0,/)
    expect(text).toMatch(/TEXT \d+,\d+,"3",0,\d+,\d+,0,"SN-1001"/)
  })

  it('draws the human text itself so it stays centered like the canvas', () => {
    const { text } = tspl()
    // 不再让固件从条码左端开始排（多数 TSPL 机型左对齐，与画布居中不一致）
    expect(text).toMatch(/BARCODE \d+,\d+,"128",\d+,0,0,/)
    expect(text).toMatch(/TEXT \d+,\d+,"0",0,\d+,\d+,0,"SN-1001"/)
    const barcodeX = Number(/BARCODE (\d+),/.exec(text)?.[1] ?? NaN)
    // 取条码自己的那行 TEXT（同页还有文字对象的 TEXT，不能拿第一行顶替）。
    const humanLine = text.split('\n').find((line) => line.startsWith('TEXT ') && line.includes('"SN-1001"')) ?? ''
    const humanX = Number(/^TEXT (\d+),/.exec(humanLine)?.[1] ?? NaN)
    expect(humanX).toBeGreaterThan(barcodeX)
    // 对象框高度含人读文字：柱体只占「框高 − 文字块」，文字接在柱体下方，
    // 否则固件按整框高画柱体、文字再另起一行，打印结果会比画布整体偏下。
    const barcodeH = Number(/BARCODE \d+,\d+,"128",(\d+),/.exec(text)?.[1] ?? NaN)
    const humanY = Number(/^TEXT \d+,(\d+),/.exec(humanLine)?.[1] ?? NaN)
    const toDot = (mm: number) => Math.round((mm * 203) / 25.4)
    const textBlock = ((8 * 25.4) / 72) * 1.5
    expect(barcodeH).toBe(toDot(14 - textBlock))
    expect(humanY).toBe(toDot(13 + 14 - textBlock))
  })

  it('treats TSPL font "0" as the built-in 8x12 bitmap font, not point size', () => {
    const { text } = tspl()
    const humanLine = text.split('\n').find((line) => line.startsWith('TEXT ') && line.includes('"SN-1001"')) ?? ''
    // 8pt ≈ 2.82mm @203dpi = 23 dots；8×12 点阵按 12 点字高向上取整 → 2 倍。
    // 旧实现把 8 当成磅值直接写进 x/y 倍率，汉印会当成 8 倍放大 → 8mm×12mm 巨型点阵字。
    expect(humanLine).toMatch(/^TEXT \d+,\d+,"0",0,2,2,0,"SN-1001"$/)
  })

  it('scales a large human-readable font by bitmap multiples', () => {
    const doc = sampleDoc()
    doc.objects[2] = { ...doc.objects[2], fontSize: 12 } as LabelDoc['objects'][number]
    const { text } = buildCommands(doc, printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    })
    const humanLine = text.split('\n').find((line) => line.startsWith('TEXT ') && line.includes('"SN-1001"')) ?? ''
    // 12mm @203dpi = 96 dots；96 / 12 = 8 倍，而不是 old: round(12×72/25.4)=34 磅。
    expect(humanLine).toMatch(/^TEXT \d+,\d+,"0",0,8,8,0,"SN-1001"$/)
  })

  it('warns when a rotated barcode cannot use the selected printer font', () => {
    const doc = sampleDoc()
    doc.objects[2] = { ...doc.objects[2], printerFont: 'Font4', rotation: 90 } as LabelDoc['objects'][number]
    const result = buildCommands(doc, printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    })
    expect(result.warningDetails.some((warning) => warning.code === 'printer-font-fallback')).toBe(true)
    // 旋转时退回固件默认字库，仍然输出人读文字。
    expect(result.text).toMatch(/BARCODE \d+,\d+,"128",\d+,1,90,/)
  })

  it('warns when the printer font cannot represent the human text', () => {
    const doc = sampleDoc()
    doc.objects[2] = { ...doc.objects[2], printerFont: 'Font4', source: { kind: 'constant', value: '中文内容' } } as LabelDoc['objects'][number]
    const result = buildCommands(doc, printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    })
    expect(result.warningDetails.some((warning) => warning.code === 'printer-font-fallback')).toBe(true)
  })

  it('requires rasterization for diagonal lines that BAR cannot draw', () => {
    const doc = sampleDoc()
    doc.objects.push({ id: 'diag', type: 'line', x: 4, y: 34, w: 20, h: 4, rotation: 0, stroke: '#000', strokeWidth: 0.3 })
    const result = buildCommands(doc, printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    })
    // 斜线现在只把这一条线转对象位图；没有位图时通知调用方，并且不静默画错。
    expect(result.warningDetails.some((warning) => warning.code === 'missing-object-bitmap')).toBe(true)
    expect(result.warningDetails.some((warning) => warning.code === 'unsupported-line-angle' && warning.severity === 'error')).toBe(true)
  })

  it('maps printer preferences to TSPL job parameters', () => {
    const { text } = tspl({ speed: 6, density: 12, labelType: 'mark', topOffsetMm: -2.5, mediaHandle: 'cut', backfeedMm: 3.5 })
    expect(text).toContain('DENSITY 12')
    expect(text).toContain('SPEED 6')
    expect(text).toContain('BLINE 2 mm,0 mm')
    expect(text).toContain('REFERENCE 0,-20')
    expect(text).toContain('CUT ON')
    expect(text).toContain('BACKFEED 28')
  })

  it('uses gap sensing for gap labels and omits it for continuous paper', () => {
    const gap = tspl({ labelType: 'gap' }).text
    const continuous = tspl({ labelType: 'continuous' }).text
    expect(gap).toContain('GAP 2 mm,0 mm')
    expect(continuous).not.toContain('GAP 2 mm,0 mm')
    expect(continuous).not.toContain('BLINE 2 mm,0 mm')
  })

  it('round-trips printer preferences through document normalization', () => {
    const document = normalizeDocument({
      version: 2,
      name: 'printer-preferences',
      widthMm: 60,
      heightMm: 40,
      objects: [],
      printer: {
        ...printerConfig({ speed: 6, density: 12, labelType: 'continuous', printMode: 'transfer', topOffsetMm: -2.5, mediaHandle: 'peel', backfeedMm: 3.5 }),
        saveAsDefault: true
      }
    })
    expect(document.printer?.speed).toBe(6)
    expect(document.printer?.density).toBe(12)
    expect(document.printer?.printMode).toBe('transfer')
    expect(document.printer?.labelType).toBe('continuous')
    expect(document.printer?.topOffsetMm).toBe(-2.5)
    expect(document.printer?.mediaHandle).toBe('peel')
    expect(document.printer?.backfeedMm).toBe(3.5)
    expect(document.printer?.saveAsDefault).toBe(true)
  })
})
