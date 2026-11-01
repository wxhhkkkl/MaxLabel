import { describe, expect, it } from 'vitest'
import { validateScaleReadPayload, validateScaleTestPayload } from '@main/ipc/validation'
import { normalizeScalePortList } from '@main/scale/ports'
import { IPC_CHANNELS } from '@shared/ipcContract'

const valid = {
  requestId: 'read-1',
  protocol: 'standard',
  port: 'COM3',
  baud: '9600',
  unit: 'kg',
  decimals: 2,
  unitConv: false,
  timeoutMs: 5000
}

describe('scale IPC payload contract', () => {
  it('accepts and normalizes a valid read payload', () => {
    expect(validateScaleReadPayload(valid)).toMatchObject({
      requestId: 'read-1',
      protocol: 'standard',
      port: 'COM3',
      baud: '9600',
      unit: 'kg',
      decimals: 2,
      unitConv: false,
      timeoutMs: 5000
    })
    expect(validateScaleReadPayload({ ...valid, port: ' /dev/ttyUSB0 ', decimals: 0, unitConv: true })).toMatchObject({
      port: '/dev/ttyUSB0',
      decimals: 0,
      unitConv: true
    })
  })

  it('rejects invalid protocols, ports, bauds, units, decimals and timeouts', () => {
    expect(() => validateScaleReadPayload({ ...valid, protocol: 'unknown' })).toThrow()
    expect(() => validateScaleReadPayload({ ...valid, port: '' })).toThrow()
    expect(() => validateScaleReadPayload({ ...valid, port: 'rm -rf /' })).toThrow()
    expect(() => validateScaleReadPayload({ ...valid, port: 'X'.repeat(33) })).toThrow()
    expect(() => validateScaleReadPayload({ ...valid, baud: '1234' })).toThrow()
    expect(() => validateScaleReadPayload({ ...valid, unit: 'stone' })).toThrow()
    expect(() => validateScaleReadPayload({ ...valid, decimals: 5 })).toThrow()
    expect(() => validateScaleReadPayload({ ...valid, timeoutMs: 0 })).toThrow()
    expect(() => validateScaleReadPayload({ ...valid, timeoutMs: 30001 })).toThrow()
    expect(() => validateScaleReadPayload({ requestId: '' })).toThrow()
  })

  it('validates the test-connection payload without a request id', () => {
    const { requestId: _requestId, unitConv: _unitConv, ...testPayload } = valid
    expect(validateScaleTestPayload(testPayload)).toMatchObject({ protocol: 'standard', port: 'COM3', unit: 'kg' })
    expect(() => validateScaleTestPayload({ ...testPayload, port: '' })).toThrow()
  })
})

describe('scale port enumeration（020 / 端口下拉）', () => {
  it('注册了端口枚举通道', () => {
    expect(IPC_CHANNELS.scaleListPorts).toBe('scale:list-ports')
  })

  it('归一化 serialport 的返回：去空白、去重、丢掉没有 path 的脏项、按路径排序', () => {
    expect(normalizeScalePortList([
      { path: ' COM4 ' },
      { path: 'COM3', manufacturer: 'Bluetooth' },
      { manufacturer: 'no path' },
      null,
      'COM9',
      { path: 'COM3', manufacturer: '重复项' }
    ])).toEqual([
      { path: 'COM3', manufacturer: 'Bluetooth' },
      { path: 'COM4' }
    ])
  })

  it('非数组输入返回空列表', () => {
    expect(normalizeScalePortList(undefined)).toEqual([])
    expect(normalizeScalePortList({ path: 'COM3' })).toEqual([])
  })
})
