import { describe, expect, it } from 'vitest'
import { geometryEditable, paperFromLayout } from '@/features/label-formats/templateGeometry'
import { holeSelectionOf } from '@/dialogs/paperHoleFields'

describe('template properties geometry', () => {
  it('makes preset geometry read-only and custom geometry editable', () => {
    expect(geometryEditable('preset')).toBe(false)
    expect(geometryEditable('custom')).toBe(true)
    expect(geometryEditable(undefined)).toBe(true)
  })

  it('rehydrates paper geometry from the document layout', () => {
    const paper = paperFromLayout({
      rows: 1,
      cols: 2,
      rowGapMm: 2,
      colGapMm: 2,
      shape: 'roundRect',
      innerShape: 'rectangle',
      innerDiameterMm: 6,
      labelColor: '#abcdef'
    })
    expect(paper).toMatchObject({
      shape: 'roundRect',
      innerShape: 'rectangle',
      innerDiameterMm: 6,
      labelColor: '#abcdef'
    })
    expect(holeSelectionOf(paper, 40, 30)).toBe('rectangle')
  })

  it('defaults a missing layout to a plain rectangle', () => {
    expect(paperFromLayout(undefined)).toEqual({ shape: 'rect' })
  })
})
