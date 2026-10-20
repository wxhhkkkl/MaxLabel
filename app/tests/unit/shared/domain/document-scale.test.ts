import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '@shared/domain'
import type { LabelDoc } from '@shared/domain/document'
import { sampleDoc } from '../../../helpers/factories'

function weighDoc(source: Record<string, unknown>): unknown {
  const base = sampleDoc()
  return {
    ...base,
    objects: base.objects.map((object) =>
      object.id === '2'
        ? { ...object, source: { kind: 'keyboard', label: '重量', inputDevice: 'weigh', ...source } }
        : object
    )
  }
}

function weighSourceOf(doc: LabelDoc): Record<string, unknown> {
  const object = doc.objects.find((item) => item.id === '2')
  return (object as unknown as { source: Record<string, unknown> }).source
}

describe('document scale configuration normalization', () => {
  it('keeps a valid weigh configuration', () => {
    const doc = normalizeDocument(weighDoc({ weighPort: 'COM3', weighProtocol: 'ad', weighBaud: '19200', weighUnit: 'jin', weighDecimals: 4, weighAutoPrint: true, weighUnitConv: true }))
    expect(weighSourceOf(doc)).toMatchObject({
      inputDevice: 'weigh',
      weighPort: 'COM3',
      weighProtocol: 'ad',
      weighBaud: '19200',
      weighUnit: 'jin',
      weighDecimals: 4,
      weighAutoPrint: true,
      weighUnitConv: true
    })
  })

  it('trims the serial port and rejects ports longer than 32 characters', () => {
    expect(weighSourceOf(normalizeDocument(weighDoc({ weighPort: '  COM7  ' }))).weighPort).toBe('COM7')
    expect(() => normalizeDocument(weighDoc({ weighPort: 'X'.repeat(33) }))).toThrow()
  })

  it('falls back to supported protocol, unit and baud values', () => {
    const source = weighSourceOf(normalizeDocument(weighDoc({ weighProtocol: 'unknown', weighUnit: 'stone', weighBaud: '1234' })))
    expect(source).toMatchObject({ weighProtocol: 'kasda', weighUnit: 'kg', weighBaud: '9600' })
  })

  it('rejects decimals outside 0–4', () => {
    expect(() => normalizeDocument(weighDoc({ weighDecimals: 5 }))).toThrow()
    expect(() => normalizeDocument(weighDoc({ weighDecimals: -1 }))).toThrow()
  })

  it('only accepts the declared baud rates', () => {
    for (const baud of ['2400', '4800', '9600', '19200', '38400']) {
      expect(weighSourceOf(normalizeDocument(weighDoc({ weighBaud: baud }))).weighBaud).toBe(baud)
    }
    expect(weighSourceOf(normalizeDocument(weighDoc({ weighBaud: '115200' }))).weighBaud).toBe('9600')
  })
})
