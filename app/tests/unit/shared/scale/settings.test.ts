import { describe, expect, it } from 'vitest'
import { DEFAULT_SCALE_SETTINGS, normalizeScaleSettings } from '@shared/scale/settings'

/**
 * 电子称的**全局设备设置**（020）：协议 / 端口 / 速率 / 打开模板时自动连接。
 *
 * 这些值来自 localStorage，属于不可信输入；归一化必须保证落在白名单内，
 * 否则会把非法协议一路带到主进程的 IPC 校验上。
 */
describe('scale settings —— 归一化', () => {
  it('缺失或非对象时返回默认值', () => {
    expect(normalizeScaleSettings(undefined)).toEqual(DEFAULT_SCALE_SETTINGS)
    expect(normalizeScaleSettings(null)).toEqual(DEFAULT_SCALE_SETTINGS)
    expect(normalizeScaleSettings('nope')).toEqual(DEFAULT_SCALE_SETTINGS)
    expect(normalizeScaleSettings([])).toEqual(DEFAULT_SCALE_SETTINGS)
  })

  it('保留白名单内的协议与速率，越界回退默认', () => {
    expect(normalizeScaleSettings({ protocol: 'standard', baud: '19200' })).toMatchObject({
      protocol: 'standard',
      baud: '19200'
    })
    expect(normalizeScaleSettings({ protocol: 'fumi', baud: '1234' })).toMatchObject({
      protocol: DEFAULT_SCALE_SETTINGS.protocol,
      baud: DEFAULT_SCALE_SETTINGS.baud
    })
  })

  it('端口去空白并裁剪到 32 字符（与 IPC 校验上限一致）', () => {
    expect(normalizeScaleSettings({ port: '  COM3 ' }).port).toBe('COM3')
    expect(normalizeScaleSettings({ port: 'X'.repeat(50) }).port).toHaveLength(32)
    expect(normalizeScaleSettings({ port: 42 }).port).toBe('')
  })

  it('autoConnect 只认布尔 true', () => {
    expect(normalizeScaleSettings({ autoConnect: true }).autoConnect).toBe(true)
    expect(normalizeScaleSettings({ autoConnect: 'true' }).autoConnect).toBe(false)
    expect(normalizeScaleSettings({ autoConnect: 1 }).autoConnect).toBe(false)
  })
})
