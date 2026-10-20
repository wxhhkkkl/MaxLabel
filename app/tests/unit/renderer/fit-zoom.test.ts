import { describe, expect, it } from 'vitest'
import { computeFitZoom } from '@/editor/fitZoom'

const base = {
  widthMm: 80,
  heightMm: 60,
  rotation: 0,
  availableWidthPx: 1000,
  availableHeightPx: 800
}

describe('fit zoom', () => {
  it('fits width and height with the 12 px gutter', () => {
    expect(computeFitZoom({ ...base, mode: 'w' })).toBeCloseTo(976 / 800, 6)
    expect(computeFitZoom({ ...base, mode: 'h' })).toBeCloseTo(776 / 600, 6)
    expect(computeFitZoom({ ...base, mode: 'win' })).toBeCloseTo(Math.min(976 / 800, 776 / 600), 6)
  })

  it('swaps the physical axes when the layout is rotated 90°', () => {
    expect(computeFitZoom({ ...base, mode: 'w', rotation: 90 })).toBeCloseTo(976 / 600, 6)
    expect(computeFitZoom({ ...base, mode: 'win', rotation: 270 })).toBeCloseTo(Math.min(976 / 600, 776 / 800), 6)
  })

  it('honours a custom gutter and clamps the available area to at least 1 px', () => {
    expect(computeFitZoom({ ...base, mode: 'w', gutterPx: 0 })).toBeCloseTo(1000 / 800, 6)
    expect(computeFitZoom({ ...base, mode: 'w', availableWidthPx: 10 })).toBeCloseTo(1 / 800, 6)
  })

  it('treats 180° as unrotated and 270° as sideways', () => {
    expect(computeFitZoom({ ...base, mode: 'win', rotation: 180 })).toBeCloseTo(computeFitZoom({ ...base, mode: 'win', rotation: 0 }), 6)
    expect(computeFitZoom({ ...base, mode: 'win', rotation: 270 })).toBeCloseTo(computeFitZoom({ ...base, mode: 'win', rotation: 90 }), 6)
  })
})
