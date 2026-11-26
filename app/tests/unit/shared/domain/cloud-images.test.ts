import { describe, expect, it } from 'vitest'
import { parseCloudImageReference } from '@shared/domain/cloudImages'

describe('LabelShop 云图片引用', () => {
  it('maps labelshop:\\\\codingv\\ file names to the OSS image library', () => {
    const ref = parseCloudImageReference('labelshop:\\\\codingv\\AoAZHSklKSsvNTs9RkcF.png')
    expect(ref).toEqual({
      fileName: 'AoAZHSklKSsvNTs9RkcF.png',
      urls: [
        'https://cvsimg.oss-cn-beijing.aliyuncs.com/li/AoAZHSklKSsvNTs9RkcF.png',
        'http://i.codingv.com/li/AoAZHSklKSsvNTs9RkcF.png'
      ]
    })
  })

  it('accepts any pseudo-host prefix and both slash styles', () => {
    const ref = parseCloudImageReference('LABELSHOP:/cloud/图片 1.png')
    expect(ref?.fileName).toBe('图片 1.png')
    expect(ref?.urls[0]).toBe('https://cvsimg.oss-cn-beijing.aliyuncs.com/li/%E5%9B%BE%E7%89%87%201.png')
  })

  it('rejects non-cloud references and unsafe file names', () => {
    for (const value of [
      '',
      'C:\\images\\logo.png',
      'labelshop:\\\\codingv\\readme.txt',
      'labelshop:',
      'labelshop:\\\\codingv\\..',
      'labelshop:\\\\codingv\\a.png?download=1',
      'labelshop:\\\\codingv\\a:b.png'
    ]) {
      expect(parseCloudImageReference(value), value).toBeNull()
    }
    expect(parseCloudImageReference(undefined)).toBeNull()
  })
})
