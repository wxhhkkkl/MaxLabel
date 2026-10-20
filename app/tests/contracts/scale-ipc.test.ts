import { describe, expect, it } from 'vitest'
import { validateScaleReadPayload, validateScaleTestPayload } from '@main/ipc/validation'

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
