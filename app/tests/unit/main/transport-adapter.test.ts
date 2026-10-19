import { describe, expect, it } from 'vitest'
import { createTransportAdapter } from '@main/printing/transports'

describe('platform transport adapter selection', () => {
  it('selects the Windows adapter on win32', () => {
    expect(createTransportAdapter('win32').kind).toBe('windows')
  })

  it('selects the unix adapter on macOS and Linux', () => {
    expect(createTransportAdapter('darwin').kind).toBe('unix')
    expect(createTransportAdapter('linux').kind).toBe('unix')
  })

  it('falls back to unix for other platforms', () => {
    expect(createTransportAdapter('freebsd').kind).toBe('unix')
  })
})
