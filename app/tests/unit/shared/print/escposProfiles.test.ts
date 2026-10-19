import { describe, expect, it } from 'vitest'
import { escposProfileFor, ESC_POS_PROFILES, recommendEscPosProfile } from '@shared/print/escposProfiles'
import { printerConfig } from '../../../helpers/factories'

describe('ESC/POS profiles', () => {
  it('exposes a conservative generic profile', () => {
    expect(ESC_POS_PROFILES.generic).toMatchObject({
      paperWidthMm: 80,
      dpi: 203,
      printableDots: 576,
      supportsQR: false,
      supportsPDF417: false,
      supportsDataMatrix: false
    })
  })

  it('selects known profiles and applies config overrides', () => {
    const epson = escposProfileFor(printerConfig({ driver: 'escpos', escposProfile: 'epson-tm-t88' }))
    expect(epson.paperWidthMm).toBe(80)
    expect(epson.supportsQR).toBe(true)

    const small = escposProfileFor(printerConfig({ driver: 'escpos', escposProfile: 'generic', escposPaperWidthMm: 58 }))
    expect(small.paperWidthMm).toBe(58)
    expect(small.printableDots).toBe(384)
  })

  it('falls back to generic for an unknown profile', () => {
    const profile = escposProfileFor(printerConfig({ driver: 'escpos', escposProfile: 'unknown-model' }))
    expect(profile.id).toBe('generic')
  })

  it('recommends a profile from a printer/model name', () => {
    expect(recommendEscPosProfile('EPSON TM-T88VI')).toBe('epson-tm-t88')
    expect(recommendEscPosProfile('Epson TM-T82')).toBe('epson-tm-t82')
    expect(recommendEscPosProfile('Xprinter XP-58IIH')).toBe('xprinter-xp-58')
    expect(recommendEscPosProfile('Unknown POS')).toBe('generic')
  })
})
