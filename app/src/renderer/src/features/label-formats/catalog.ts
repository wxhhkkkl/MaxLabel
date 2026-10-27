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

/**
 * 品牌 / 类型的展示名。
 *
 * `labelFormats.generated.ts` 是从厂商 LabelFormat360.fmt 导出的历史数据，生成脚本
 * 已于 2026-10-18 随 parity 参考资料一并移除。品牌方更名为「宸发」，所以只在展示层
 * 改口径，格式库原文保持不动（原文记的是厂商当年的商品名）。
 */
export const BRAND_DISPLAY_NAMES: Record<number, string> = {
  1: '宸发标签（平张标签）',
  2: '普林泰科标签（平张标签）'
}

export const CATEGORY_DISPLAY_NAMES: Record<number, string> = {
  // 原文「云马优质打印纸标签」
  7: '宸发优质打印纸标签'
}

export function displayBrandName(id: number, name: string): string {
  return BRAND_DISPLAY_NAMES[id] ?? name
}

export function displayCategoryName(id: number, name: string): string {
  return CATEGORY_DISPLAY_NAMES[id] ?? name
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
