// 「新建标签」上次确认的格式（介质类型 + 标签尺寸 + 页面设置）持久化。
// 没有它，用户每次新建都要重新选卷筒、填左空/上空；确定后再打开会"恢复成没设置之前"。

import type { LabelFormatInitial } from '../../dialogs/NewLabelDialog'
import type { PaperShape } from '../../../../shared/domain/paper'

export const LAST_LABEL_FORMAT_KEY = 'maxlabel.lastLabelFormat'

const SHAPES: readonly PaperShape[] = ['rect', 'roundRect', 'ellipse']

function positive(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}

function nonNegative(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}

function positiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback
  return n >= 1 ? n : fallback
}

/** 校验并裁剪持久化内容；关键尺寸缺失时整份丢弃（回到旧行为）。 */
export function normalizeLastLabelFormat(value: unknown): LabelFormatInitial | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Record<string, unknown>
  const widthMm = positive(raw.widthMm)
  const heightMm = positive(raw.heightMm)
  if (widthMm === undefined || heightMm === undefined) return undefined
  const mediaType = raw.mediaType === 0 || raw.mediaType === 1 || raw.mediaType === 2 ? raw.mediaType : undefined
  const shape = SHAPES.includes(raw.shape as PaperShape) ? (raw.shape as PaperShape) : undefined
  return {
    widthMm,
    heightMm,
    rows: positiveInt(raw.rows, 1),
    cols: positiveInt(raw.cols, 1),
    rowGapMm: nonNegative(raw.rowGapMm) ?? 0,
    colGapMm: nonNegative(raw.colGapMm) ?? 0,
    ...(positive(raw.pagesPerBox) !== undefined ? { pagesPerBox: positive(raw.pagesPerBox) } : {}),
    ...(positive(raw.pageWidthMm) !== undefined ? { pageWidthMm: positive(raw.pageWidthMm) } : {}),
    ...(positive(raw.pageHeightMm) !== undefined ? { pageHeightMm: positive(raw.pageHeightMm) } : {}),
    ...(nonNegative(raw.pageLeftMm) !== undefined ? { pageLeftMm: nonNegative(raw.pageLeftMm) } : {}),
    ...(nonNegative(raw.pageTopMm) !== undefined ? { pageTopMm: nonNegative(raw.pageTopMm) } : {}),
    ...(shape ? { shape } : {}),
    ...(typeof raw.labelColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.labelColor) ? { labelColor: raw.labelColor } : {}),
    ...(mediaType !== undefined ? { mediaType } : {})
  }
}

export function readLastLabelFormat(): LabelFormatInitial | undefined {
  try {
    const raw = localStorage.getItem(LAST_LABEL_FORMAT_KEY)
    return raw ? normalizeLastLabelFormat(JSON.parse(raw)) : undefined
  } catch {
    return undefined
  }
}

export function writeLastLabelFormat(value: LabelFormatInitial): void {
  const normalized = normalizeLastLabelFormat(value)
  if (!normalized) return
  try {
    localStorage.setItem(LAST_LABEL_FORMAT_KEY, JSON.stringify(normalized))
  } catch {
    // 存不了就算了：只影响下次新建时的默认值，不影响当前操作。
  }
}
