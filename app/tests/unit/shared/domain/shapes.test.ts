import { describe, expect, it } from 'vitest'
import { RECT_SHAPE_IDS, SHAPE_CATEGORIES, SHAPE_LABELS, isRectShape, shapeIsOpen, shapePath } from '@shared/domain/shapes'

/**
 * 图形库的几何是画布、拖拽预览和打印位图共用的唯一来源：
 * 每个形状都必须能生成有效路径，开放弧线不能闭合。
 */
describe('图形库几何', () => {
  it('目录覆盖全部形状且每个形状都有标签', () => {
    expect(new Set(RECT_SHAPE_IDS).size).toBe(RECT_SHAPE_IDS.length)
    for (const id of RECT_SHAPE_IDS) {
      expect(SHAPE_LABELS[id], id).toBeTruthy()
      expect(isRectShape(id), id).toBe(true)
    }
    expect(SHAPE_CATEGORIES.flatMap((category) => category.shapes)).toEqual([...RECT_SHAPE_IDS])
  })

  it('每个形状都生成有效路径；只有开放弧线不闭合', () => {
    for (const id of RECT_SHAPE_IDS) {
      const d = shapePath(id, 40, 30, 5)
      expect(d.startsWith('M'), id).toBe(true)
      expect(d, id).not.toMatch(/NaN|undefined|Infinity/)
      expect(d.endsWith('Z'), id).toBe(!shapeIsOpen(id))
    }
  })

  it('未知形状不通过校验', () => {
    expect(isRectShape('blob')).toBe(false)
  })

  it('圆角矩形生成圆角，方形保持直角', () => {
    expect(shapePath('roundRect', 40, 40, 5)).toContain('A 5 5')
    expect(shapePath('rect', 40, 40)).not.toContain('A ')
  })

  it('多边形与星形铺满对象框（同步时不会被回写成更小的框）', () => {
    for (const id of ['pentagon', 'hexagon', 'octagon', 'star4', 'star5', 'star6', 'star8', 'burst12', 'burst24'] as const) {
      const points = [...shapePath(id, 40, 30).matchAll(/[ML] ([\d.-]+) ([\d.-]+)/g)].map((match) => [Number(match[1]), Number(match[2])])
      const xs = points.map(([x]) => x)
      const ys = points.map(([, y]) => y)
      expect(Math.min(...xs), id).toBeCloseTo(0, 3)
      expect(Math.max(...xs), id).toBeCloseTo(40, 3)
      expect(Math.min(...ys), id).toBeCloseTo(0, 3)
      expect(Math.max(...ys), id).toBeCloseTo(30, 3)
    }
  })

  it('多边形与星形的顶点数符合名称', () => {
    const vertices = (d: string) => (d.match(/[ML] /g) ?? []).length
    expect(vertices(shapePath('pentagon', 40, 40))).toBe(5)
    expect(vertices(shapePath('hexagon', 40, 40))).toBe(6)
    expect(vertices(shapePath('octagon', 40, 40))).toBe(8)
    expect(vertices(shapePath('star5', 40, 40))).toBe(10)
    expect(vertices(shapePath('star6', 40, 40))).toBe(12)
    expect(vertices(shapePath('star8', 40, 40))).toBe(16)
  })
})
