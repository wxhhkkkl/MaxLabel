import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '@shared/domain'
import type { ImageObj } from '@shared/domain/objects'

function docWithImage(extra: Record<string, unknown>) {
  return normalizeDocument({
    version: 1,
    name: 'cloud',
    widthMm: 40,
    heightMm: 30,
    objects: [
      { id: 'img', type: 'image', x: 0, y: 0, w: 10, h: 10, rotation: 0, src: '', imgType: 'embed', ...extra }
    ]
  })
}

describe('cloudImage document field', () => {
  it('keeps the cloud image file name', () => {
    const doc = docWithImage({ cloudImage: 'AoAZ.png' })
    expect((doc.objects[0] as ImageObj).cloudImage).toBe('AoAZ.png')
  })

  it('ignores non-string cloud image values', () => {
    const doc = docWithImage({ cloudImage: 42 })
    expect((doc.objects[0] as ImageObj).cloudImage).toBeUndefined()
  })
})
