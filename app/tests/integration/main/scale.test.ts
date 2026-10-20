import { beforeEach, describe, expect, it } from 'vitest'
import { cancelScaleRead, readScale, ScaleCanceledError, ScaleError, testScale } from '@main/scale/serialScale'
import type { ScaleReadRequest, ScaleTestRequest } from '@shared/scale/types'
import { FakeScaleTransport, STANDARD_FRAMES } from '../../helpers/scale'

function request(overrides: Partial<ScaleReadRequest> = {}): ScaleReadRequest {
  return {
    requestId: `r-${Math.random().toString(36).slice(2)}`,
    protocol: 'standard',
    port: 'COM3',
    baud: '9600',
    unit: 'kg',
    decimals: 2,
    unitConv: false,
    timeoutMs: 200,
    ...overrides
  }
}

function testRequest(overrides: Partial<ScaleTestRequest> = {}): ScaleTestRequest {
  return { protocol: 'standard', port: 'COM3', baud: '9600', unit: 'kg', decimals: 2, timeoutMs: 200, ...overrides }
}

beforeEach(() => {
  // No shared state to reset beyond completing reads in each test.
})

describe('scale read lifecycle', () => {
  it('requires two equal stable frames and closes the port', async () => {
    const fake = new FakeScaleTransport([STANDARD_FRAMES.stable, STANDARD_FRAMES.stableAgain])
    const reading = await readScale(request(), async () => fake)
    expect(reading).toMatchObject({ value: 1.234, unit: 'kg', stable: true })
    expect(fake.opened).toEqual([{ port: 'COM3', baud: '9600' }])
    expect(fake.closed).toBe(1)
  })

  it('ignores malformed frames and keeps waiting for a stable value', async () => {
    const fake = new FakeScaleTransport([STANDARD_FRAMES.malformed, STANDARD_FRAMES.stable, STANDARD_FRAMES.stable])
    await expect(readScale(request(), async () => fake)).resolves.toMatchObject({ value: 1.234 })
    expect(fake.closed).toBe(1)
  })

  it('times out without a stable value and releases the port', async () => {
    const fake = new FakeScaleTransport([STANDARD_FRAMES.unstable])
    await expect(readScale(request({ timeoutMs: 40 }), async () => fake)).rejects.toMatchObject({ messageKey: 'error.scaleTimeout' })
    expect(fake.closed).toBe(1)
  })

  it('rejects overload, zero and negative readings immediately', async () => {
    for (const frame of [STANDARD_FRAMES.overload, STANDARD_FRAMES.zero, STANDARD_FRAMES.negative]) {
      const fake = new FakeScaleTransport([frame])
      await expect(readScale(request(), async () => fake)).rejects.toMatchObject({ messageKey: 'error.scaleInvalid' })
      expect(fake.closed).toBe(1)
    }
  })

  it('maps an open failure to a port error', async () => {
    const fake = new FakeScaleTransport([], { openError: 'COM3 busy' })
    await expect(readScale(request(), async () => fake)).rejects.toMatchObject({ messageKey: 'error.scalePort' })
    expect(fake.closed).toBe(1)
  })

  it('cancels an active read and releases the port', async () => {
    const fake = new FakeScaleTransport([])
    const active = readScale(request({ requestId: 'cancel-me', timeoutMs: 5000 }), async () => fake)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(cancelScaleRead('cancel-me')).toEqual({ ok: true, canceled: true })
    await expect(active).rejects.toBeInstanceOf(ScaleCanceledError)
    expect(fake.closed).toBe(1)
    expect(cancelScaleRead('cancel-me')).toEqual({ ok: true, canceled: false })
  })

  it('rejects a concurrent read while one is active', async () => {
    const fake = new FakeScaleTransport([])
    const first = readScale(request({ requestId: 'first', timeoutMs: 5000 }), async () => fake)
    await new Promise((resolve) => setTimeout(resolve, 10))
    await expect(readScale(request({ requestId: 'second' }), async () => new FakeScaleTransport([]))).rejects.toMatchObject({ messageKey: 'error.scaleBusy' })
    cancelScaleRead('first')
    await expect(first).rejects.toBeInstanceOf(ScaleCanceledError)
  })

  it('reports diagnostics for a stable scale', async () => {
    const fake = new FakeScaleTransport([STANDARD_FRAMES.stable])
    const result = await testScale(testRequest(), async () => fake)
    expect(result).toMatchObject({ ok: true, portOpened: true, stable: true, value: 1.234, unit: 'kg' })
    expect(result.frames.length).toBeGreaterThan(0)
    expect(fake.closed).toBe(1)
  })

  it('reports a port error in the connection test', async () => {
    const fake = new FakeScaleTransport([], { openError: 'no port' })
    const result = await testScale(testRequest(), async () => fake)
    expect(result).toMatchObject({ ok: false, portOpened: false, messageKey: 'error.scalePort' })
    expect(fake.closed).toBe(1)
  })

  it('throws ScaleError instances for readable diagnostics', async () => {
    const fake = new FakeScaleTransport([STANDARD_FRAMES.overload])
    await expect(readScale(request(), async () => fake)).rejects.toBeInstanceOf(ScaleError)
  })

  it('rejects underload and negative readings', async () => {
    for (const frame of [STANDARD_FRAMES.underload, STANDARD_FRAMES.negative]) {
      const fake = new FakeScaleTransport([frame])
      await expect(readScale(request(), async () => fake)).rejects.toMatchObject({ messageKey: 'error.scaleInvalid' })
    }
  })

  it('ignores malformed frames until the timeout', async () => {
    const fake = new FakeScaleTransport([STANDARD_FRAMES.malformed])
    await expect(readScale(request({ timeoutMs: 40 }), async () => fake)).rejects.toMatchObject({ messageKey: 'error.scaleTimeout' })
    expect(fake.closed).toBe(1)
  })

  it('reports unstable diagnostics from the connection test', async () => {
    const fake = new FakeScaleTransport([STANDARD_FRAMES.unstable])
    const result = await testScale(testRequest({ timeoutMs: 40 }), async () => fake)
    expect(result).toMatchObject({ ok: false, portOpened: true, stable: false })
    expect(result.frames.length).toBeGreaterThan(0)
    expect(fake.closed).toBe(1)
  })
})
