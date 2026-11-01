import { describe, expect, it, vi } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { KeyboardSource } from '@shared/domain/datasource'
import type { ScaleReadRequest } from '@shared/scale/types'
import { DEFAULT_SCALE_SETTINGS } from '@shared/scale/settings'
import {
  ScaleResolutionError,
  resolveWeights,
  type ScaleReadClient
} from '@/features/scale/resolveWeights'

/**
 * 取重时用**全局设备设置**（020 / 所有者决定「全局一份」）：
 * 协议 / 端口 / 速率是设备属性，从全局设置读；单位 / 小数位 / 换算属于**标签**语义，仍取数据源。
 */

function weighDoc(overrides: Partial<KeyboardSource> = {}): LabelDoc {
  const source: KeyboardSource = {
    kind: 'keyboard',
    label: '重量',
    inputDevice: 'weigh',
    weighProtocol: 'ad',
    weighPort: 'COM9',
    weighBaud: '4800',
    weighUnit: 'g',
    weighDecimals: 3,
    weighUnitConv: false,
    ...overrides
  }
  return {
    version: 3,
    name: 't',
    widthMm: 100,
    heightMm: 100,
    objects: [{ id: 'o1', type: 'text', x: 0, y: 0, w: 10, h: 10, rotation: 0, text: 'x', source }]
  } as unknown as LabelDoc
}

function fakeClient(reading = { value: 1.234, unit: 'kg' as const, stable: true, raw: '', timestamp: 0 }) {
  const calls: ScaleReadRequest[] = []
  const client: ScaleReadClient = {
    read: vi.fn(async (payload: ScaleReadRequest) => {
      calls.push(payload)
      return { ok: true, reading }
    }),
    cancel: vi.fn(async () => ({ ok: true, canceled: false }))
  }
  return { client, calls }
}

describe('电子称取重 —— 设备参数取全局设置', () => {
  it('协议 / 端口 / 速率来自全局设置，而不是数据源里的旧值', async () => {
    const { client, calls } = fakeClient()
    await resolveWeights(weighDoc(), {
      count: 1,
      client,
      settings: { protocol: 'standard', port: 'COM3', baud: '19200', autoConnect: false }
    })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ protocol: 'standard', port: 'COM3', baud: '19200' })
  })

  it('单位与小数位仍按数据源（标签语义）', async () => {
    const { client, calls } = fakeClient({ value: 1234, unit: 'g', stable: true, raw: '', timestamp: 0 })
    const values = await resolveWeights(weighDoc({ weighUnit: 'kg', weighDecimals: 1, weighUnitConv: true }), {
      count: 1,
      client,
      settings: { ...DEFAULT_SCALE_SETTINGS, port: 'COM1' }
    })

    expect(calls[0]).toMatchObject({ unit: 'kg', decimals: 1, unitConv: true })
    // 1234 g → 1.234 kg，保留 1 位小数
    expect(values['重量']).toEqual(['1.2'])
  })

  it('全局设置为空端口时直接报端口错误，不去碰串口', async () => {
    const { client, calls } = fakeClient()
    await expect(resolveWeights(weighDoc(), {
      count: 1,
      client,
      settings: { ...DEFAULT_SCALE_SETTINGS, port: '' }
    })).rejects.toBeInstanceOf(ScaleResolutionError)
    expect(calls).toHaveLength(0)
  })
})
