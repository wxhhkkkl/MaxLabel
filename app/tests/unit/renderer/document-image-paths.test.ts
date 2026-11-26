import { describe, expect, it } from 'vitest'
import type { ImageObj, LabelDoc } from '@/types'
import { sampleDoc } from '../../helpers/factories'
import {
  dirnameDocumentPath,
  isAbsoluteDocumentPath,
  relativeImagePath,
  resolveDocumentImagePaths
} from '@/io/documentImagePaths'

function image(overrides: Partial<ImageObj>): ImageObj {
  return {
    id: 'img',
    type: 'image',
    x: 0,
    y: 0,
    w: 10,
    h: 10,
    rotation: 0,
    src: '',
    imgType: 'link',
    ...overrides
  }
}

describe('document image paths', () => {
  it('detects absolute Windows and POSIX paths', () => {
    expect(isAbsoluteDocumentPath('C:\\labels\\a.png')).toBe(true)
    expect(isAbsoluteDocumentPath('C:/labels/a.png')).toBe(true)
    expect(isAbsoluteDocumentPath('\\\\server\\share\\a.png')).toBe(true)
    expect(isAbsoluteDocumentPath('/opt/labels/a.png')).toBe(true)
    expect(isAbsoluteDocumentPath('images/a.png')).toBe(false)
    expect(isAbsoluteDocumentPath('..\\images\\a.png')).toBe(false)
  })

  it('resolves relative link and datasource paths, including groups', () => {
    const doc = sampleDoc({
      objects: [
        image({ id: 'link', linkPath: 'images/logo.png' }),
        image({ id: 'absolute', linkPath: 'D:/shared/logo.png' }),
        image({ id: 'data', imgType: 'datasource', linkPath: 'records' }),
        {
          id: 'group',
          type: 'group',
          x: 0,
          y: 0,
          w: 10,
          h: 10,
          rotation: 0,
          children: [image({ id: 'nested', linkPath: 'pic/a.png' })]
        }
      ]
    })
    const resolved = resolveDocumentImagePaths(doc, 'C:\\labels\\模板.msdx')
    expect((resolved.objects[0] as ImageObj).linkPath).toBe('C:/labels/images/logo.png')
    expect((resolved.objects[1] as ImageObj).linkPath).toBe('D:/shared/logo.png')
    expect((resolved.objects[2] as ImageObj).linkPath).toBe('C:/labels/records')
    const group = resolved.objects[3] as { children: ImageObj[] }
    expect(group.children[0].linkPath).toBe('C:/labels/pic/a.png')
  })

  it('returns a relative path only when both sides share a root', () => {
    expect(relativeImagePath('C:\\labels', 'C:\\labels\\images\\a.png')).toBe('images/a.png')
    expect(relativeImagePath('C:\\labels', 'C:\\other\\a.png')).toBe('../other/a.png')
    expect(relativeImagePath('C:\\labels\\sub', 'C:\\labels\\a.png')).toBe('../a.png')
    expect(relativeImagePath('/opt/labels', '/opt/labels/pic/a.png')).toBe('pic/a.png')
    expect(relativeImagePath('C:\\labels', 'D:\\labels\\a.png')).toBeNull()
  })

  it('extracts the containing directory with either separator', () => {
    expect(dirnameDocumentPath('C:\\labels\\模板.msdx')).toBe('C:\\labels')
    expect(dirnameDocumentPath('/opt/labels/a.msdx')).toBe('/opt/labels')
    expect(dirnameDocumentPath('a.msdx')).toBe('')
  })

  it('returns the original document when nothing needs resolving', () => {
    const doc: LabelDoc = sampleDoc({ objects: [image({ linkPath: 'C:/abs/a.png' })] })
    expect(resolveDocumentImagePaths(doc, 'C:/labels/a.msdx')).toBe(doc)
  })
})
