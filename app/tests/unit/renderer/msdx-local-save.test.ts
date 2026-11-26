import { describe, expect, it } from 'vitest'
import type { GroupObj, ImageObj, LabelDoc } from '@/types'
import { sampleDoc } from '../../helpers/factories'
import { toMsdxForLocalSave } from '@/io/msdx'

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

function serialize(doc: LabelDoc, targetPath: string, cloudImageLinks?: Record<string, string>) {
  const envelope = JSON.parse(toMsdxForLocalSave(doc, { targetPath, cloudImageLinks })) as { doc: LabelDoc }
  return envelope.doc
}

describe('toMsdxForLocalSave', () => {
  it('writes exported cloud images as local relative links', () => {
    const doc = sampleDoc({
      objects: [
        image({ id: 'cloud', src: 'data:image/png;base64,AAAA', cloudImage: 'AoAZ.png' }),
        image({ id: 'cloud2', src: 'data:image/png;base64,BBBB', cloudImage: 'Jqg.png' })
      ]
    })
    const saved = serialize(doc, 'C:\\labels\\模板.msdx', {
      cloud: 'images/AoAZ.png',
      cloud2: '..\\shared\\Jqg.png'
    })
    expect(saved.objects[0]).toMatchObject({ imgType: 'link', linkPath: 'images/AoAZ.png', src: '' })
    expect((saved.objects[0] as ImageObj).cloudImage).toBeUndefined()
    expect(saved.objects[1]).toMatchObject({ imgType: 'link', linkPath: '..\\shared\\Jqg.png' })
  })

  it('relativizes local links that live under the template directory', () => {
    const doc = sampleDoc({
      objects: [
        image({ id: 'inside', imgType: 'link', linkPath: 'C:\\labels\\images\\local.png' }),
        image({ id: 'outside', imgType: 'link', linkPath: 'D:\\shared\\logo.png' })
      ]
    })
    const saved = serialize(doc, 'C:\\labels\\模板.msdx')
    expect((saved.objects[0] as ImageObj).linkPath).toBe('images/local.png')
    expect((saved.objects[1] as ImageObj).linkPath).toBe('D:\\shared\\logo.png')
  })

  it('rewrites cloud images inside groups', () => {
    const group: GroupObj = {
      id: 'group', type: 'group', x: 0, y: 0, w: 10, h: 10, rotation: 0,
      children: [image({ id: 'nested', src: 'data:image/png;base64,CCCC', cloudImage: 'nested.png' })]
    }
    const saved = serialize(sampleDoc({ objects: [group] }), 'C:\\labels\\a.msdx', { nested: 'pics/nested.png' })
    expect((saved.objects[0] as GroupObj).children[0]).toMatchObject({ imgType: 'link', linkPath: 'pics/nested.png' })
  })

  it('keeps cloud images embedded when no export mapping exists', () => {
    const doc = sampleDoc({ objects: [image({ id: 'cloud', src: 'data:image/png;base64,AAAA', cloudImage: 'a.png' })] })
    const saved = serialize(doc, 'C:\\labels\\a.msdx')
    expect(saved.objects[0]).toMatchObject({ imgType: 'embed', src: 'data:image/png;base64,AAAA', cloudImage: 'a.png' })
  })
})
