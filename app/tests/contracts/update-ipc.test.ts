import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS } from '@shared/ipcContract'

describe('update IPC contract', () => {
  it('exposes every update channel with a stable name', () => {
    expect(IPC_CHANNELS.updateCheck).toBe('update:check')
    expect(IPC_CHANNELS.updateDownload).toBe('update:download')
    expect(IPC_CHANNELS.updateCancel).toBe('update:cancel')
    expect(IPC_CHANNELS.updateInstall).toBe('update:install')
    expect(IPC_CHANNELS.updateState).toBe('update:state')
    expect(IPC_CHANNELS.updateChanged).toBe('update:changed')
  })

  it('keeps channel names unique', () => {
    const values = Object.values(IPC_CHANNELS)
    expect(new Set(values).size).toBe(values.length)
  })
})
