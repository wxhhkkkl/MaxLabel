import { LABEL_FORMATS, type LabelFormatRecord } from '../../../../shared/domain/labelFormats.generated'

/** Default sheet format documented by the as-is spec. */
export const DEFAULT_FORMAT_CODE = '608053'

export interface CatalogBrand {
  id: number
  name: string
}

export interface CatalogCategory {
  id: number
  name: string
}

export interface CatalogSelection {
  available: LabelFormatRecord[]
  brands: CatalogBrand[]
  brandFormats: LabelFormatRecord[]
  categories: CatalogCategory[]
  categoryFormats: LabelFormatRecord[]
  selected: LabelFormatRecord
}

export function formatsByMedia(mediaType: 0 | 1): LabelFormatRecord[] {
  return LABEL_FORMATS.filter((format) => format.type === mediaType)
}

export function distinctBrands(formats: readonly LabelFormatRecord[]): CatalogBrand[] {
  const seen = new Set<number>()
  return formats.filter((format) => {
    if (seen.has(format.brandId)) return false
    seen.add(format.brandId)
    return true
  }).map((format) => ({ id: format.brandId, name: format.brandName }))
}

export function distinctCategories(formats: readonly LabelFormatRecord[]): CatalogCategory[] {
  const seen = new Set<number>()
  return formats.filter((format) => {
    if (seen.has(format.categoryId)) return false
    seen.add(format.categoryId)
    return true
  }).map((format) => ({ id: format.categoryId, name: format.categoryName }))
}

/** The format selected when the media type changes (or when nothing else matches). */
export function nextFormatForMedia(mediaType: 0 | 1): LabelFormatRecord {
  const available = formatsByMedia(mediaType)
  return available.find((format) => format.code === DEFAULT_FORMAT_CODE)
    ?? available[0]
    ?? LABEL_FORMATS[0]
}

/**
 * Resolve the catalog lists and the selected record. Unknown brand/category/code values
 * fall back in the same order as the dialog: available → category first → media default.
 */
export function catalogSelection(
  mediaType: 0 | 1,
  brandId: number,
  categoryId: number,
  formatCode: string
): CatalogSelection {
  const available = formatsByMedia(mediaType)
  const brands = distinctBrands(available)
  const brandFormats = available.filter((format) => format.brandId === brandId)
  const categories = distinctCategories(brandFormats)
  const categoryFormats = brandFormats.filter((format) => format.categoryId === categoryId)
  const selected = available.find((format) => format.code === formatCode)
    ?? categoryFormats[0]
    ?? brandFormats[0]
    ?? available[0]
    ?? nextFormatForMedia(mediaType)
  return { available, brands, brandFormats, categories, categoryFormats, selected }
}
