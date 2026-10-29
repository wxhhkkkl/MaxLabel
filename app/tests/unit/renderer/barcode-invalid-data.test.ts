// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import type { BarcodeObj } from '@shared/domain/objects'
import { barcodeObject } from '../../helpers/color'

// jsdom 加载不了图片，占位图那一步换成同步返回的假对象
vi.mock('fabric', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fabric')>()
  return { ...actual, Image: { fromURL: async () => new actual.Rect({ width: 20, height: 10 }) } }
})

// EAN-13 之类码制在数据长度不合法时，bwip-js 会直接抛错
vi.mock('@/print/vectorBarcode', () => ({
  barcodeToSvgFragment: async () => {
    throw new Error('invalid data length')
  }
}))

import { makeObject } from '@/rendering/fabricObjects'

const invalidEan = (): BarcodeObj => barcodeObject({
  symbology: 'ean13',
  source: { kind: 'constant', value: '1234567890' }
})

describe('码制数据不合法时条码不能凭空消失', () => {
  it('画布通路退化成占位对象，而不是把整个对象丢掉', async () => {
    const object = await makeObject(invalidEan(), 3.78, { vectorBarcodes: 'canvas' })
    expect(object).not.toBeNull()
  })

  it('输出通路仍然抛错，让调用方看到真实原因', async () => {
    await expect(makeObject(invalidEan(), 3.78, { vectorBarcodes: 'svg', output: true })).rejects.toThrow(/invalid data length/)
  })
})
