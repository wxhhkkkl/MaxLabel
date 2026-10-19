import type { EscPosCut, EscPosPaperWidthMm, PrinterConfig } from '../domain/printer'

export interface EscPosProfile {
  id: string
  brand: string
  model: string
  paperWidthMm: EscPosPaperWidthMm
  dpi: number
  printableDots: number
  codePages: string[]
  defaultCodePage: string
  supports1D: boolean
  supportsQR: boolean
  supportsPDF417: boolean
  supportsDataMatrix: boolean
  supportsCut: EscPosCut
  supportsDrawer: boolean
  notes: string
}

function printableDots(paperWidthMm: EscPosPaperWidthMm, dpi: number): number {
  if (paperWidthMm === 58) return dpi >= 300 ? 512 : 384
  return dpi >= 300 ? 832 : 576
}

function profile(value: Omit<EscPosProfile, 'printableDots'>): EscPosProfile {
  return { ...value, printableDots: printableDots(value.paperWidthMm, value.dpi) }
}

export const ESC_POS_PROFILES: Record<string, EscPosProfile> = {
  generic: profile({
    id: 'generic',
    brand: 'Generic',
    model: 'ESC/POS compatible',
    paperWidthMm: 80,
    dpi: 203,
    codePages: ['CP437'],
    defaultCodePage: 'CP437',
    supports1D: true,
    supportsQR: false,
    supportsPDF417: false,
    supportsDataMatrix: false,
    supportsCut: 'none',
    supportsDrawer: false,
    notes: 'Conservative default: 1D + raster only; no native 2D/cut/drawer.'
  }),
  'epson-tm-t88': profile({
    id: 'epson-tm-t88',
    brand: 'Epson',
    model: 'TM-T88',
    paperWidthMm: 80,
    dpi: 203,
    codePages: ['CP437', 'CP850', 'CP1252', 'CP936'],
    defaultCodePage: 'CP437',
    supports1D: true,
    supportsQR: true,
    supportsPDF417: true,
    supportsDataMatrix: true,
    supportsCut: 'full',
    supportsDrawer: true,
    notes: 'Epson-compatible 80 mm profile; verify PDF417/DataMatrix per firmware.'
  }),
  'epson-tm-t82': profile({
    id: 'epson-tm-t82',
    brand: 'Epson',
    model: 'TM-T82',
    paperWidthMm: 80,
    dpi: 203,
    codePages: ['CP437', 'CP850', 'CP1252', 'CP936'],
    defaultCodePage: 'CP437',
    supports1D: true,
    supportsQR: true,
    supportsPDF417: false,
    supportsDataMatrix: false,
    supportsCut: 'full',
    supportsDrawer: true,
    notes: '80 mm Epson-compatible; QR only.'
  }),
  'xprinter-xp-58': profile({
    id: 'xprinter-xp-58',
    brand: 'Xprinter',
    model: 'XP-58 series',
    paperWidthMm: 58,
    dpi: 203,
    codePages: ['CP437', 'CP936'],
    defaultCodePage: 'CP437',
    supports1D: true,
    supportsQR: true,
    supportsPDF417: false,
    supportsDataMatrix: false,
    supportsCut: 'partial',
    supportsDrawer: true,
    notes: '58 mm profile; printable width validated against 384 dots.'
  })
}

/** Resolve the profile for a printer, applying paper-width/dpi config overrides. */
export function escposProfileFor(printer: Pick<PrinterConfig, 'driver' | 'escposProfile' | 'escposPaperWidthMm' | 'dpi'>): EscPosProfile {
  const selected = ESC_POS_PROFILES[printer.escposProfile ?? 'generic'] ?? ESC_POS_PROFILES.generic
  const paperWidthMm = printer.escposPaperWidthMm ?? selected.paperWidthMm
  const dpi = Number.isFinite(printer.dpi) && printer.dpi > 0 ? printer.dpi : selected.dpi
  if (paperWidthMm === selected.paperWidthMm && dpi === selected.dpi) return selected
  return { ...selected, paperWidthMm, dpi, printableDots: printableDots(paperWidthMm, dpi) }
}

/** Best-effort profile recommendation from a model/printer name. */
export function recommendEscPosProfile(name: string): string {
  const text = String(name ?? '').toLowerCase()
  if (text.includes('tm-t88') || (text.includes('epson') && !text.includes('tm-t82'))) return 'epson-tm-t88'
  if (text.includes('tm-t82')) return 'epson-tm-t82'
  if (text.includes('58') || text.includes('xp-58')) return 'xprinter-xp-58'
  return 'generic'
}

export { printableDots as escposPrintableDots }
