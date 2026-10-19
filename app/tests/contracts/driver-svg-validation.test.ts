import { describe, expect, it } from 'vitest'
import { validateDriverSvgPage } from '@shared/print/driverSvg'
import { validatePrintPayload } from '@main/ipc/validation'

const svg = (body = ''): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="40mm" viewBox="0 0 600 400">${body}</svg>`

describe('driver SVG page validation', () => {
  it('accepts Fabric-style vector markup with data images', () => {
    const page = svg(
      '<rect x="0" y="0" width="600" height="400" fill="#ffffff"/>' +
        '<text x="10" y="30" font-family="Arial" font-size="24">VECTOR</text>' +
        '<path d="M0 0 L10 10" stroke="#000" fill="none"/>' +
        '<image x="20" y="20" width="50" height="50" href="data:image/png;base64,AA=="/>'
    )
    expect(validateDriverSvgPage(page)).toBe(page)
  })

  it('accepts nested bwip-style SVG fragments with anchors', () => {
    const page = svg(
      '<g transform="translate(10 10)">' +
        '<svg width="100" height="80" viewBox="0 0 100 80">' +
        '<defs><clipPath id="ml1_clip"><rect width="100" height="80"/></clipPath></defs>' +
        '<g clip-path="url(#ml1_clip)"><path d="M0 0 L1 1" fill="url(#ml1_gradient)"/></g>' +
        '</svg></g>'
    )
    expect(validateDriverSvgPage(page)).toBe(page)
  })

  it('rejects markup that is not a single svg root', () => {
    expect(() => validateDriverSvgPage('not svg')).toThrow(/矢量/)
    expect(() => validateDriverSvgPage('<svg></svg><svg></svg>')).toThrow(/矢量/)
    expect(() => validateDriverSvgPage('<?xml version="1.0"?><svg></svg>')).toThrow(/矢量/)
    expect(() => validateDriverSvgPage('<!DOCTYPE svg><svg></svg>')).toThrow(/矢量/)
    expect(() => validateDriverSvgPage('<svg><!-- comment --></svg>')).toThrow(/矢量/)
    expect(() => validateDriverSvgPage('<svg><![CDATA[x]]></svg>')).toThrow(/矢量/)
  })

  it('rejects scripts, foreign content and executable tags', () => {
    for (const body of [
      '<script>alert(1)</script>',
      '<foreignObject><div>x</div></foreignObject>',
      '<iframe src="https://example.com"/>',
      '<object data="x"/>',
      '<embed src="x"/>',
      '<use href="#x"/>',
      '<style>rect{fill:red}</style>',
      '<animate attributeName="x"/>',
      '<set attributeName="x"/>',
      '<handler type="x"/>'
    ]) {
      expect(() => validateDriverSvgPage(svg(body)), body).toThrow(/矢量/)
    }
  })

  it('rejects event handler and dangerous href/style values', () => {
    for (const body of [
      '<rect onload="alert(1)"/>',
      '<rect onclick="alert(1)"/>',
      '<image href="https://example.com/x.png"/>',
      '<image href="file:///C:/x.png"/>',
      '<image href="javascript:alert(1)"/>',
      '<image href="data:text/html;base64,AA=="/>',
      '<rect fill="url(https://example.com/x)"/>',
      '<rect style="fill:url(https://example.com/x)"/>',
      '<rect style="behavior:url(#x)"/>'
    ]) {
      expect(() => validateDriverSvgPage(svg(body)), body).toThrow(/矢量/)
    }
  })

  it('enforces the per-page byte cap', () => {
    const page = svg('<rect width="1" height="1"/>')
    expect(validateDriverSvgPage(page, 200)).toBe(page)
    expect(() => validateDriverSvgPage(page, 20)).toThrow(/矢量/)
  })

  it('accepts SVG pages through the print payload with copies and printerName', () => {
    const vector = svg('<text>hello</text>')
    const raster = 'data:image/png;base64,AA=='
    const result = validatePrintPayload({
      pages: [{ svg: vector, copies: 2 }, { dataUrl: raster }],
      widthMm: 60,
      heightMm: 40,
      printerName: 'Zenpert 4T530'
    })
    expect(result.pages).toHaveLength(2)
    expect(result.pages[0]).toMatchObject({ svg: vector, copies: 2 })
    expect(result.pages[1]).toMatchObject({ dataUrl: raster, copies: 1 })
    expect(result.printerName).toBe('Zenpert 4T530')
  })

  it('rejects pages with both or neither encoding', () => {
    const vector = svg('<text>hello</text>')
    const raster = 'data:image/png;base64,AA=='
    expect(() => validatePrintPayload({ pages: [{ svg: vector, dataUrl: raster }], widthMm: 60, heightMm: 40 })).toThrow(/矢量|数据/)
    expect(() => validatePrintPayload({ pages: [{}], widthMm: 60, heightMm: 40 })).toThrow(/数据|图片/)
  })
})
