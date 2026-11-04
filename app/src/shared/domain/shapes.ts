/**
 * 图形对象的统一形状目录与路径生成。
 *
 * 画布渲染（fabricObjects）、拖拽预览（LabelEditor）、打印位图（bitmapSource 走
 * fabricObjects）以及图形选择面板共用这里的几何，避免几处各画一套。
 *
 * 路径坐标以对象框左上角为原点，单位与调用方一致（画布传像素、打印传毫米）。
 */

export type RectShape =
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'roundRect'
  | 'rectNotchX'
  | 'rectChamfer'
  | 'rectHBars'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'semicircle'
  | 'quarterCircle'
  | 'arch'
  | 'quarterRing'
  | 'arcQuarter'
  | 'arcSemicircle'
  | 'star4'
  | 'star5'
  | 'star6'
  | 'star8'
  | 'burst12'
  | 'burst16'
  | 'burst24'
  | 'arrowRight'
  | 'arrowDown'
  | 'arrowDouble'

export interface ShapeCategory {
  key: string
  label: string
  shapes: RectShape[]
}

export const SHAPE_CATEGORIES: readonly ShapeCategory[] = [
  { key: 'basic', label: '基本图形', shapes: ['rect', 'ellipse', 'triangle'] },
  { key: 'quad', label: '四边形', shapes: ['roundRect', 'rectNotchX', 'rectChamfer', 'rectHBars'] },
  { key: 'polygon', label: '多边形', shapes: ['diamond', 'pentagon', 'hexagon', 'octagon'] },
  { key: 'arc', label: '圆弧', shapes: ['semicircle', 'quarterCircle', 'arch', 'quarterRing', 'arcQuarter', 'arcSemicircle'] },
  { key: 'star', label: '星型', shapes: ['star4', 'star5', 'star6', 'star8', 'burst12', 'burst16', 'burst24'] },
  { key: 'arrow', label: '箭头', shapes: ['arrowRight', 'arrowDown', 'arrowDouble'] }
]

export const SHAPE_LABELS: Record<RectShape, string> = {
  rect: '方形',
  ellipse: '圆形',
  triangle: '三角形',
  roundRect: '圆角矩形',
  rectNotchX: '左右凹口',
  rectChamfer: '切角矩形',
  rectHBars: '侧边凸条',
  diamond: '菱形',
  pentagon: '五边形',
  hexagon: '六边形',
  octagon: '八边形',
  semicircle: '半圆',
  quarterCircle: '四分之一圆',
  arch: '拱形',
  quarterRing: '四分之一圆环',
  arcQuarter: '四分之一弧线',
  arcSemicircle: '半圆弧线',
  star4: '四角星',
  star5: '五角星',
  star6: '六角星',
  star8: '八角星',
  burst12: '十二角星',
  burst16: '十六角星',
  burst24: '二十四角星',
  arrowRight: '右箭头',
  arrowDown: '下箭头',
  arrowDouble: '双向箭头'
}

export const RECT_SHAPE_IDS: readonly RectShape[] = SHAPE_CATEGORIES.flatMap((category) => category.shapes)

const SHAPE_SET = new Set<string>(RECT_SHAPE_IDS)

export function isRectShape(value: unknown): value is RectShape {
  return typeof value === 'string' && SHAPE_SET.has(value)
}

/** 只有描边、不闭合的图形（填充无意义）。 */
export function shapeIsOpen(shape: RectShape): boolean {
  return shape === 'arcQuarter' || shape === 'arcSemicircle'
}

const f = (value: number): string => String(Number(value.toFixed(3)))

