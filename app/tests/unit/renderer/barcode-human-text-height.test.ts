import { describe, expect, it } from 'vitest'
import { humanTextBlockMm } from '@/editor/barcode'

describe('条码对象框高度包含供人识读字符', () => {
  it('文字块高度按字号折算，与条高无关', () => {
    expect(humanTextBlockMm({ fontSize: 3 })).toBeCloseTo(4.5, 6)
    expect(humanTextBlockMm({ fontSize: 2 })).toBeCloseTo(3, 6)
  })

  it('文字偏移量计入文字块', () => {
    expect(humanTextBlockMm({ fontSize: 3 }, { humanOffsetMm: 1 })).toBeCloseTo(5.5, 6)
  })

  it('未设置字号时用默认 8pt', () => {
    expect(humanTextBlockMm({})).toBeCloseTo((8 * 25.4 / 72) * 1.5, 6)
  })
})
