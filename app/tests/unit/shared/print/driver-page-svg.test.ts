import { describe, expect, it } from 'vitest'
import { composePageSvg } from '@shared/print/pageSvg'

const fabricSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="40mm" viewBox="0 0 600 400"><desc>x</desc><defs></defs><g><rect x="1" y="1" width="2" height="2"/></g></svg>'

describe('composePageSvg', () => {
  it('inserts an evenodd cell clip into defs and wraps the page content', () => {
    const result = composePageSvg(fabricSvg, [{ x: 0, y: 0, widthMm: 60, heightMm: 40 }], {}, 'rect', 600, 400, 'test-clip')
    expect(result).toContain(
      '<clipPath id="test-clip" clipPathUnits="userSpaceOnUse"><path d="M 0 0 H 60 V 40 H 0 Z" clip-rule="evenodd" transform="translate(0 0) scale(10)"/></clipPath></defs>'
    )
    expect(result.indexOf('</defs>')).toBeLessThan(result.indexOf('<rect x="0" y="0" width="600" height="400" fill="#ffffff"/>'))
    expect(result).toContain('<g clip-path="url(#test-clip)"><g><rect')
    expect(result.endsWith('</g></svg>')).toBe(true)
  })

  it('emits one clip path per cell with cell offsets', () => {
    const result = composePageSvg(
      fabricSvg,
      [
        { x: 0, y: 0, widthMm: 30, heightMm: 40 },
        { x: 30, y: 0, widthMm: 30, heightMm: 40 }
      ],
      {},
      'rect',
      600,
      400,
      'clip'
    )
    expect((result.match(/clip-rule="evenodd"/g) ?? []).length).toBe(2)
    expect(result).toContain('transform="translate(0 0) scale(10)"')
    expect(result).toContain('transform="translate(300 0) scale(10)"')
  })

  it('keeps the paper hole path for a disc with an inner hole', () => {
    const result = composePageSvg(fabricSvg, [{ x: 0, y: 0, widthMm: 60, heightMm: 40 }], { shape: 'disc', innerDiameterMm: 10 }, 'disc', 600, 400, 'clip')
    expect(result).toContain('clip-rule="evenodd"')
    expect((result.match(/ A /g) ?? []).length).toBeGreaterThan(0)
  })
})
