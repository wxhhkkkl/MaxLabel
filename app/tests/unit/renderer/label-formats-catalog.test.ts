import { describe, expect, it } from 'vitest'
import { LABEL_FORMATS } from '@shared/domain/labelFormats.generated'
import {
  DEFAULT_FORMAT_CODE,
  catalogSelection,
  distinctBrands,
  distinctCategories,
  formatsByMedia,
  nextFormatForMedia
} from '@/features/label-formats/catalog'

describe('label-format catalog queries', () => {
  it('filters the catalog by media type', () => {
    const roll = formatsByMedia(0)
    const sheet = formatsByMedia(1)
    expect(roll.length + sheet.length).toBe(LABEL_FORMATS.length)
    expect(roll.every((format) => format.type === 0)).toBe(true)
    expect(sheet.every((format) => format.type === 1)).toBe(true)
  })

  it('keeps brand and category ordering from the catalog', () => {
    const sheet = formatsByMedia(1)
    expect(distinctBrands(sheet).map((brand) => brand.id)).toEqual([1, 2])
    expect(distinctCategories(LABEL_FORMATS)).toHaveLength(17)
  })

  it('defaults to 608053 for sheet media and to the first roll format otherwise', () => {
    expect(nextFormatForMedia(1).code).toBe(DEFAULT_FORMAT_CODE)
    expect(nextFormatForMedia(0).type).toBe(0)
  })

  it('returns the requested format when it belongs to the selected media type', () => {
    const defaultFormat = nextFormatForMedia(1)
    const selection = catalogSelection(1, defaultFormat.brandId, defaultFormat.categoryId, DEFAULT_FORMAT_CODE)
    expect(selection.selected.code).toBe(DEFAULT_FORMAT_CODE)
    expect(selection.available.every((format) => format.type === 1)).toBe(true)
    expect(selection.categories.length).toBeGreaterThan(0)
  })

  it('falls back to the first category format for an unknown code', () => {
    const defaultFormat = nextFormatForMedia(1)
    const selection = catalogSelection(1, defaultFormat.brandId, defaultFormat.categoryId, 'does-not-exist')
    expect(selection.selected.code).toBe(selection.categoryFormats[0].code)
  })

  it('falls back to the first format of the media type when the brand is unknown', () => {
    const selection = catalogSelection(1, 9999, 9999, 'does-not-exist')
    expect(selection.selected.type).toBe(1)
    expect(selection.available).toContain(selection.selected)
  })
})
