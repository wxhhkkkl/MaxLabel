import { describe, expect, it } from 'vitest'
import { validatePrintLogPayload } from '@main/ipc/validation'
import { logPayload } from '../../helpers/logs'

describe('print log payload validation', () => {
  it('accepts a complete valid payload', () => {
    const payload = logPayload({ dataSnapshot: ['A | B', ''] })
    expect(validatePrintLogPayload(payload)).toMatchObject(payload)
  })

  it('requires time, a known mode and a boolean test flag', () => {
    expect(() => validatePrintLogPayload(logPayload({ time: '' }))).toThrow()
    expect(() => validatePrintLogPayload(logPayload({ mode: 'other' as never }))).toThrow()
    expect(() => validatePrintLogPayload(logPayload({ test: 'yes' as never }))).toThrow()
  })

  it('bounds text fields', () => {
    expect(() => validatePrintLogPayload(logPayload({ title: 'x'.repeat(256) }))).toThrow()
    expect(() => validatePrintLogPayload(logPayload({ printer: 'x'.repeat(256) }))).toThrow()
    expect(() => validatePrintLogPayload(logPayload({ time: 'x'.repeat(129) }))).toThrow()
  })

  it('bounds counts and rejects non-integers', () => {
    for (const value of [-1, 100001, 1.5]) {
      expect(() => validatePrintLogPayload(logPayload({ count: value }))).toThrow()
    }
    for (const value of [-1, 100000, 1.5]) {
      expect(() => validatePrintLogPayload(logPayload({ copies: value }))).toThrow()
    }
    expect(() => validatePrintLogPayload(logPayload({ physicalCount: -1 }))).toThrow()
    expect(() => validatePrintLogPayload(logPayload({ sentCount: 10_000_000_000 }))).toThrow()
  })

  it('accepts every documented status and rejects unknown values', () => {
    for (const status of ['completed', 'submitted', 'partial', 'failed', 'canceled', 'unknown'] as const) {
      expect(validatePrintLogPayload(logPayload({ status })).status).toBe(status)
    }
    expect(() => validatePrintLogPayload(logPayload({ status: 'other' as never }))).toThrow()
  })

  it('limits snapshot lines, line length and total size', () => {
    expect(() => validatePrintLogPayload(logPayload({ dataSnapshot: Array.from({ length: 100001 }, () => '') }))).toThrow()
    expect(() => validatePrintLogPayload(logPayload({ dataSnapshot: ['x'.repeat(1024 * 1024 + 1)] }))).toThrow()
    expect(() => validatePrintLogPayload(logPayload({ dataSnapshot: Array.from({ length: 17 }, () => 'x'.repeat(1024 * 1024)) }))).toThrow()
  })
})
