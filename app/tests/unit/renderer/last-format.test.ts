// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { LAST_LABEL_FORMAT_KEY, normalizeLastLabelFormat, readLastLabelFormat, writeLastLabelFormat } from '@/features/label-formats/lastFormat'
import { installMemoryStorage } from '../../helpers/storage'

let restore: (() => void) | null = null
afterEach(() => { restore?.(); restore = null })

const sample = {
  widthMm: 60, heightMm: 40, rows: 1, cols: 2, rowGapMm: 3, colGapMm: 3,
  pageWidthMm: 62, pageHeightMm: 40, pageLeftMm: 1, pageTopMm: 0,
  shape: 'roundRect' as const, labelColor: '#ffffff', mediaType: 0 as const
}

describe('上次标签格式（新建标签的粘性设置）', () => {
  it('写入后能原样读回', () => {
    restore = installMemoryStorage().restore
    writeLastLabelFormat(sample)
    expect(readLastLabelFormat()).toEqual(sample)
  })

  it('拒绝缺尺寸/非法介质的内容，避免带出坏默认值', () => {
    expect(normalizeLastLabelFormat(undefined)).toBeUndefined()
    expect(normalizeLastLabelFormat({ widthMm: 0, heightMm: 40 })).toBeUndefined()
    expect(normalizeLastLabelFormat({ widthMm: 60, heightMm: 40, mediaType: 9 })?.mediaType).toBeUndefined()
    expect(normalizeLastLabelFormat({ widthMm: 60, heightMm: 40, rows: 0, cols: 2 })).toMatchObject({ rows: 1, cols: 2 })
  })

  it('存储内容损坏时回退默认（不抛错）', () => {
    restore = installMemoryStorage().restore
    localStorage.setItem(LAST_LABEL_FORMAT_KEY, '{broken json')
    expect(readLastLabelFormat()).toBeUndefined()
  })
})
