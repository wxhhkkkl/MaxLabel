import { describe, expect, it } from 'vitest'
import { CONFIGURED_PRINTER_VALUE, mediaTypeOfSelection } from '@/features/label-formats/mediaType'
import { LABELSHOP_PRINTER, comPrinter, driverPrinter } from '../../helpers/labelFormats'

describe('label-format media classification', () => {
  it('treats a 签赋 LabelShop printer as roll media', () => {
    expect(mediaTypeOfSelection(driverPrinter(), LABELSHOP_PRINTER)).toBe(0)
  })

  it('treats a Windows driver printer as sheet media', () => {
    expect(mediaTypeOfSelection(driverPrinter({ printerName: 'HP LaserJet Pro M329' }), 'HP7E6C81')).toBe(1)
  })

  it('recognises common label-brand driver names as roll media', () => {
    for (const name of ['Gprinter GPL-N', 'Zebra ZD421', 'Xprinter XP-365B', 'HPRT SL42', 'TSC TSPL-N', 'Argox OS-214', '佳博 GP-1324D']) {
      expect(mediaTypeOfSelection(driverPrinter({ printerName: name }), name)).toBe(0)
    }
  })

  it('uses the configured port when no explicit printer is selected', () => {
    expect(mediaTypeOfSelection(comPrinter(), '')).toBe(0)
    expect(mediaTypeOfSelection(driverPrinter({ printerName: 'Zebra ZD421' }), CONFIGURED_PRINTER_VALUE)).toBe(0)
    expect(mediaTypeOfSelection(driverPrinter({ printerName: 'HP LaserJet Pro M329' }), CONFIGURED_PRINTER_VALUE)).toBe(1)
  })

  it('falls back to the configured printer identity when the selection is empty', () => {
    expect(mediaTypeOfSelection(driverPrinter({ model: 'Gprinter GPL-N' }), '')).toBe(0)
    expect(mediaTypeOfSelection(driverPrinter(), '')).toBe(1)
  })
})
