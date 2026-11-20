import { describe, expect, it } from 'vitest'
import { commandSetForLanguageFamily, printerLanguageFamily } from '@shared/domain/printer'

describe('printer language families', () => {
  it('recognises TSPL-compatible models', () => {
    for (const name of [
      'TSC TSPL-N (203 dpi)',
      'HPRT TSPL-N (203 dpi)',
      'Argox PPLA-N (203 dpi)',
      'SNBC BPLA-U (203 dpi)',
      'Leden APL-N (203 dpi)',
      'MASUNG MTPL-N (203 dpi)',
      'Jolimark CLP-180-N (203 dpi)',
      'AMYDOR AMD-N (203 dpi)'
    ]) {
      expect(printerLanguageFamily(name), name).toBe('tspl')
    }
  })

  it('recognises ZPL-compatible models', () => {
    for (const name of [
      'Zebra ZPL-N (203 dpi)',
      'Gprinter GPLZ-N (203 dpi)',
      'GoDEX EZPL-N (203 dpi)',
      'SNBC BPLZ-N (203 dpi)',
      'Leden APLZ-N (203 dpi)',
      'START SPLZ-N (203 dpi)',
      'JQTEK JPL-N (203 dpi)'
    ]) {
      expect(printerLanguageFamily(name), name).toBe('zpl')
    }
  })

  it('recognises EPL-family models', () => {
    for (const name of ['Zebra EPL-N (203 dpi)', 'Argox PPLB-N (203 dpi)', 'SNBC BPLE-N (203 dpi)', 'Postek PPLE-N (203 dpi)']) {
      expect(printerLanguageFamily(name), name).toBe('epl')
    }
    expect(commandSetForLanguageFamily('epl')).toBe('epl')
  })

  it('recognises CPCL and ESC/POS models', () => {
    expect(printerLanguageFamily('Zebra CPCL-N (203 dpi)')).toBe('cpcl')
    expect(printerLanguageFamily('Gprinter ESCPOS-N (200 dpi)')).toBe('escpos')
    expect(printerLanguageFamily('POS-58 ESCPOS-N (200 dpi)')).toBe('escpos')
  })

  it('recognises TPCL models', () => {
    expect(printerLanguageFamily('TOSHIBA-TEC TPCL-N (203 dpi)')).toBe('tpcl')
    expect(commandSetForLanguageFamily('tpcl')).toBe('tpcl')
  })

  it('recognises PGL and SATO models', () => {
    expect(printerLanguageFamily('Printronix PGL-N (203 dpi)')).toBe('pgl')
    expect(printerLanguageFamily('SATO CLNX-N (203 dpi)')).toBe('sato')
    expect(printerLanguageFamily('SATO SBPL-N (203 dpi)')).toBe('sato')
    expect(commandSetForLanguageFamily('pgl')).toBe('pgl')
    expect(commandSetForLanguageFamily('sato')).toBe('sato')
  })

  it('leaves unrecognised private command sets unsupported', () => {
    for (const name of ['Datamax I-Class (203 dpi)', 'Intermec PM4i (203 dpi)']) {
      expect(printerLanguageFamily(name), name).toBe('other')
      expect(commandSetForLanguageFamily('other')).toBeUndefined()
    }
  })
})
