export const MIN_CUSTOM_LABEL_MM = 5
export const MAX_CUSTOM_LABEL_MM = 500
export const MIN_CUSTOM_GRID = 1
export const MAX_CUSTOM_GRID = 100

/** Rows/columns are truncated to integers and clamped to 1–100. */
export function clampCustomGrid(value: number): number {
  if (!Number.isFinite(value)) return MIN_CUSTOM_GRID
  return Math.min(MAX_CUSTOM_GRID, Math.max(MIN_CUSTOM_GRID, Math.trunc(value)))
}

/** The custom dialog only creates a format for finite sizes within 5–500 mm. */
export function isCustomLabelSizeValid(width: number, height: number): boolean {
  return Number.isFinite(width)
    && Number.isFinite(height)
    && width >= MIN_CUSTOM_LABEL_MM
    && height >= MIN_CUSTOM_LABEL_MM
    && width <= MAX_CUSTOM_LABEL_MM
    && height <= MAX_CUSTOM_LABEL_MM
}
