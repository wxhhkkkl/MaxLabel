import { describe, expect, it } from 'vitest'
import type { PrinterConfig } from '@shared/domain/printer'
import { buildCommands } from '@shared/print/engine'
import { printerConfig, sampleDoc } from '../../../helpers/factories'

function zpl(overrides: Partial<PrinterConfig> = {}) {
  return buildCommands(sampleDoc(), printerConfig({ driver: 'zpl', port: { type: 'file', encoding: 'utf8' }, ...overrides }), {
    count: 1,
    copy: 1,
    title: '测试',
    datasets: {}
  }).text
}

describe('ZPL command output', () => {
  it('wraps labels in ^XA/^XZ with width, length and quantity', () => {
    const text = zpl()
    expect(text).toContain('^XA')
    expect(text).toContain('^XZ')
    expect(text).toContain('^PW480')
    expect(text).toContain('^LL320,Y')
    expect(text).toContain('^PQ1')
  })

  it('emits barcode and field commands', () => {
    const text = zpl()
    expect(text).toContain('^BC')
    expect(text).toContain('^FD')
    expect(text).toContain('^FO')
  })

  it('selects thermal or transfer print mode', () => {
    expect(zpl({ printMode: 'thermal' })).toContain('^MTD')
    expect(zpl({ printMode: 'transfer' })).toContain('^MTT')
  })
})
