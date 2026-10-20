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
    expect(IPC_CHANNELS.mallTemplateSave).toBe('mall:template-save')
    expect(IPC_CHANNELS.mallTemplateShare).toBe('mall:template-share')
    expect(IPC_CHANNELS.mallSharedList).toBe('mall:shared-list')
    expect(IPC_CHANNELS.mallOpen).toBe('mall:open')
  })
})
