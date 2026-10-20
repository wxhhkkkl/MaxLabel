import { describe, expect, it } from 'vitest'
import type { LabelFormatSelection } from '@/dialogs/NewLabelDialog'
import { applyLabelFormatToDoc } from '@/features/label-formats/applyFormat'
import { customLayoutDoc } from '../../helpers/labelFormats'

const defaults = { rows: 1, cols: 1, rowGapMm: 2, colGapMm: 2, labelShape: 'rect' as const }

function selection(overrides: Partial<LabelFormatSelection> = {}): LabelFormatSelection {
  return {
    rows: 4,
    cols: 2,
    rowGapMm: 2,
    colGapMm: 2,
    pagesPerBox: 20,
    formatKind: 'preset',
    formatCode: '608053',
    pageWidthMm: 210,
    pageHeightMm: 297,
    ...overrides
  }
}

describe('new label selection → document mapping', () => {
  it('writes the preset geometry and formatKind without persisting the format code', () => {
    const doc = customLayoutDoc({ layout: undefined, formatKind: undefined })
    const next = applyLabelFormatToDoc(doc, selection(), { shape: 'roundRect' }, defaults)

    expect(next.formatKind).toBe('preset')
    expect(next.layout).toMatchObject({
      rows: 4,
      cols: 2,
      rowGapMm: 2,
      colGapMm: 2,
      pageWidthMm: 210,
      pageHeightMm: 297,
      pagesPerBox: 20,
      shape: 'roundRect'
    })
    expect(JSON.stringify(next)).not.toContain('608053')
    expect((next as { formatCode?: string }).formatCode).toBeUndefined()
  })

  it('uses system defaults when no preset was selected', () => {
    const doc = customLayoutDoc({ layout: undefined, formatKind: undefined })
    const next = applyLabelFormatToDoc(doc, undefined, undefined, { ...defaults, rows: 2, cols: 3, labelShape: 'ellipse' })

    expect(next.formatKind).toBe('custom')
    expect(next.layout).toMatchObject({ rows: 2, cols: 3, shape: 'ellipse', rowGapMm: 2, colGapMm: 2 })
    expect(next.layout?.pageWidthMm).toBeUndefined()
  })

  it('keeps paper geometry fields supplied by the dialog', () => {
    const doc = customLayoutDoc({ layout: undefined, formatKind: undefined })
    const next = applyLabelFormatToDoc(
      doc,
      selection({ pagesPerBox: undefined }),
      { shape: 'ellipse', innerShape: 'rectangle', innerDiameterMm: 6, labelColor: '#ffffff' },
      defaults
    )

    expect(next.layout).toMatchObject({
      shape: 'ellipse',
      innerShape: 'rectangle',
      innerDiameterMm: 6,
      labelColor: '#ffffff'
    })
    expect(next.layout?.pagesPerBox).toBeUndefined()
  })
})
