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
