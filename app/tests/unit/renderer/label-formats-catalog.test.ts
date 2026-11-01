import { describe, expect, it } from 'vitest'
import { BANNER_FORMATS } from '@shared/domain/labelFormats.banner'
import { LABEL_FORMATS } from '@shared/domain/labelFormats.generated'
import {
  ALL_LABEL_FORMATS,
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
    // 条幅/飘带是独立介质，不混在卷筒/平张目录里
    expect(roll.length + sheet.length).toBe(ALL_LABEL_FORMATS.length - BANNER_FORMATS.length)
    expect(roll.every((format) => format.type === 0)).toBe(true)
    expect(sheet.every((format) => format.type === 1)).toBe(true)
  })

  it('keeps brand and category ordering from the catalog', () => {
    const sheet = formatsByMedia(1)
    expect(distinctBrands(sheet).map((brand) => brand.id)).toEqual([1, 2])
    expect(distinctCategories(ALL_LABEL_FORMATS)).toHaveLength(18)
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

/** 2026-10-28：品牌数据已整体改名，格式库里不应再有旧品牌名。 */
describe('格式库品牌数据', () => {
  it('不再含旧品牌名', () => {
    // 用码点拼出旧品牌名，避免在源码里再出现这两个字。
    const legacyBrand = String.fromCharCode(0x4e91, 0x9a6c)
    for (const format of LABEL_FORMATS) {
      expect(format.brandName).not.toContain(legacyBrand)
      expect(format.categoryName).not.toContain(legacyBrand)
      expect(format.productNote ?? '').not.toContain(legacyBrand)
    }
  })

  it('平张品牌的标签类型显示为「宸发优质打印纸标签」', () => {
    const sheet = catalogSelection(1, 1, 7, '608053')
    expect(sheet.selected.categoryName).toBe('宸发优质打印纸标签')
    expect(sheet.brands.some((b) => b.name === '宸发标签')).toBe(true)
  })
})

describe('条幅 / 飘带分类', () => {
  const banner = ALL_LABEL_FORMATS.filter((format) => format.categoryName === '条幅/飘带')

  it('卷筒下有一个「条幅/飘带」分类，含四种规格', () => {
    expect(banner).toHaveLength(4)
    expect(banner.every((format) => format.type === 0)).toBe(true)
    expect(banner.map((format) => format.name)).toEqual([
      '水平排列 100mm×1000mm 单条',
      '水平排列 100mm×1000mm 双条',
      '垂直排列 1000mm×100mm 单条',
      '垂直排列 1000mm×100mm 双条'
    ])
  })

  it('单条一列一行，双条按排列方向加一排 / 一列，纸面随之变宽或变高', () => {
    const [hSingle, hDouble, vSingle, vDouble] = banner
    expect([hSingle.labelWidthMm, hSingle.labelHeightMm, hSingle.cols, hSingle.rows]).toEqual([100, 1000, 1, 1])
    expect([hDouble.labelWidthMm, hDouble.labelHeightMm, hDouble.cols, hDouble.rows]).toEqual([100, 1000, 2, 1])
    expect([vSingle.labelWidthMm, vSingle.labelHeightMm, vSingle.cols, vSingle.rows]).toEqual([1000, 100, 1, 1])
    expect([vDouble.labelWidthMm, vDouble.labelHeightMm, vDouble.cols, vDouble.rows]).toEqual([1000, 100, 1, 2])
    // 纸面 = 标签 + 间隙
    expect(hDouble.pageWidthMm).toBeGreaterThan(hSingle.pageWidthMm)
    expect(vDouble.pageHeightMm).toBeGreaterThan(vSingle.pageHeightMm)
  })

  it('是独立介质：不在卷筒目录里，卷筒的类型列表也不含它', () => {
    expect(formatsByMedia(0).some((format) => format.categoryName === '条幅/飘带')).toBe(false)
    expect(distinctCategories(formatsByMedia(0)).map((category) => category.name)).not.toContain('条幅/飘带')
    expect(BANNER_FORMATS).toHaveLength(4)
  })
})
