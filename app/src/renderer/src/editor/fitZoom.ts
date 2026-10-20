export type FitMode = 'w' | 'h' | 'win'

export interface FitZoomInput {
  mode: FitMode
  widthMm: number
  heightMm: number
  rotation: number
  availableWidthPx: number
  availableHeightPx: number
  /** Space reserved around the page in the scroll viewport. */
  gutterPx?: number
}

/** LabelShop fit modes; rotation swaps the physical axes before fitting. */
export function computeFitZoom(input: FitZoomInput): number {
  const gutter = input.gutterPx ?? 12
  const sideways = input.rotation % 180 !== 0
  const availableW = Math.max(1, input.availableWidthPx - gutter * 2)
  const availableH = Math.max(1, input.availableHeightPx - gutter * 2)
  const fitW = availableW / ((sideways ? input.heightMm : input.widthMm) * 10)
  const fitH = availableH / ((sideways ? input.widthMm : input.heightMm) * 10)
  return input.mode === 'w' ? fitW : input.mode === 'h' ? fitH : Math.min(fitW, fitH)
}
