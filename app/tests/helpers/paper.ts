import type { PaperGeometry } from '@shared/domain/paper'

export const SAMPLE_LABEL_SIZE = { widthMm: 40, heightMm: 30 } as const

export function paperWith(overrides: Partial<PaperGeometry> = {}): PaperGeometry {
  return { shape: 'rect', ...overrides }
}

/** Count closed sub-paths in an SVG path (the label outline plus an optional hole). */
export function subpathCount(path: string): number {
  return (path.match(/\bM\s/g) ?? []).length
}
