import type { PrinterConfig } from '../../../../shared/domain/printer'
import { defaultPrinterConfig } from '../../../../shared/domain/printer'
import { normalizeDocument } from '../../../../shared/domain/document'

export const DEFAULT_PRINTER_STORAGE_KEY = 'maxlabel.defaultPrinter'

/** Read the last printer preference without allowing malformed localStorage to
 * enter the document model. A template printer still takes precedence. */
export function readDefaultPrinter(): PrinterConfig {
  try {
    const raw = localStorage.getItem(DEFAULT_PRINTER_STORAGE_KEY)
    if (!raw) return defaultPrinterConfig()
    const parsed = JSON.parse(raw) as unknown
    const normalized = normalizeDocument({ version: 2, name: 'printer-preferences', widthMm: 1, heightMm: 1, objects: [], printer: parsed })
    return normalized.printer ?? defaultPrinterConfig()
  } catch {
    return defaultPrinterConfig()
  }
}

export function hasDefaultPrinterPreference(): boolean {
  try { return Boolean(localStorage.getItem(DEFAULT_PRINTER_STORAGE_KEY)) } catch { return false }
}

export function writeDefaultPrinter(printer: PrinterConfig): void {
  try {
    const { saveAsDefault: _saveAsDefault, ...persisted } = printer
    localStorage.setItem(DEFAULT_PRINTER_STORAGE_KEY, JSON.stringify(persisted))
  } catch {
    // Preferences are optional; failure must not block saving the template.
  }
}
