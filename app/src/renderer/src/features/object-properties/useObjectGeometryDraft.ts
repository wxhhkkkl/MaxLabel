import { useState } from 'react'
import type { LabelObject } from '../../types'

export function useObjectGeometryDraft(object: LabelObject, onPatch: (patch: Partial<LabelObject>) => void) {
  const [x, setX] = useState(String(object.x))
  const [y, setY] = useState(String(object.y))
  const [w, setW] = useState(String(object.w))
  const [h, setH] = useState(String(object.h))
  const [rotation, setRotation] = useState(String(object.rotation ?? 0))
  const commit = () => {
    const numberOr = (value: string, fallback: number) => Number.isFinite(Number.parseFloat(value)) ? Number.parseFloat(value) : fallback
    onPatch({
      x: numberOr(x, object.x),
      y: numberOr(y, object.y),
      w: Math.max(0.1, numberOr(w, object.w)),
      h: Math.max(0.1, numberOr(h, object.h)),
      rotation: numberOr(rotation, object.rotation ?? 0)
    })
  }
  return { x, setX, y, setY, w, setW, h, setH, rotation, setRotation, commit }
}
