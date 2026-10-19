import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '@shared/domain'
import type { PrinterConfig } from '@shared/domain/printer'
import { fromDocJson, toMsdx } from '@/io/msdx'
import { printerConfig, sampleDoc } from '../../../helpers/factories'

function normalizePrinter(printer: Partial<PrinterConfig>): PrinterConfig | undefined {
  return normalizeDocument({ ...sampleDoc(), printer: printerConfig(printer) }).printer
}

describe('ESC/POS printer configuration', () => {
  it('preserves the escpos command set and its fields through normalization', () => {
    const printer = normalizePrinter({
      driver: 'escpos' as never,
      escposPaperWidthMm: 80,
      escposCodePage: 'CP437',
      escposCut: 'full',
      escposDrawer: 'pin2',
      escposFeedLines: 2
    })
    expect(printer?.driver).toBe('escpos')
    expect(printer?.escposPaperWidthMm).toBe(80)
    expect(printer?.escposCodePage).toBe('CP437')
    expect(printer?.escposCut).toBe('full')
    expect(printer?.escposDrawer).toBe('pin2')
    expect(printer?.escposFeedLines).toBe(2)
  })

  it('falls back to conservative defaults for invalid ESC/POS values', () => {
    const printer = normalizePrinter({
      driver: 'escpos' as never,
      escposPaperWidthMm: 60 as never,
      escposCut: 'half' as never,
      escposDrawer: 'pin9' as never,
      escposFeedLines: 99
    })
    expect(printer?.escposPaperWidthMm).toBe(80)
    expect(printer?.escposCut).toBe('none')
    expect(printer?.escposDrawer).toBe('none')
    expect(printer?.escposFeedLines).toBe(10)
  })

  it('round-trips ESC/POS settings through the template envelope', () => {
    const doc = normalizeDocument({
      ...sampleDoc(),
      printer: printerConfig({
        driver: 'escpos',
        escposProfile: 'epson-tm-t88',
        escposPaperWidthMm: 58,
        escposCodePage: 'CP437',
        escposCut: 'partial',
        escposDrawer: 'pin5',
        escposFeedLines: 3
      })
    })
    const reopened = fromDocJson(toMsdx(doc))
    expect(reopened.printer).toMatchObject({
      driver: 'escpos',
      escposProfile: 'epson-tm-t88',
      escposPaperWidthMm: 58,
      escposCodePage: 'CP437',
      escposCut: 'partial',
      escposDrawer: 'pin5',
      escposFeedLines: 3
    })
  })
})
