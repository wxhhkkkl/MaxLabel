import { describe, expect, it, vi } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { ScaleReadResult } from '@shared/scale/types'
import { createAutoPrintLoop } from '@/features/scale/useAutoPrint'
import { sampleDoc } from '../../../helpers/factories'

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
  it('prints exactly one logical label per stable reading', async () => {
    let reads = 0
    const read = vi.fn(async () => stable((reads += 1)))
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
        if (values.length === 3) loop.stop()
      }
    })

    loop.start()
    await until(() => values.length === 3)
    await until(() => !loop.isActive())

    expect(read).toHaveBeenCalledTimes(3)
    expect(values.map((entry) => entry['重量'])).toEqual([['1.00'], ['2.00'], ['3.00']])
    expect(values.every((entry) => entry['重量'].length === 1)).toBe(true)
  })

  it('stops a pending read and never prints a partial value', async () => {
    let settle: ((result: ScaleReadResult) => void) | null = null
    const read = vi.fn(() => new Promise<ScaleReadResult>((resolve) => { settle = resolve }))
    const cancel = vi.fn(async () => {
      settle?.({ ok: false, canceled: true })
      return { ok: true, canceled: true }
    })
    const printOne = vi.fn(async () => undefined)
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
    const printOne = vi.fn(async () => undefined)
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
})
