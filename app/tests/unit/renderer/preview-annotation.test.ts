import { describe, expect, it } from 'vitest'
import { ANNOTATION_FONT_RATIO, annotationFontSize, previewAnnotationLayout, previewScale } from '@/dialogs/previewAnnotation'

describe('preview annotation sizing', () => {
  it('computes the viewBox-to-pixel scale', () => {
    expect(previewScale(430, 345, 430, 345)).toBe(1)
    expect(previewScale(860, 690, 430, 345)).toBe(0.5)
  })

  it('clamps the rendered font size to 9–17 px and keeps the ratio', () => {
    expect(ANNOTATION_FONT_RATIO).toBe(0.12)
    expect(annotationFontSize(10, 1)).toBe(9)
    expect(annotationFontSize(100, 1)).toBe(12)
    expect(annotationFontSize(200, 1)).toBe(17)
    expect(annotationFontSize(100, 2)).toBe(8.5)
  })

  it('reserves a readable margin around the grid', () => {
    const layout = previewAnnotationLayout(200, 280, 430, 345, 70)
    const renderedPx = layout.font * layout.scale
    expect(renderedPx).toBeGreaterThanOrEqual(9)
    expect(renderedPx).toBeLessThanOrEqual(17)
    expect(layout.margin).toBeGreaterThanOrEqual(3)
    expect(layout.scale).toBeGreaterThan(0)
  })
})
