import { describe, expect, it } from 'vitest'
import { normalizeDocument } from '@shared/domain'
import type { LabelDoc } from '@shared/domain/document'
import { fromDocJson, toMsdx } from '@/io/msdx'
import { printerConfig, sampleDoc } from '../../../helpers/factories'

describe('MSDX round-trip and migration', () => {
  it('preserves 原版-compatible document fields', () => {
    const source: LabelDoc = {
      ...sampleDoc(),
      remark: '保留备注',
      orientation: 90,
      keyboardOrder: ['批号'],
      colorIndexTable: ['#000000']
    }
    const decoded = fromDocJson(toMsdx(source))
    expect(decoded.remark).toBe('保留备注')
    expect(decoded.orientation).toBe(90)
    expect(decoded.keyboardOrder).toEqual(['批号'])
    expect(decoded.colorIndexTable).toEqual(['#000000'])
  })

  it('redacts database passwords before serialization', () => {
    const source: LabelDoc = {
      ...sampleDoc(),
      connections: { main: { id: 'main', name: '主库', driver: 'sqlserver', password: 'secret', server: 'db' } }
    }
    const text = toMsdx(source)
    expect(text).not.toContain('secret')
    expect(JSON.parse(text).doc.connections.main.password).toBeUndefined()
  })

  it('rejects invalid label dimensions', () => {
    expect(() => fromDocJson(JSON.stringify({ ...sampleDoc(), widthMm: 0 }))).toThrow(/尺寸无效/)
  })

  it('rejects a future envelope version', () => {
    expect(() => fromDocJson(JSON.stringify({ format: 'maxlabel-msdx', version: 99, app: 'MaxLabel', doc: sampleDoc() }))).toThrow(/版本不受支持/)
  })

  it('migrates legacy text and barcode fields', () => {
    const legacy = { ...sampleDoc(), version: 0, objects: sampleDoc().objects.map((object) => ({ ...object })) }
    const text = legacy.objects.find((object) => object.type === 'text') as Record<string, unknown>
    text.textFormat = 'upper'
    const barcode = legacy.objects.find((object) => object.type === 'barcode') as Record<string, unknown>
    barcode.moduleWidthMm = 0.4
    barcode.wideRatio = 2.5

    const migrated = fromDocJson(JSON.stringify(legacy))
    expect((migrated.objects.find((object) => object.type === 'text') as { format?: string }).format).toBe('upper')
    expect((migrated.objects.find((object) => object.type === 'barcode') as { barcodeOptions?: { xSizeMm?: number } }).barcodeOptions?.xSizeMm).toBe(0.4)
  })
})

