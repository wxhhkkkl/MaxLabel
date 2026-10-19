import { describe, expect, it } from 'vitest'
import { buildDriverPrintHtml } from '@main/printing/driverPrintHtml'

const svg = (id: string): string => `<svg xmlns="http://www.w3.org/2000/svg" id="${id}"><text>${id}</text></svg>`

describe('driver print HTML', () => {
  it('expands copies across mixed vector and raster pages in A,A,B,B order', () => {
    const { html } = buildDriverPrintHtml(
      [
        { svg: svg('a'), copies: 2 },
        { dataUrl: 'file:///tmp/page.png', copies: 1 },
        { svg: svg('b'), copies: 1 }
      ],
      60,
      40
    )
    const positions = [html.indexOf('id="a"'), html.indexOf('file:///tmp/page.png'), html.indexOf('id="b"')]
    const secondA = html.indexOf('id="a"', positions[0] + 1)
    expect(positions.every((position) => position >= 0)).toBe(true)
    expect(secondA).toBeGreaterThan(positions[0])
    expect(secondA).toBeLessThan(positions[1])
    expect(positions[1]).toBeLessThan(positions[2])
  })

  it('inlines vector pages and keeps raster pages as images', () => {
    const { html } = buildDriverPrintHtml(
      [
        { svg: svg('vector'), copies: 1 },
        { dataUrl: 'file:///tmp/raster.png', copies: 1 }
      ],
      60,
      40
    )
    expect(html).toContain('<div class="page"><svg')
    expect(html).toContain('<img src="file:///tmp/raster.png"')
    expect(html).not.toContain('<img src="<svg')
  })

  it('emits mm page sizing, copy CSS and a restrictive CSP', () => {
    const { html, copies } = buildDriverPrintHtml([{ svg: svg('a'), copies: 1 }], 60, 40)
    expect(copies).toBe(1)
    expect(html).toContain('@page{size:60mm 40mm;margin:0}')
    expect(html).toContain('.page>svg{display:block;width:60mm;height:40mm}')
    expect(html).toContain('page-break-after:always')
    expect(html).toContain("script-src 'none'")
    expect(html).toContain("object-src 'none'")
    expect(html).toContain("img-src data: file:")
  })

  it('escapes raster URLs', () => {
    const { html } = buildDriverPrintHtml([{ dataUrl: 'file:///tmp/a&b".png', copies: 1 }], 60, 40)
    expect(html).toContain('src="file:///tmp/a&amp;b&quot;.png"')
  })

  it('rejects an oversized physical page count', () => {
    expect(() => buildDriverPrintHtml([{ svg: svg('a'), copies: 1_000_001 }], 60, 40)).toThrow(/超过限制/)
  })
})
