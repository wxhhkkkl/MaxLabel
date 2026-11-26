// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { importLsdx } from '@/io/lsdxImport'
import type { ImageObj } from '@/types'

vi.mock('@/print/imageValidation', () => ({
  validateImageDataUrl: vi.fn(async () => undefined)
}))

function cloudLsdx(file: string): string {
  return `<labelshopdocument><labelform>
    <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
    <labelobjects><drawobj type="drawpicture" id="7" left="100" top="100" right="1100" bottom="1100">
      <picture file="${file}" pname="20071211.png" type="1" scale="1" keep="1" dbalign="0" onerr="3"/>
    </drawobj></labelobjects>
  </labelform></labelshopdocument>`
}

afterEach(() => {
  delete (window as unknown as { maxlabel?: unknown }).maxlabel
})

describe('lsdx cloud pictures', () => {
  it('downloads labelshop: pictures and keeps them embedded', async () => {
    const fetchCloudImage = vi.fn(async () => ({
      ok: true,
      dataUrl: 'data:image/png;base64,AAAA',
      fileName: 'AoAZHSklKSsvNTs9RkcF.png',
      url: 'https://cvsimg.oss-cn-beijing.aliyuncs.com/li/AoAZHSklKSsvNTs9RkcF.png'
    }))
    ;(window as unknown as { maxlabel: unknown }).maxlabel = { fetchCloudImage }

    const imported = await importLsdx(cloudLsdx('labelshop:\\\\codingv\\AoAZHSklKSsvNTs9RkcF.png'), 'cloud.lsdx')
    expect(fetchCloudImage).toHaveBeenCalledTimes(1)
    expect(fetchCloudImage).toHaveBeenCalledWith('labelshop:\\\\codingv\\AoAZHSklKSsvNTs9RkcF.png')
    const picture = imported.doc.objects[0] as ImageObj
    expect(picture).toMatchObject({
      type: 'image',
      imgType: 'embed',
      src: 'data:image/png;base64,AAAA',
      cloudImage: 'AoAZHSklKSsvNTs9RkcF.png'
    })
    expect(imported.warnings).toEqual([])
  })

  it('keeps the object and warns when the cloud image cannot be downloaded', async () => {
    ;(window as unknown as { maxlabel: unknown }).maxlabel = {
      fetchCloudImage: vi.fn(async () => ({ ok: false, message: 'offline' }))
    }

    const imported = await importLsdx(cloudLsdx('labelshop:\\\\codingv\\AoAZHSklKSsvNTs9RkcF.png'), 'cloud.lsdx')
    const picture = imported.doc.objects[0] as ImageObj
    expect(picture).toMatchObject({ type: 'image', imgType: 'link', linkPath: '', cloudImage: 'AoAZHSklKSsvNTs9RkcF.png' })
    expect(imported.warnings.some((warning) => warning.includes('云图片'))).toBe(true)
  })
})
