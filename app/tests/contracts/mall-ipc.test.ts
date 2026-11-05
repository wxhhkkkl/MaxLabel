import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '@shared/ipcContract'

describe('mall IPC contract', () => {
  it('keeps mall channels unique and inside the mall namespace', () => {
    const channels = Object.entries(IPC_CHANNELS)
      .filter(([key]) => key.startsWith('mall'))
      .map(([, value]) => value)
    expect(channels.length).toBeGreaterThanOrEqual(12)
    expect(new Set(channels).size).toBe(channels.length)
    for (const channel of channels) expect(channel.startsWith('mall:')).toBe(true)
  })

  it('covers login, templates, sharing and the storefront window', () => {
    expect(IPC_CHANNELS.mallLogin).toBe('mall:login')
    expect(IPC_CHANNELS.mallEnterpriseRole).toBe('mall:enterprise-role')
    expect(IPC_CHANNELS.mallSmsSend).toBe('mall:sms-send')
    expect(IPC_CHANNELS.mallCaptchaEnabled).toBe('mall:captcha-enabled')
    expect(IPC_CHANNELS.mallCaptchaGet).toBe('mall:captcha-get')
    expect(IPC_CHANNELS.mallCaptchaCheck).toBe('mall:captcha-check')
    expect(IPC_CHANNELS.mallWechatCreate).toBe('mall:wechat-create')
    expect(IPC_CHANNELS.mallWechatQuery).toBe('mall:wechat-query')
    expect(IPC_CHANNELS.mallWechatComplete).toBe('mall:wechat-complete')
    expect(IPC_CHANNELS.mallWechatAbandon).toBe('mall:wechat-abandon')
    expect(IPC_CHANNELS.mallTemplateSave).toBe('mall:template-save')
    expect(IPC_CHANNELS.shareOverview).toBe('share:overview')
    expect(IPC_CHANNELS.mallSharedList).toBe('mall:shared-list')
    expect(IPC_CHANNELS.mallOpen).toBe('mall:open')
  })
})
