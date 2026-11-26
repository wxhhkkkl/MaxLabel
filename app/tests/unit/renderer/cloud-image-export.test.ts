import { describe, expect, it } from 'vitest'
import type { GroupObj, ImageObj, LabelObject } from '@/types'
import { buildCloudImageLinks, collectCloudImages, suggestCloudImageDir } from '@/io/cloudImageExport'

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
    imgType: 'embed',
    ...overrides
  }
}

describe('cloud image export', () => {
  it('collects downloadable cloud images, deduplicating by cloud file name', () => {
    const objects: LabelObject[] = [
      image({ id: 'a', src: 'data:image/png;base64,AAAA', cloudImage: 'same.png' }),
      image({ id: 'b', src: 'data:image/png;base64,AAAA', cloudImage: 'same.png' }),
      image({ id: 'c', src: 'data:image/png;base64,BBBB', cloudImage: 'other.png' }),
      image({ id: 'd', src: '', cloudImage: 'missing.png' }),
      image({ id: 'e', src: 'data:image/png;base64,CCCC' })
    ]
    const collected = collectCloudImages(objects)
    expect(collected).toHaveLength(2)
    expect(collected[0]).toMatchObject({ fileName: 'same.png', objectIds: ['a', 'b'] })
    expect(collected[1]).toMatchObject({ fileName: 'other.png', objectIds: ['c'] })
  })

  it('collects cloud images inside groups', () => {
    const group: GroupObj = {
      id: 'g', type: 'group', x: 0, y: 0, w: 10, h: 10, rotation: 0,
      children: [image({ id: 'nested', src: 'data:image/png;base64,CCCC', cloudImage: 'n.png' })]
    }
    expect(collectCloudImages([group])).toMatchObject([{ fileName: 'n.png', objectIds: ['nested'] }])
  })

  it('maps exported files back to every object that used them', () => {
    const links = buildCloudImageLinks(
      [{ fileName: 'same.png', dataUrl: '', objectIds: ['a', 'b'] }],
      [{ fileName: 'same.png', path: 'C:\\labels\\images\\same.png' }],
      'C:\\labels\\模板.msdx'
    )
    expect(links).toEqual({ a: 'images/same.png', b: 'images/same.png' })
  })

  it('falls back to the absolute path when the image folder is on another drive', () => {
    const links = buildCloudImageLinks(
      [{ fileName: 'a.png', dataUrl: '', objectIds: ['a'] }],
      [{ fileName: 'a.png', path: 'D:\\pics\\a.png' }],
      'C:\\labels\\模板.msdx'
    )
    expect(links).toEqual({ a: 'D:\\pics\\a.png' })
  })

  it('suggests a sibling image folder named after the template', () => {
    expect(suggestCloudImageDir('C:\\labels\\模板.msdx')).toBe('C:\\labels\\模板_images')
    expect(suggestCloudImageDir('/opt/labels/a.msdx')).toBe('/opt/labels/a_images')
  })
})
