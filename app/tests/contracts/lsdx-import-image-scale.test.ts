// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { importLsdx } from '@/io/lsdxImport'
import type { ImageObj } from '@/types'

vi.mock('@/print/imageValidation', () => ({
  validateImageDataUrl: vi.fn(async () => undefined)
}))

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8)
  new DataView(bytes.buffer).setUint32(16, width)
  new DataView(bytes.buffer).setUint32(20, height)
  return bytes
}

function lsdx(picture: string): string {
  return `<labelshopdocument><labelform>
    <label width="4000" height="3000" rows="1" cols="1" rowgap="0" colgap="0"/>
    <labelobjects><drawobj type="drawpicture" id="9" left="100" top="100" right="600" bottom="600">
      ${picture}
    </drawobj></labelobjects>
  </labelform></labelshopdocument>`
}

afterEach(() => {
  delete (window as unknown as { maxlabel?: unknown }).maxlabel
})

describe('lsdx 比例缩放图片', () => {
  it('uses the saved frame as the displayed size for scale=1', async () => {
    const data = Buffer.from(png(10, 10)).toString('base64')
    const imported = await importLsdx(
      lsdx(`<picture file="" type="0" scale="1" keep="1" dbalign="0" onerr="0" srcheight="254" srcwidth="254">${data}</picture>`),
      'scale.lsdx'
    )
    const picture = imported.doc.objects[0] as ImageObj
    expect(picture).toMatchObject({ type: 'image', imgType: 'embed', imageFit: 'scale' })
    // 5mm 框 / (10px @ 96dpi = 2.6458mm) = 188.98%
    expect(picture.widthPercent).toBeCloseTo(188.98, 2)
    expect(picture.heightPercent).toBeCloseTo(188.98, 2)
  })

  it('keeps width and height percentages independent when aspect is not kept', async () => {
    const data = Buffer.from(png(10, 10)).toString('base64')
    const imported = await importLsdx(
      lsdx(`<picture file="" type="0" scale="1" keep="0" dbalign="0" onerr="0" srcheight="254" srcwidth="254">${data}</picture>`),
      'stretch.lsdx'
    )
    const picture = imported.doc.objects[0] as ImageObj
    expect(picture.keepAspect).toBe(false)
    expect(picture.widthPercent).toBeCloseTo(188.98, 1)
    expect(picture.heightPercent).toBeCloseTo(188.98, 1)
  })

  it('falls back to srcwidth when the image itself cannot be read', async () => {
    ;(window as unknown as { maxlabel: unknown }).maxlabel = {
      readImage: vi.fn(async () => ({ ok: false, message: 'missing' }))
    }
    const imported = await importLsdx(
      lsdx('<picture file="C:\\\\missing\\\\a.png" type="1" scale="1" keep="1" dbalign="0" onerr="3" srcheight="254" srcwidth="254"/>'),
      'missing.lsdx'
    )
    const picture = imported.doc.objects[0] as ImageObj
    // 5mm / (254 / 100 mm) = 196.85%
    expect(picture.widthPercent).toBeCloseTo(196.85, 2)
    expect(picture.heightPercent).toBeCloseTo(196.85, 2)
  })

  it('reads embedded picture data from the img attribute', async () => {
    const data = Buffer.from(png(10, 10)).toString('base64')
    const imported = await importLsdx(
      lsdx(`<picture file="" type="0" scale="0" keep="1" dbalign="0" onerr="0" srcheight="254" srcwidth="254" img="${data}"/>`),
      'img-attribute.lsdx'
    )
    const picture = imported.doc.objects[0] as ImageObj
    expect(picture).toMatchObject({ type: 'image', imgType: 'embed' })
    expect(picture.src).toMatch(/^data:image\/png;base64,/)
    expect(imported.warnings).toEqual([])
  })

  it('does not add percentages for fit / original modes', async () => {
    const data = Buffer.from(png(10, 10)).toString('base64')
    for (const scale of ['0', '2', '3']) {
      const imported = await importLsdx(
        lsdx(`<picture file="" type="0" scale="${scale}" keep="1" dbalign="0" onerr="0" srcheight="254" srcwidth="254">${data}</picture>`),
        `mode-${scale}.lsdx`
      )
      const picture = imported.doc.objects[0] as ImageObj
      expect(picture.widthPercent, scale).toBeUndefined()
      expect(picture.heightPercent, scale).toBeUndefined()
    }
  })
})
