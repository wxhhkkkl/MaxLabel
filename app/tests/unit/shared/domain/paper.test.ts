import { describe, expect, it } from 'vitest'
import {
  ROUND_RECT_RADIUS_MM,
  normalizeLabelColor,
  paperPath,
  roundRectRadiusMm
} from '@shared/domain/paper'
import {
  holeSelectionOf,
  maxHoleSizeMm,
  withHoleSelection,
  withHoleSize
} from '@/dialogs/paperHoleFields'
import { SAMPLE_LABEL_SIZE, paperWith, subpathCount } from '../../../helpers/paper'

const { widthMm, heightMm } = SAMPLE_LABEL_SIZE

describe('paper geometry', () => {
  it('draws a plain rectangle without a hole', () => {
    const path = paperPath(widthMm, heightMm, paperWith())
    expect(path).toContain('M 0 0 H 40 V 30 H 0 Z')
    expect(subpathCount(path)).toBe(1)
  })

  it('uses the fixed 原版 round-rectangle radius and clamps explicit radii', () => {
    expect(ROUND_RECT_RADIUS_MM).toBe(1)
    expect(roundRectRadiusMm(widthMm, heightMm)).toBe(1)
    expect(roundRectRadiusMm(widthMm, heightMm, 100)).toBe(15)
    expect(paperPath(widthMm, heightMm, { shape: 'roundRect' })).toContain('A 1 1')
  })

  it('draws an ellipse and centres a hole', () => {
    const ellipse = paperPath(widthMm, heightMm, { shape: 'ellipse' })
    expect(ellipse).toContain('A 20 15')
    expect(subpathCount(ellipse)).toBe(1)

    const hole = paperPath(widthMm, heightMm, { shape: 'rect', innerDiameterMm: 6 })
    expect(hole).toContain('M 17 15 A 3 3')
    expect(subpathCount(hole)).toBe(2)
  })

  it('draws a rectangular hole as a centred square', () => {
    const path = paperPath(widthMm, heightMm, { shape: 'rect', innerDiameterMm: 6, innerShape: 'rectangle' })
    expect(path).toContain('M 17 12 H 23 V 18 H 17 Z')
    expect(subpathCount(path)).toBe(2)
  })

  it('clamps the hole to the short side minus 0.02 mm', () => {
    expect(maxHoleSizeMm(widthMm, heightMm)).toBe(29.98)
    expect(withHoleSelection({}, 'circle', 100, widthMm, heightMm).innerDiameterMm).toBe(29.98)
    expect(withHoleSelection({}, 'none', 6, widthMm, heightMm).innerDiameterMm).toBe(0)
  })

  it('keeps an explicit rectangle selection when the hole size is zero', () => {
    expect(holeSelectionOf({ innerShape: 'rectangle', innerDiameterMm: 0 }, widthMm, heightMm)).toBe('rectangle')
    expect(holeSelectionOf({ innerDiameterMm: 6 }, widthMm, heightMm)).toBe('circle')
    expect(holeSelectionOf({}, widthMm, heightMm)).toBe('none')
  })

  it('keeps the selected shape when updating the hole size', () => {
    expect(withHoleSize({ innerShape: 'rectangle' }, 8, widthMm, heightMm)).toMatchObject({ innerShape: 'rectangle', innerDiameterMm: 8 })
  })

  it('normalizes the label colour to lowercase #rrggbb', () => {
    expect(normalizeLabelColor('#ABCDEF')).toBe('#abcdef')
    expect(normalizeLabelColor('red')).toBe('#ffffff')
    expect(normalizeLabelColor(undefined)).toBe('#ffffff')
  })
})
