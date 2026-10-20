import { useState } from 'react'
import type { LabelObject } from '../../types'
import { parseGeometryDraft } from './geometryDraft'

export function useObjectGeometryDraft(object: LabelObject, onPatch: (patch: Partial<LabelObject>) => void) {
  const [x, setX] = useState(String(object.x))
  const [y, setY] = useState(String(object.y))
  const [w, setW] = useState(String(object.w))
  const [h, setH] = useState(String(object.h))
  const [rotation, setRotation] = useState(String(object.rotation ?? 0))
  const commit = () => {
    onPatch(parseGeometryDraft(object, { x, y, w, h, rotation }))
  }
  return { x, setX, y, setY, w, setW, h, setH, rotation, setRotation, commit }
}
