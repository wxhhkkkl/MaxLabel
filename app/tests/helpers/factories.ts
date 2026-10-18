import type { LabelDoc } from '@shared/domain/document'
import { DOCUMENT_MODEL_VERSION } from '@shared/domain/document'
import type { DataCtx } from '@shared/domain/datasource'
import { defaultPrinterConfig, type PrinterConfig } from '@shared/domain/printer'
import type { MonoBitmap } from '@shared/domain/units'

/** Canonical 60×40 sample document; override only the fields a test cares about. */
export function sampleDoc(overrides: Partial<LabelDoc> = {}): LabelDoc {
  return {
    version: DOCUMENT_MODEL_VERSION,
    name: '测试标签',
    widthMm: 60,
    heightMm: 40,
    objects: [
      { id: '1', type: 'rect', x: 0, y: 0, w: 60, h: 40, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 0.3 },
      {
        id: '2',
        type: 'text',
        x: 4,
        y: 4,
        w: 52,
        h: 6,
        rotation: 0,
        fontFamily: '微软雅黑',
        fontSize: 5,
        bold: false,
        align: 'center',
        color: '#000',
        source: { kind: 'constant', value: '示例商品标签' }
      },
      {
        id: '3',
        type: 'barcode',
        x: 8,
        y: 13,
        w: 44,
        h: 14,
        rotation: 0,
        symbology: 'code128',
        showText: true,
        source: { kind: 'serial', prefix: 'SN-', start: 1001, step: 1, digits: 4, current: 1001 }
      },
      { id: '4', type: 'line', x: 8, y: 32, w: 44, h: 0, rotation: 0, stroke: '#000', strokeWidth: 0.3 }
    ],
    ...overrides
  }
}

/** Default printer config with a shallow port merge. */
export function printerConfig(overrides: Partial<PrinterConfig> = {}): PrinterConfig {
  const base = defaultPrinterConfig()
  return {
    ...base,
    ...overrides,
    port: { ...base.port, ...(overrides.port ?? {}) }
  }
}

/** All-ones monochrome bitmap, including the row padding bits. */
export function tinyMono(width = 8, height = 8): MonoBitmap {
  const bytesPerRow = Math.ceil(width / 8)
  return {
    width,
    height,
    bytesPerRow,
    bytes: new Uint8Array(bytesPerRow * height).fill(0xff)
  }
}

/** Deterministic print context (fixed clock) for date/time assertions. */
export function dataCtx(overrides: Partial<DataCtx> = {}): DataCtx {
  return {
    labelIndex: 1,
    recordIndex: 0,
    copy: 1,
    count: 1,
    totalLabels: 1,
    title: '测试',
    printerName: '',
    datasets: {},
    sharedVars: {},
    keyboardValues: {},
    now: Date.UTC(2024, 0, 2, 3, 4, 5),
    ...overrides
  }
}
