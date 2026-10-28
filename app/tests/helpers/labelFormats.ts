import { defaultPrinterConfig, type PrinterConfig } from '@shared/domain/printer'
import type { LabelDoc } from '@shared/domain/document'
import { sampleDoc } from './factories'

/** Value used by the printer picker for a 签赋 原版 catalog printer. */
export const BUILTIN_PRINTER = 'ls:demo-printer'

/** Picker value meaning “use the already configured printer”. */
export const CONFIGURED_PRINTER = '__maxlabel_configured_printer__'

export function driverPrinter(overrides: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    ...defaultPrinterConfig(),
    port: { type: 'driver', encoding: 'utf8' },
    ...overrides
  }
}

export function comPrinter(overrides: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    ...defaultPrinterConfig(),
    port: { type: 'com', encoding: 'utf8', comPort: 'COM3', baudRate: 9600 },
    ...overrides
  }
}

/** A document with a custom page layout, used by template-properties tests. */
export function customLayoutDoc(overrides: Partial<LabelDoc> = {}): LabelDoc {
  return {
    ...sampleDoc(),
    formatKind: 'custom',
    layout: {
      rows: 1,
      cols: 2,
      rowGapMm: 2,
      colGapMm: 2,
      shape: 'rect'
    },
    ...overrides
  }
}

export function presetLayoutDoc(overrides: Partial<LabelDoc> = {}): LabelDoc {
  return customLayoutDoc({ formatKind: 'preset', ...overrides })
}
