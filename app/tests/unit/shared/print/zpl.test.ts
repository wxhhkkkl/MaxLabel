import { describe, expect, it } from 'vitest'
import type { PrinterConfig } from '@shared/domain/printer'
import { buildCommands } from '@shared/print/engine'
import { attachSceneHumanTextBitmaps, resolvePrintScene } from '@shared/print/scene'
import { buildZPL } from '@shared/print/zpl'
import { dataCtx, printerConfig, sampleDoc, tinyMono } from '../../../helpers/factories'

function zpl(overrides: Partial<PrinterConfig> = {}) {
  return buildCommands(sampleDoc(), printerConfig({ driver: 'zpl', port: { type: 'file', encoding: 'utf8' }, ...overrides }), {
    count: 1,
    copy: 1,
    title: '测试',
    datasets: {}
  }).text
}

describe('ZPL command output', () => {
  it('overlays the canvas HRI bitmap instead of the firmware font', () => {
    const scene = attachSceneHumanTextBitmaps(resolvePrintScene(sampleDoc(), dataCtx()), new Map([
      ['1:3', { bitmap: { ...tinyMono(32, 16), originXMm: 8, originYMm: 24 } }]
    ]))
    const text = buildZPL(scene, printerConfig({ driver: 'zpl', dpi: 203 }), [])
    // 固件人读文字关闭（^BC...,N），HRI 以 ^GFA 叠加在 (64,192)。
    expect(text).toMatch(/\^BCN,\d+,N,N,N/)
    expect(text).not.toMatch(/\^BCN,\d+,Y/)
    expect(text).toContain('^FO64,192^GFA')
  })

  it('wraps labels in ^XA/^XZ with width, length and quantity', () => {
    const text = zpl()
    expect(text).toContain('^XA')
    expect(text).toContain('^XZ')
    expect(text).toContain('^PW480')
    expect(text).toContain('^LL320,Y')
    expect(text).toContain('^PQ1')
  })

  it('emits barcode and field commands', () => {
    const text = zpl()
    expect(text).toContain('^BC')
    expect(text).toContain('^FD')
    expect(text).toContain('^FO')
  })

  it('prints barcode human text with a selected ZPL printer font', () => {
    const doc = sampleDoc()
    doc.objects[2] = { ...doc.objects[2], printerFont: 'B' } as (typeof doc.objects)[number]
    const text = buildCommands(doc, printerConfig({ driver: 'zpl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    }).text
    // ^BC 的人读参数关闭，另外用 ^A 输出选中字库的人读文字。
    expect(text).toMatch(/\^BCN,\d+,N,/)
    expect(text).toMatch(/\^ABN,\d+,\d+\^FH\\\^FD/)
  })

  it('selects thermal or transfer print mode', () => {
    expect(zpl({ printMode: 'thermal' })).toContain('^MTD')
    expect(zpl({ printMode: 'transfer' })).toContain('^MTT')
  })
})
