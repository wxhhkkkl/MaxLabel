export interface CanvasRectLike {
  left: number
  top: number
  width: number
  height: number
}

export interface CanvasPoint {
  x: number
  y: number
}

/**
 * Normalize browser and synthetic pointer events to client coordinates.
 *
 * Native mouse events expose clientX/clientY, while a few integrations and
 * CDP probes only provide pageX/pageY. Keeping this normalization here makes
 * every canvas entry point consume the same coordinate space before applying
 * zoom, scroll, or label rotation.
 */
export function eventClientPoint(event: any): CanvasPoint {
  const point = event?.changedTouches?.[0] ?? event?.touches?.[0] ?? event
  const clientX = Number(point?.clientX)
  const clientY = Number(point?.clientY)
  const pageX = Number(point?.pageX)
  const pageY = Number(point?.pageY)
  // Synthetic MouseEvent defaults clientX/clientY to 0 even when pageX/pageY
  // were supplied. Prefer the page pair in that case, accounting for the
  // document viewport scroll without depending on window in node tests.
  if (Number.isFinite(pageX) && Number.isFinite(pageY) && clientX === 0 && clientY === 0 && (pageX !== 0 || pageY !== 0)) {
    const scrollX = typeof window === 'undefined' ? 0 : window.scrollX
    const scrollY = typeof window === 'undefined' ? 0 : window.scrollY
    return { x: pageX - scrollX, y: pageY - scrollY }
  }
  return { x: Number.isFinite(clientX) ? clientX : 0, y: Number.isFinite(clientY) ? clientY : 0 }
}

/**
 * Convert a screen/client point from a CSS-rotated editor canvas into the
 * unrotated Fabric scene plane. The returned values are scene pixels, not mm.
 */
export function clientToCanvasPoint(
  client: CanvasPoint,
  bounds: CanvasRectLike,
  sceneWidthPx: number,
  sceneHeightPx: number,
  zoom: number,
  rotation: number
): CanvasPoint {
  const z = Math.max(0.01, zoom)
  const width = sceneWidthPx * z
  const height = sceneHeightPx * z
  const angle = ((rotation % 360) + 360) % 360
  const radians = (angle * Math.PI) / 180
  const dx = client.x - (bounds.left + bounds.width / 2)
  const dy = client.y - (bounds.top + bounds.height / 2)
  const x = (Math.cos(radians) * dx + Math.sin(radians) * dy + width / 2) / z
  const y = (-Math.sin(radians) * dx + Math.cos(radians) * dy + height / 2) / z
  return { x: Math.abs(x) < 1e-9 ? 0 : x, y: Math.abs(y) < 1e-9 ? 0 : y }
}
