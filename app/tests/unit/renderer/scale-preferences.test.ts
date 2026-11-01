// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_SCALE_SETTINGS } from '@shared/scale/settings'
import {
  SCALE_SETTINGS_STORAGE_KEY,
  readScaleSettings,
  writeScaleSettings
} from '@/features/scale/scalePreferences'

describe('scale preferences —— 本地持久化', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('没有存过时返回默认值', () => {
    expect(readScaleSettings()).toEqual(DEFAULT_SCALE_SETTINGS)
  })

  it('写入后能原样读回', () => {
    writeScaleSettings({ protocol: 'mettler', port: 'COM4', baud: '4800', autoConnect: true })
    expect(readScaleSettings()).toEqual({
      protocol: 'mettler',
      port: 'COM4',
      baud: '4800',
      autoConnect: true
    })
  })

  it('存档损坏或越界时回退到合法值，不抛异常', () => {
    localStorage.setItem(SCALE_SETTINGS_STORAGE_KEY, '{not json')
    expect(readScaleSettings()).toEqual(DEFAULT_SCALE_SETTINGS)

    localStorage.setItem(SCALE_SETTINGS_STORAGE_KEY, JSON.stringify({ protocol: 'nope', baud: '1', port: ' COM2 ' }))
    expect(readScaleSettings()).toMatchObject({
      protocol: DEFAULT_SCALE_SETTINGS.protocol,
      baud: DEFAULT_SCALE_SETTINGS.baud,
      port: 'COM2'
    })
  })
})