describe('document normalization', () => {
  it('clamps DPI and strips empty database passwords', () => {
    const normalized = normalizeDocument({
      ...sampleDoc(),
      printer: { ...printerConfig({ dpi: 99999 }), port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } },
      connections: { main: { id: 'main', name: '主库', driver: 'sqlserver', password: '', server: '' } }
    })
    expect(normalized.printer?.dpi).toBe(1200)
    expect(normalized.connections?.main?.password).toBeUndefined()
    expect(normalized.connections?.main?.name).toBe('主库')
  })

  it('preserves the Windows target printer name', () => {
    const normalized = normalizeDocument({ ...sampleDoc(), printer: { ...printerConfig(), printerName: 'Zebra ZD421' } })
    expect(normalized.printer?.printerName).toBe('Zebra ZD421')
  })

  it('preserves USB and serial port fields', () => {
    const usb = normalizeDocument({
      ...sampleDoc(),
      printer: { ...printerConfig(), port: { type: 'usb', encoding: 'utf8', usbPort: 'USB001 (Zenpert 4T530)' } }
    })
    expect(usb.printer?.port.usbPort).toBe('USB001 (Zenpert 4T530)')

    const serial = normalizeDocument({
      ...sampleDoc(),
      printer: {
        ...printerConfig(),
        port: {
          type: 'com',
          encoding: 'utf8',
          comPort: 'COM3',
          baudRate: 9600,
          dataBits: 7,
          parity: 'even',
          stopBits: 'two',
          flowControl: 'rtsCts'
        }
      }
    })
    expect(serial.printer?.port).toMatchObject({
      type: 'com',
      comPort: 'COM3',
      baudRate: 9600,
      dataBits: 7,
      parity: 'even',
      stopBits: 'two',
      flowControl: 'rtsCts'
    })
  })

  it('renames duplicate dataset columns and normalizes table merges', () => {
    const value = normalizeDocument({
      ...sampleDoc(),
      datasets: { d: { name: 'd', columns: ['sku', 'sku', ''], rows: [['1', '2', '3']] } },
      objects: [
        {
          id: 'table',
          type: 'table',
          x: 0,
          y: 0,
          w: 30,
          h: 10,
          rotation: 0,
          rows: 2,
          cols: 2,
          borderWidth: 0.2,
          borderColor: '#000',
          colWidths: [1, 2],
          rowHeights: [2, 1],
          merges: [{ r: 1, c: 1, r2: 0, c2: 0 }]
        }
      ]
    })
    expect(value.datasets?.d.columns).toEqual(['sku', 'sku_2', '列3'])
    expect((value.objects[0] as { merges?: unknown[] }).merges).toEqual([{ r: 0, c: 0, r2: 1, c2: 1 }])
  })

  it('preserves keyboard/weigh configuration and subSource shared names', () => {
    const raw = {
      ...sampleDoc(),
      objects: [
        {
          id: 'keyboard',
          type: 'text',
          x: 1,
          y: 1,
          w: 20,
          h: 5,
          rotation: 0,
          fontFamily: 'Arial',
          fontSize: 3,
          bold: false,
          align: 'left',
          color: '#000',
          source: {
            kind: 'keyboard',
            label: '重量',
            inputDevice: 'weigh',
            weighProtocol: 'mettler',
            weighPort: 'COM8',
            weighBaud: '19200',
            weighUnit: 'kg',
            weighDecimals: 3,
            weighAutoPrint: true,
            weighUnitConv: true
          },
          subSources: [{ kind: 'constant', value: ' kg', sharedName: 'unit' }]
        }
      ]
    }
    const object = fromDocJson(JSON.stringify(raw)).objects[0] as unknown as {
      source: Record<string, unknown>
      subSources?: Array<Record<string, unknown>>
    }
    expect(object.source.inputDevice).toBe('weigh')
    expect(object.source.weighProtocol).toBe('mettler')
    expect(object.source.weighPort).toBe('COM8')
    expect(object.source.weighDecimals).toBe(3)
    expect(object.source.weighAutoPrint).toBe(true)
    expect(object.source.weighUnitConv).toBe(true)
    expect(object.subSources?.[0]?.sharedName).toBe('unit')
  })

  it('keeps the dataset source path across save/open, and drops a blank one', () => {
    const saved = normalizeDocument({
      ...sampleDoc(),
      datasets: { d: { name: 'd', columns: ['a'], rows: [['1']], sourcePath: 'C:\\data\\商品.xlsx' } }
    })
    expect(saved.datasets?.d.sourcePath).toBe('C:\\data\\商品.xlsx')

    const blank = normalizeDocument({
      ...sampleDoc(),
      datasets: { d: { name: 'd', columns: ['a'], rows: [['1']], sourcePath: '   ' } }
    })
    expect(blank.datasets?.d.sourcePath).toBeUndefined()
  })

  it('keeps a QR center icon (PNG data URL only) and clamps its size', () => {
    const icon = 'data:image/png;base64,iVBORw0KGgo='
    const barcode = (options: Record<string, unknown>) => ({
      id: 'bc', type: 'barcode', x: 0, y: 0, w: 30, h: 30, rotation: 0, symbology: 'qrcode', showText: false,
      source: { kind: 'constant', value: 'https://example.com' }, barcodeOptions: options
    })
    const kept = normalizeDocument({ ...sampleDoc(), objects: [barcode({ qrIconImage: icon, qrIconSizePct: 25 }) as never] })
    const keptOptions = (kept.objects[0] as { barcodeOptions?: { qrIconImage?: string; qrIconSizePct?: number } }).barcodeOptions
    expect(keptOptions?.qrIconImage).toBe(icon)
    expect(keptOptions?.qrIconSizePct).toBe(25)
    // 越界数值按既有约定直接判文档无效（与其它 barcodeOptions 数值字段一致）。
    expect(() => normalizeDocument({ ...sampleDoc(), objects: [barcode({ qrIconSizePct: 80 }) as never] })).toThrow()

    const dropped = normalizeDocument({ ...sampleDoc(), objects: [barcode({ qrIconImage: 'javascript:alert(1)' }) as never] })
    expect((dropped.objects[0] as { barcodeOptions?: { qrIconImage?: string } }).barcodeOptions?.qrIconImage).toBeUndefined()
  })

  it('keeps serial boundary and pad-zero settings', () => {
    const value = normalizeDocument({
      ...sampleDoc(),
      objects: [{
        id: 'bc', type: 'barcode', x: 0, y: 0, w: 30, h: 10, rotation: 0, symbology: 'code128', showText: false,
        source: { kind: 'serial', prefix: '', start: 1, step: 1, digits: 4, current: 1, serialType: 'boundary', end: 100, padZero: false }
      } as never]
    })
    const source = (value.objects[0] as { source: { serialType?: string; end?: number; padZero?: boolean } }).source
    expect(source.serialType).toBe('boundary')
    expect(source.end).toBe(100)
    expect(source.padZero).toBe(false)
  })
})
