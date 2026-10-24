import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '@shared/ipcContract'

describe('entitlement IPC contract', () => {
  it('names the status and change channels inside the entitlement namespace', () => {
    expect(IPC_CHANNELS.entitlementStatus).toBe('entitlement:status')
    expect(IPC_CHANNELS.entitlementChanged).toBe('entitlement:changed')
  })

  it('keeps every channel name unique', () => {
    const values = Object.values(IPC_CHANNELS)
    expect(new Set(values).size).toBe(values.length)
  })

  it('does not expose an entitlement mutation channel', () => {
    const channels = Object.entries(IPC_CHANNELS).filter(([key]) => key.toLowerCase().includes('entitlement'))
    expect(channels.every(([, value]) => value === 'entitlement:status' || value === 'entitlement:changed')).toBe(true)
  })
})
