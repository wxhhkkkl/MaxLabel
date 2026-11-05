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

  it('maps the dialog’s page offsets (左空 / 上空) onto the document layout', () => {
    const doc = customLayoutDoc({ layout: undefined, formatKind: undefined })
    const next = applyLabelFormatToDoc(doc, selection({ pageLeftMm: 4, pageTopMm: 5.5 }), { shape: 'rect' }, defaults)
    expect(next.layout).toMatchObject({ pageLeftMm: 4, pageTopMm: 5.5 })
  })

  it('re-applying a format to an existing document keeps objects and unrelated layout fields', () => {
    const doc = customLayoutDoc({
      layout: { rows: 1, cols: 2, rowGapMm: 2, colGapMm: 2, shape: 'rect', offsetXMm: 3, printOrder: 'col' }
    })
    const next = applyLabelFormatToDoc(
      doc,
      selection({ rows: 2, cols: 1, rowGapMm: 3, colGapMm: 1, pageWidthMm: 60, pageHeightMm: 40 }),
      { shape: 'roundRect' },
      defaults
    )

    expect(next.objects).toBe(doc.objects)
    expect(next.layout).toMatchObject({
      rows: 2,
      cols: 1,
      rowGapMm: 3,
      colGapMm: 1,
      shape: 'roundRect',
      pageWidthMm: 60,
      pageHeightMm: 40,
      offsetXMm: 3,
      printOrder: 'col'
    })
  })

  it('stores the double-banner joint, media type and single page cell', () => {
    const doc = customLayoutDoc({ layout: undefined, formatKind: undefined })
    const next = applyLabelFormatToDoc(
      doc,
      selection({ mediaType: 2, rows: 1, cols: 1, pageWidthMm: 202, pageHeightMm: 1000 }),
      { shape: 'rect', jointMode: 'double', jointWidthMm: 2, jointOrientation: 'vertical' },
      defaults
    )

    expect(next.layout).toMatchObject({
      rows: 1,
      cols: 1,
      mediaType: 2,
      jointMode: 'double',
      jointWidthMm: 2,
      jointOrientation: 'vertical',
      pageWidthMm: 202,
      pageHeightMm: 1000
    })
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
