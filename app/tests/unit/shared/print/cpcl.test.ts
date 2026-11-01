import { describe, expect, it } from 'vitest'
import { buildCommands } from '@shared/print/engine'
import { printerConfig, sampleDoc } from '../../../helpers/factories'

function cpcl() {
  return buildCommands(sampleDoc(), printerConfig({ driver: 'cpcl', port: { type: 'file', encoding: 'utf8' } }), {
    count: 1,
    copy: 1,
    title: '测试',
    datasets: {}
  }).text
}

describe('CPCL command output', () => {
  it('emits the initialization header and page width', () => {
    const text = cpcl()
    expect(text).toContain('! 0 200 200 315 1')
    expect(text).toContain('PAGE-WIDTH 472')
  })

  it('emits FORM and PRINT', () => {
    const text = cpcl()
    expect(text).toContain('FORM')
    expect(text).toContain('PRINT')
  })

  it('uses the selected CPCL printer font for barcode human text and text objects', () => {
    const doc = sampleDoc()
    doc.objects[1] = { ...doc.objects[1], printerFont: 'Font2' } as (typeof doc.objects)[number]
    doc.objects[2] = { ...doc.objects[2], printerFont: 'Font3' } as (typeof doc.objects)[number]
    const text = buildCommands(doc, printerConfig({ driver: 'cpcl', port: { type: 'file', encoding: 'utf8' } }), {
      count: 1,
      copy: 1,
      title: '测试',
      datasets: {}
    }).text
    expect(text).toContain('BARCODE-TEXT 3 0 5')
    expect(text).toMatch(/TEXT 2 0 \d+ \d+ 示例商品标签/)
  })
})
