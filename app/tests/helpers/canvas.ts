import type { LabelObject } from '@shared/domain/objects'

export interface ClientRect {
  left: number
  top: number
  right: number
  bottom: number
}

export const CANVAS_RECT = { left: 0, top: 0, width: 600, height: 400 } as const

export function clientRect(left: number, top: number, right: number, bottom: number): ClientRect {
  return { left, top, right, bottom }
}

export function clipboardText(objects: LabelObject[]): string {
  return JSON.stringify({ format: 'maxlabel-objects', version: 1, objects })
}

export function clipboardReader(text: string | null): () => Promise<string> {
  return async () => {
    if (text === null) throw new Error('clipboard unavailable')
    return text
  }
}

export function rectObject(id: string, x: number, y: number, w = 10, h = 5): LabelObject {
  return { id, type: 'rect', x, y, w, h, rotation: 0, fill: 'transparent', stroke: '#000', strokeWidth: 0.2 }
}