function polygon(points: Array<[number, number]>): string {
  return `${points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${f(x)} ${f(y)}`).join(' ')} Z`
}

/** 椭圆在 (0,0)-(w,h) 框内的闭合路径。 */
function ellipsePath(w: number, h: number): string {
  const rx = w / 2
  const ry = h / 2
  return `M ${f(rx)} 0 A ${f(rx)} ${f(ry)} 0 1 1 ${f(rx)} ${f(h)} A ${f(rx)} ${f(ry)} 0 1 1 ${f(rx)} 0 Z`
}

function roundRectPath(w: number, h: number, requested: number): string {
  const r = Math.min(Math.max(0, requested), Math.min(w, h) / 2)
  if (r <= 0) return polygon([[0, 0], [w, 0], [w, h], [0, h]])
  return `M ${f(r)} 0 H ${f(w - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)} V ${f(h - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)} H ${f(r)} A ${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)} V ${f(r)} A ${f(r)} ${f(r)} 0 0 1 ${f(r)} 0 Z`
}

/**
 * 把顶点集拉伸铺满 (0,0)-(w,h)。
 *
 * 正多边形/星形按外接椭圆取点时不一定会碰到四条边（如五边形底部、六边形上下、
 * 星形的左右），fabric.Path 的 width/height 就会小于模型框；`onModified` 同步所有
 * 对象时会把它们回写成更小的框，表现为「移动一个图形，另一个位置和大小也变」。
 * 统一铺满对象框后，模型框与渲染框严格一致。
 */
function fitPointsToBox(points: Array<[number, number]>, w: number, h: number): Array<[number, number]> {
  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const scaleX = maxX - minX > 1e-9 ? w / (maxX - minX) : 1
  const scaleY = maxY - minY > 1e-9 ? h / (maxY - minY) : 1
  return points.map(([x, y]) => [(x - minX) * scaleX, (y - minY) * scaleY])
}

/** 正多边形：外接椭圆半径 = 半宽/半高，首顶点按 startDeg 旋转，再拉伸铺满对象框。 */
function regularPolygonPath(w: number, h: number, sides: number, startDeg: number): string {
  const cx = w / 2
  const cy = h / 2
  const points: Array<[number, number]> = []
  for (let i = 0; i < sides; i += 1) {
    const angle = ((startDeg + (360 / sides) * i) * Math.PI) / 180
    points.push([cx + (w / 2) * Math.cos(angle), cy + (h / 2) * Math.sin(angle)])
  }
  return polygon(fitPointsToBox(points, w, h))
}

/** 星形：外顶点与内顶点交替，共 2×points 个顶点，再拉伸铺满对象框。 */
function starPath(w: number, h: number, points: number, innerRatio: number): string {
  const cx = w / 2
  const cy = h / 2
  const vertices: Array<[number, number]> = []
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + (Math.PI / points) * i
    const radius = i % 2 === 0 ? 1 : innerRatio
    vertices.push([cx + (w / 2) * radius * Math.cos(angle), cy + (h / 2) * radius * Math.sin(angle)])
  }
  return polygon(fitPointsToBox(vertices, w, h))
}

/**
 * 形状路径（SVG path `d`）。坐标原点在对象框左上角。
 * `cornerRadius` 只对 roundRect 生效，单位与 w/h 相同。
 */
export function shapePath(shape: RectShape, width: number, height: number, cornerRadius = 0): string {
  const w = Math.max(0.01, width)
  const h = Math.max(0.01, height)
  const cx = w / 2
  const cy = h / 2
  switch (shape) {
    case 'rect':
      return polygon([[0, 0], [w, 0], [w, h], [0, h]])
    case 'ellipse':
      return ellipsePath(w, h)
    case 'triangle':
      return polygon([[cx, 0], [w, h], [0, h]])
    case 'roundRect':
      return roundRectPath(w, h, cornerRadius)
    case 'rectNotchX': {
      const r = Math.max(0.001, Math.min(Math.min(w, h) * 0.18, h / 2 - 0.01, w / 2 - 0.01))
      return `M 0 0 H ${f(w)} V ${f(cy - r)} A ${f(r)} ${f(r)} 0 0 0 ${f(w)} ${f(cy + r)} V ${f(h)} H 0 V ${f(cy + r)} A ${f(r)} ${f(r)} 0 0 0 0 ${f(cy - r)} Z`
    }
    case 'rectChamfer': {
      const c = Math.min(w, h) * 0.18
      return polygon([[c, 0], [w - c, 0], [w, c], [w, h - c], [w - c, h], [c, h], [0, h - c], [0, c]])
    }
    case 'rectHBars': {
      const tw = w * 0.12
      const top = h * 0.25
      const bottom = h * 0.75
      return polygon([[0, 0], [tw, 0], [tw, top], [w - tw, top], [w - tw, 0], [w, 0], [w, h], [w - tw, h], [w - tw, bottom], [tw, bottom], [tw, h], [0, h]])
    }
    case 'diamond':
      return polygon([[cx, 0], [w, cy], [cx, h], [0, cy]])
    case 'pentagon':
      return regularPolygonPath(w, h, 5, -90)
    case 'hexagon':
      return regularPolygonPath(w, h, 6, 0)
    case 'octagon':
      return regularPolygonPath(w, h, 8, 22.5)
    case 'semicircle':
      return `M 0 ${f(h)} A ${f(cx)} ${f(h)} 0 0 1 ${f(w)} ${f(h)} Z`
    case 'quarterCircle':
      return `M 0 ${f(h)} V 0 A ${f(w)} ${f(h)} 0 0 1 ${f(w)} ${f(h)} Z`
    case 'arch': {
      const t = Math.min(cx, h) * 0.22
      return `M 0 ${f(h)} A ${f(cx)} ${f(h)} 0 0 1 ${f(w)} ${f(h)} L ${f(w - t)} ${f(h)} A ${f(cx - t)} ${f(h - t)} 0 0 0 ${f(t)} ${f(h)} Z`
    }
    case 'quarterRing': {
      const t = Math.min(cx, h) * 0.22
      return `M 0 0 A ${f(w)} ${f(h)} 0 0 1 ${f(w)} ${f(h)} L ${f(w - t)} ${f(h)} A ${f(w - t)} ${f(h - t)} 0 0 0 0 ${f(t)} Z`
    }
    case 'arcQuarter':
      return `M 0 0 A ${f(w)} ${f(h)} 0 0 1 ${f(w)} ${f(h)}`
    case 'arcSemicircle':
      return `M 0 ${f(h)} A ${f(cx)} ${f(h)} 0 0 1 ${f(w)} ${f(h)}`
    case 'star4':
      return starPath(w, h, 4, 0.34)
    case 'star5':
      return starPath(w, h, 5, 0.382)
    case 'star6':
      return starPath(w, h, 6, 0.52)
    case 'star8':
      return starPath(w, h, 8, 0.52)
    case 'burst12':
      return starPath(w, h, 12, 0.66)
    case 'burst16':
      return starPath(w, h, 16, 0.74)
    case 'burst24':
      return starPath(w, h, 24, 0.82)
    case 'arrowRight':
      return polygon([[0, h * 0.3], [w * 0.65, h * 0.3], [w * 0.65, 0], [w, cy], [w * 0.65, h], [w * 0.65, h * 0.7], [0, h * 0.7]])
    case 'arrowDown':
      return polygon([[w * 0.3, 0], [w * 0.3, h * 0.65], [0, h * 0.65], [cx, h], [w, h * 0.65], [w * 0.7, h * 0.65], [w * 0.7, 0]])
    case 'arrowDouble':
      return polygon([[0, cy], [w * 0.3, 0], [w * 0.3, h * 0.3], [w * 0.7, h * 0.3], [w * 0.7, 0], [w, cy], [w * 0.7, h], [w * 0.7, h * 0.7], [w * 0.3, h * 0.7], [w * 0.3, h]])
  }
}
