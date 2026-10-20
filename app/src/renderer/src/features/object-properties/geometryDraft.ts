import type { LabelObject } from '../../types'

export interface GeometryDraft {
  x: string
  y: string
  w: string
  h: string
  rotation: string
}

/** Parse the property-page geometry inputs; invalid numbers keep the current value. */
export function parseGeometryDraft(object: LabelObject, draft: GeometryDraft): { x: number; y: number; w: number; h: number; rotation: number } {
  const numberOr = (value: string, fallback: number) => {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return {
    x: numberOr(draft.x, object.x),
    y: numberOr(draft.y, object.y),
    w: Math.max(0.1, numberOr(draft.w, object.w)),
    h: Math.max(0.1, numberOr(draft.h, object.h)),
    rotation: numberOr(draft.rotation, object.rotation ?? 0)
  }
}
