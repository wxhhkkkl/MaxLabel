import { describe, expect, it, vi } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { ScaleReadRequest, ScaleReadResult } from '@shared/scale/types'
import { createAutoPrintLoop } from '@/features/scale/useAutoPrint'
import { sampleDoc } from '../../../helpers/factories'

// 020：协议/端口/速率改由全局设置提供（不再读数据源上的旧字段）
vi.mock('@/features/scale/scalePreferences', () => ({
  readScaleSettings: () => ({ protocol: 'standard', port: 'COM3', baud: '9600', autoConnect: false }),
  writeScaleSettings: () => undefined,
  SCALE_SETTINGS_STORAGE_KEY: 'test.scaleSettings'
}))

function weighDoc(): LabelDoc {
  const base = sampleDoc()
  return {
    ...base,
    objects: base.objects.map((object) =>
      object.id === '2'
        ? {
            ...object,
            source: {
              kind: 'keyboard',
              label: '重量',
              inputDevice: 'weigh',
              weighProtocol: 'standard',
              weighPort: 'COM3',
              weighBaud: '9600',
              weighUnit: 'kg',
              weighDecimals: 2,
              weighAutoPrint: true
            }
          }
        : object
    )
  } as LabelDoc
}

async function until(check: () => boolean, timeout = 2000): Promise<void> {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('timed out waiting for condition')
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
}

function stable(value: number): ScaleReadResult {
  return { ok: true, reading: { value, unit: 'kg', stable: true, raw: '', timestamp: 0 } }
}

describe('electronic scale auto-print loop', () => {
  it('waits for unloading before printing a new item of the same weight', async () => {
    const read = vi.fn(async (_request: ScaleReadRequest): Promise<ScaleReadResult> => { throw new Error('unexpected read') })
      .mockResolvedValueOnce(stable(2.5))
      .mockResolvedValueOnce({ ok: false, messageKey: 'error.scaleWaiting' })
      .mockResolvedValueOnce(stable(0))
      .mockResolvedValueOnce(stable(2.5))
    const cancel = vi.fn(async () => ({ ok: true, canceled: true }))
    const values: Array<Record<string, string[]>> = []
    let loop: ReturnType<typeof createAutoPrintLoop>
    loop = createAutoPrintLoop({
      doc: weighDoc(),
      language: 'zh-CN',
      client: { read, cancel },
      onStatus: vi.fn(),
      printOne: async (scaleValues) => {
        values.push(scaleValues)
        if (values.length === 2) loop.stop()
        return true
      }
    })

    loop.start()
    await until(() => values.length === 2)
    await until(() => !loop.isActive())

    expect(read.mock.calls.map(([request]) => request.mode)).toEqual(['load', 'unload', 'unload', 'load'])
    expect(values.map((entry) => entry['重量'])).toEqual([['2.50'], ['2.50']])
    expect(values.every((entry) => entry['重量'].length === 1)).toBe(true)
  })

  it('stops a pending read and never prints a partial value', async () => {
    let settle: ((result: ScaleReadResult) => void) | null = null
    const read = vi.fn(() => new Promise<ScaleReadResult>((resolve) => { settle = resolve }))
    const cancel = vi.fn(async () => {
      settle?.({ ok: false, canceled: true })
      return { ok: true, canceled: true }
    })
    const printOne = vi.fn(async () => true)
    const loop = createAutoPrintLoop({ doc: weighDoc(), language: 'zh-CN', client: { read, cancel }, onStatus: vi.fn(), printOne })

    loop.start()
    await until(() => read.mock.calls.length === 1)
    loop.stop()
    await until(() => !loop.isActive())
    await new Promise((resolve) => setTimeout(resolve, 5))

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(printOne).not.toHaveBeenCalled()
  })

  it('does not print unstable or failed readings and stops with a message', async () => {
    const read = vi.fn(async (): Promise<ScaleReadResult> => ({ ok: false, messageKey: 'error.scaleInvalid', message: 'unstable' }))
    const onStatus = vi.fn()
    const printOne = vi.fn(async () => true)
    const loop = createAutoPrintLoop({
      doc: weighDoc(),
      language: 'en-US',
      client: { read, cancel: vi.fn(async () => ({ ok: true, canceled: true })) },
      onStatus,
      printOne
    })

    loop.start()
    await until(() => !loop.isActive())

    expect(read).toHaveBeenCalledTimes(1)
    expect(printOne).not.toHaveBeenCalled()
    expect(onStatus.mock.calls.flat().join(' ')).toContain('Invalid scale weight')
  })

  it('stops after a failed or canceled print without taking another measurement', async () => {
    const read = vi.fn(async () => stable(2.5))
    const printOne = vi.fn(async () => false)
    const loop = createAutoPrintLoop({
      doc: weighDoc(), language: 'en-US', printOne, onStatus: vi.fn(),
      client: { read, cancel: vi.fn() }
    })
    loop.start()
    await until(() => !loop.isActive())
    expect(printOne).toHaveBeenCalledOnce()
    expect(read).toHaveBeenCalledOnce()
  })
})
