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

  it('emits numeric font names and point sizes for TSPL font 0', () => {
    const doc = sampleDoc()
    doc.objects[1] = { ...doc.objects[1], source: { kind: 'constant', value: 'ABC' } } as LabelDoc['objects'][number]
    const plain = buildCommands(doc, printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    }).text
    // 5 mm at 203 dpi ≈ 14 pt for TSPL's TrueType font "0".
    expect(plain).toContain('"0",0,14,14,0,')
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

  it('requires rasterization for diagonal lines that BAR cannot draw', () => {
    const doc = sampleDoc()
    doc.objects.push({ id: 'diag', type: 'line', x: 4, y: 34, w: 20, h: 4, rotation: 0, stroke: '#000', strokeWidth: 0.3 })
    const result = buildCommands(doc, printerConfig({ driver: 'tspl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    })
    expect(result.warningDetails.some((warning) => warning.code === 'missing-page-bitmap' && warning.severity === 'error')).toBe(true)
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
