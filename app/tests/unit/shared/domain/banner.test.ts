import { describe, expect, it } from 'vitest'
import {
  bannerJointGeometry,
  bannerJointOrientation,
  bannerStripGeometry
} from '@shared/domain/banner'

describe('banner double geometry', () => {
  it('places two upright strips side by side with a centre joint', () => {
    expect(bannerJointOrientation(100, 1000)).toBe('vertical')
    expect(bannerJointGeometry(100, 1000, 2)).toEqual({
      widthMm: 202,
      heightMm: 1000,
      jointMode: 'double',
      jointWidthMm: 2,
      jointOrientation: 'vertical'
    })
  })

  it('stacks two landscape strips with a horizontal joint', () => {
    expect(bannerJointOrientation(1000, 100)).toBe('horizontal')
    expect(bannerJointGeometry(1000, 100, 2)).toEqual({
      widthMm: 1000,
      heightMm: 202,
      jointMode: 'double',
      jointWidthMm: 2,
      jointOrientation: 'horizontal'
    })
  })

  it('allows a zero-width joint without changing the double mode', () => {
    expect(bannerJointGeometry(100, 1000, 0)).toMatchObject({
      widthMm: 200,
      heightMm: 1000,
      jointMode: 'double',
      jointWidthMm: 0
    })
  })

  it('recovers the single strip from a double document', () => {
    expect(bannerStripGeometry(202, 1000, 2, 'vertical')).toEqual({ widthMm: 100, heightMm: 1000 })
    expect(bannerStripGeometry(1000, 202, 2, 'horizontal')).toEqual({ widthMm: 1000, heightMm: 100 })
    expect(bannerStripGeometry(200, 1000, 0, 'vertical')).toEqual({ widthMm: 100, heightMm: 1000 })
  })
})
