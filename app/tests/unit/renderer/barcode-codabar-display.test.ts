import { describe, expect, it } from 'vitest'
import { displayBarcodeText, resolveBarcode } from '@/editor/barcode'

describe('CodaBar 起始符/终止符显示', () => {
  it('默认在供人识读文字里显示起始符/终止符', () => {
    const resolved = resolveBarcode('codabar', '1234', {})
    expect(resolved.text).toBe('A1234B')
    expect(displayBarcodeText('codabar', resolved.text, {})).toBe('A1234B')
  })

  it('关闭显示后只隐藏文字，编码仍带起始符/终止符', () => {
    const options = { codabarShowStartStop: false, codabarStart: 'c' as const, codabarStop: 'd' as const }
    const resolved = resolveBarcode('codabar', '1234', options)
    expect(resolved.text).toBe('C1234D')
    expect(displayBarcodeText('codabar', resolved.text, options)).toBe('1234')
  })

  it('其它码制不受该选项影响', () => {
    expect(displayBarcodeText('code128', 'ABC', { codabarShowStartStop: false })).toBe('ABC')
  })
})
