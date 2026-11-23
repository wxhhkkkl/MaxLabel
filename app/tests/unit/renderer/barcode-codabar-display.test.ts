import { describe, expect, it } from 'vitest'
import { clampBarcodeHumanTextStyle, displayBarcodeText, resolveBarcode } from '@/editor/barcode'

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

describe('UPC-E 内容规范化', () => {
  it('6 位内容按 UPC-E 规范补前导 0，避免编码器拒绝', () => {
    expect(resolveBarcode('upce', '232485', {}).text).toBe('0232485')
  })

  it('7/8 位内容保持原样', () => {
    expect(resolveBarcode('upce', '0232485', {}).text).toBe('0232485')
    expect(resolveBarcode('upce', '1234567', {}).text).toBe('1234567')
  })

  it('其它码制不受影响', () => {
    expect(resolveBarcode('code128', '232485', {}).text).toBe('232485')
  })
})

describe('条码 HRI 字号保护', () => {
  it('85pt 的 HRI 字体会压到对象框宽度以内，避免画布超限', () => {
    const style = clampBarcodeHumanTextStyle({ fontSize: 30 }, 'CANCEL0002', 57.6)
    expect(style.fontSize).toBeGreaterThan(5)
    expect(style.fontSize).toBeLessThan(10)
  })

  it('正常字号不变', () => {
    const style = clampBarcodeHumanTextStyle({ fontSize: 3 }, 'ABC', 50)
    expect(style.fontSize).toBe(3)
  })
})

describe('Code 39 内容规范化', () => {
  it('小写内容按 Code 39 规范转大写后编码', () => {
    expect(resolveBarcode('code39', 'abc123456789', {}).text).toBe('ABC123456789')
  })

  it('其它码制不受影响', () => {
    expect(resolveBarcode('code128', 'abc123', {}).text).toBe('abc123')
  })
})
