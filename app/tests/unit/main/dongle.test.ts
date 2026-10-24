import { describe, expect, it, vi } from 'vitest'
import {
  createConfiguredReader,
  createDongleWatcher,
  createVendorReader,
  createWindowsVolumeReader,
  evaluateVolumes,
  parseWindowsVolumes,
  type DongleReadResult
} from '@main/dongle/dongleReader'

describe('windows volume parsing', () => {
  it('parses an array of removable volumes', () => {
    const raw = JSON.stringify([
      { DeviceID: 'E:\\', VolumeName: 'MAXLABEL-KEY', VolumeSerialNumber: 'A1B2C3D4' },
      { DeviceID: 'F:\\', VolumeName: 'USB DISK', VolumeSerialNumber: '00000000' }
    ])
    expect(parseWindowsVolumes(raw)).toEqual([
      { id: 'E:', label: 'MAXLABEL-KEY', serial: 'A1B2C3D4' },
      { id: 'F:', label: 'USB DISK', serial: '00000000' }
    ])
  })

  it('accepts a single object and ignores malformed output', () => {
    expect(parseWindowsVolumes(JSON.stringify({ DeviceID: 'E:', VolumeName: 'KEY', VolumeSerialNumber: '1' })))
      .toEqual([{ id: 'E:', label: 'KEY', serial: '1' }])
    expect(parseWindowsVolumes('')).toEqual([])
    expect(parseWindowsVolumes('not json')).toEqual([])
  })
})

describe('dongle device matching', () => {
  const expected = ['MAXLABEL-KEY', 'A1B2C3D4']

  it('validates a volume whose label or serial matches the configuration', () => {
    expect(evaluateVolumes([{ id: 'E:', label: 'MAXLABEL-KEY' }], expected)).toMatchObject({ present: true, valid: true })
    expect(evaluateVolumes([{ id: 'E:', serial: 'a1b2c3d4' }], expected)).toMatchObject({ present: true, valid: true })
  })

  it('reports a present but unwritten device when no expected identifiers are configured', () => {
    expect(evaluateVolumes([{ id: 'E:', label: 'USB DISK' }], [])).toEqual({ present: true, valid: false, reason: 'unwritten' })
  })

  it('rejects an unrelated removable volume instead of treating it as valid', () => {
    expect(evaluateVolumes([{ id: 'E:', label: 'USB DISK' }], expected)).toMatchObject({ present: true, valid: false, reason: 'rejected' })
  })

  it('reports absence when no removable volume is present', () => {
    expect(evaluateVolumes([], expected)).toEqual({ present: false, valid: false, reason: 'absent' })
  })
})

describe('readers', () => {
  it('reads volumes through the injected system command', async () => {
    const exec = vi.fn(async () => JSON.stringify([{ DeviceID: 'E:', VolumeName: 'MAXLABEL-KEY', VolumeSerialNumber: 'A1B2C3D4' }]))
    const reader = createWindowsVolumeReader({ expectedIds: ['MAXLABEL-KEY'], exec })
    await expect(reader.read()).resolves.toMatchObject({ present: true, valid: true })
  })

  it('treats a system-command failure as unreadable, never valid', async () => {
    const reader = createWindowsVolumeReader({ expectedIds: ['MAXLABEL-KEY'], exec: vi.fn(async () => { throw new Error('powershell failed') }) })
    await expect(reader.read()).resolves.toEqual({ present: false, valid: false, reason: 'unreadable' })
  })

  it('reads the vendor authorization result from the configured source', async () => {
    const reader = createVendorReader(async () => JSON.stringify({ present: true, valid: true, identifier: 'VENDOR-1234' }))
    const result = await reader.read()
    expect(result).toMatchObject({ present: true, valid: true, identifierMasked: 'VE****34' })
    expect(JSON.stringify(result)).not.toContain('VENDOR-1234')
  })

  it('does not fall back to the development reader in packaged builds', async () => {
    const env = { MAXLABEL_DONGLE_IDS: 'MAXLABEL-KEY' }
    const packaged = createConfiguredReader({ packaged: true, env, platform: 'win32' })
    await expect(packaged.read()).resolves.toEqual({ present: false, valid: false, reason: 'unsupported' })
    const development = createConfiguredReader({
      packaged: false,
      env,
      platform: 'win32',
      exec: async () => JSON.stringify([{ DeviceID: 'E:', VolumeName: 'MAXLABEL-KEY' }])
    })
    await expect(development.read()).resolves.toMatchObject({ present: true, valid: true })
  })

  it('reports unsupported platforms without inventing a valid device', async () => {
    const reader = createConfiguredReader({ packaged: false, env: {}, platform: 'darwin' })
    await expect(reader.read()).resolves.toEqual({ present: false, valid: false, reason: 'unsupported' })
  })

  it('does not trust a local JSON file in packaged builds', async () => {
    const previous = process.env.MAXLABEL_DONGLE_VENDOR_FILE
    process.env.MAXLABEL_DONGLE_VENDOR_FILE = 'C:/fake/dongle.json'
    try {
      const reader = createConfiguredReader({ packaged: true, env: process.env, platform: 'win32' })
      await expect(reader.read()).resolves.toEqual({ present: false, valid: false, reason: 'unsupported' })
    } finally {
      if (previous === undefined) delete process.env.MAXLABEL_DONGLE_VENDOR_FILE
      else process.env.MAXLABEL_DONGLE_VENDOR_FILE = previous
    }
  })

  it('accepts a packaged vendor verification function', async () => {
    const reader = createConfiguredReader({
      packaged: true,
      platform: 'win32',
      vendorRead: async () => JSON.stringify({ present: true, valid: true, identifier: 'VENDOR-1' })
    })
    await expect(reader.read()).resolves.toMatchObject({ present: true, valid: true })
  })
})

describe('dongle watcher', () => {
  function state(result: DongleReadResult, checkedAt = '2026-10-23T00:00:00.000Z') {
    return { ...result, checkedAt }
  }

  it('emits only when the device state changes', async () => {
    const results = [state({ present: false, valid: false, reason: 'absent' }), state({ present: true, valid: true })]
    let index = 0
    const reader = { read: vi.fn(async () => results[Math.min(index++, results.length - 1)]) }
    const onChange = vi.fn()
    const watcher = createDongleWatcher(reader, { onChange, intervalMs: 1000, now: () => Date.parse('2026-10-23T00:00:00.000Z') })
    await watcher.readNow()
    await watcher.readNow()
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('does not emit when the state is unchanged', async () => {
    const reader = { read: vi.fn(async () => ({ present: true, valid: true })) }
    const onChange = vi.fn()
    const watcher = createDongleWatcher(reader, { onChange, intervalMs: 1000, now: () => Date.parse('2026-10-23T00:00:00.000Z') })
    await watcher.readNow()
    await watcher.readNow()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('detects a change within one 1-second polling interval', async () => {
    vi.useFakeTimers()
    try {
      let valid = false
      const reader = { read: vi.fn(async () => ({ present: valid, valid })) }
      const onChange = vi.fn()
      const watcher = createDongleWatcher(reader, { onChange, intervalMs: 1000, now: () => 0 })
      watcher.start()
      await vi.advanceTimersByTimeAsync(0)
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ valid: false }))

      valid = true
      await vi.advanceTimersByTimeAsync(1000)
      expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ valid: true }))
      watcher.stop()
    } finally {
      vi.useRealTimers()
    }
  })
})
