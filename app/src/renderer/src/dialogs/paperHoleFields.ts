/*
 * 「标签格式设置」两个入口（新建标签 → 自定义(N)，工具栏「标签格式设置」）共用的
 * 形状/孔洞选项与语义映射 —— 单一来源，避免「改一处漏一处」。
 *
 * 真机原文（`parity/reference/labelshop/probe-round106-custom-label-combos.txt` 逐项枚举）：
 *   形状 = 方角矩形 / 圆角矩形 / 圆形      ← 不是帮助里写的「直角矩形」（DIFF-67）
 *   孔洞 = 无 / 圆洞 / 矩形
 * 形状只有外观三档；`disc`（光盘）是早期内部值，语义等于「圆形 + 圆洞」，由
 * `PaperFields.normalizePaperShape` 归一化成 `ellipse`，不作为独立档位暴露。
 */
import type { PaperGeometry, PaperHoleShape, PaperShape } from '../../../shared/domain/paper'

/** 孔洞下拉的选中态：真机三项，未选「无」时共用一个尺寸框。 */
export type PaperHoleSelection = 'none' | PaperHoleShape

export const PAPER_SHAPE_OPTIONS: ReadonlyArray<{ value: PaperShape; label: string }> = [
  { value: 'rect', label: '方角矩形' },
  { value: 'roundRect', label: '圆角矩形' },
  { value: 'ellipse', label: '圆形' }
]

export const PAPER_HOLE_OPTIONS: ReadonlyArray<{ value: PaperHoleSelection; label: string }> = [
  { value: 'none', label: '无' },
  { value: 'circle', label: '圆洞' },
  { value: 'rectangle', label: '矩形' }
]

/**
 * 由几何反查下拉选中态。`innerShape` 缺省按历史语义当圆洞
 * （`shared/domain/paper.ts`：未指定时 = 圆洞，保证已有模板与渲染回归不变）。
 */
export function holeSelectionOf(paper: PaperGeometry, widthMm: number, heightMm: number): PaperHoleSelection {
  // `innerShape` 是**显式选择**，优先于尺寸推断：真机切到「矩形」后尺寸框显示 0.00 并保持点亮，
  // 若只看尺寸会把刚选的「矩形」立刻打回「无」。
  if (paper.innerShape) return paper.innerShape
  const size = paper.innerDiameterMm ?? (paper.shape === 'disc' ? 15 : 0)
  if (!(size > 0) || !(Math.min(widthMm, heightMm) > 0)) return 'none'
  return 'circle'
}

/** 尺寸上限：真机尺寸框的最大值取标签短边（孔不能超出标签）。 */
export function maxHoleSizeMm(widthMm: number, heightMm: number): number {
  return Math.max(0, Math.min(widthMm, heightMm) - 0.02)
}

/**
 * 切换孔洞下拉时写回几何。**一个尺寸框服务三项**（真机实测：`孔洞` 组只有一个 Edit，
 * 见 `PROBE-round107-hole-rect.md`）：
 *   - `无`       → 尺寸清零，不画孔；
 *   - `圆洞`     → 直径 = 尺寸，`innerShape` 必须复位成 `circle`（否则会残留上一次的矩形）；
 *   - `矩形`     → 边长 = 尺寸，`innerShape = 'rectangle'`。
 * 由「无」切到「圆洞/矩形」时真机把尺寸显示为 `0.00`（`probe-round107-hole-rect-values.txt`），
 * 所以这里不擅自填默认值，交给调用方传入它想给的新尺寸。
 */
export function withHoleSelection(paper: PaperGeometry, selection: PaperHoleSelection, sizeMm: number, widthMm: number, heightMm: number): PaperGeometry {
  const next = { ...paper }
  delete next.innerShape
  if (selection === 'none') return { ...next, innerDiameterMm: 0 }
  const clamped = Math.max(0, Math.min(maxHoleSizeMm(widthMm, heightMm), Number.isFinite(sizeMm) ? sizeMm : 0))
  return { ...next, innerDiameterMm: clamped, innerShape: selection }
}

/** 只改尺寸、不改孔形。 */
export function withHoleSize(paper: PaperGeometry, sizeMm: number, widthMm: number, heightMm: number): PaperGeometry {
  const selection = holeSelectionOf(paper, widthMm, heightMm)
  if (selection === 'none') return { ...paper, innerDiameterMm: 0 }
  return withHoleSelection(paper, selection, sizeMm, widthMm, heightMm)
}
