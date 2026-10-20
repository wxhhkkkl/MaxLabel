import type { LabelDoc, LabelObject } from '../types'
import { objectBounds } from '../features/editor/operations'

export interface ClientRectLike {
  left: number
  top: number
  right: number
  bottom: number
}

export function clientRectFromPoints(startX: number, startY: number, endX: number, endY: number): ClientRectLike {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    right: Math.max(startX, endX),
    bottom: Math.max(startY, endY)
  }
}

export function rectIntersects(a: ClientRectLike, b: ClientRectLike): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top
}

export function documentPointToClient(
  xMm: number,
  yMm: number,
  doc: LabelDoc,
  canvasRect: DOMRect,
  zoom: number,
  rotation: number
): { x: number; y: number } {
  const sceneWidth = doc.widthMm * 10 * zoom
  const sceneHeight = doc.heightMm * 10 * zoom
  const dx = xMm * 10 * zoom - sceneWidth / 2
  const dy = yMm * 10 * zoom - sceneHeight / 2
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: canvasRect.left + canvasRect.width / 2 + dx * cos - dy * sin,
    y: canvasRect.top + canvasRect.height / 2 + dx * sin + dy * cos
  }
}

export function objectClientBounds(object: LabelObject, doc: LabelDoc, canvasRect: DOMRect, zoom: number, rotation: number): ClientRectLike {
  const bounds = objectBounds(object)
  const points = [
    documentPointToClient(bounds.left, bounds.top, doc, canvasRect, zoom, rotation),
    documentPointToClient(bounds.right, bounds.top, doc, canvasRect, zoom, rotation),
    documentPointToClient(bounds.right, bounds.bottom, doc, canvasRect, zoom, rotation),
    documentPointToClient(bounds.left, bounds.bottom, doc, canvasRect, zoom, rotation)
  ]
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y))
  }
}
