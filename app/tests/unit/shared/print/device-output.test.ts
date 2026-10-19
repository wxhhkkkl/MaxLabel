import { describe, expect, it } from 'vitest'
import type { LabelDoc } from '@shared/domain/document'
import type { RfidObj, TextObj } from '@shared/domain/objects'
import { buildCommands } from '@shared/print/engine'
import { printerConfig, sampleDoc, tinyMono } from '../../../helpers/factories'

const output = { count: 1, copy: 1, title: '测试', datasets: {} }
const options = (driver: 'tspl' | 'zpl' | 'cpcl' = 'tspl') => ({ driver, port: { type: 'file' as const, encoding: 'utf8' as const } })

describe('tables and ellipses', () => {
  const withTable = (): LabelDoc => {
    const doc = sampleDoc()
    doc.objects.push({ id: 't1', type: 'table', x: 4, y: 30, w: 52, h: 8, rotation: 0, rows: 2, cols: 3, borderWidth: 0.3, borderColor: '#000' })
    return doc
  }

  it('emits table grids in TSPL, ZPL and CPCL', () => {
    expect(buildCommands(withTable(), printerConfig(options('tspl')), output).text).toContain('BOX ')
    expect(buildCommands(withTable(), printerConfig(options('tspl')), output).text).toContain('BAR ')
    expect(buildCommands(withTable(), printerConfig(options('tspl')), output).text).not.toContain('LINE ')
    expect(buildCommands(withTable(), printerConfig(options('zpl')), output).text).toContain('^GB')
    const cpcl = buildCommands(withTable(), printerConfig(options('cpcl')), output).text
    expect(cpcl).toContain('BOX ')
    expect(cpcl).toContain('LINE ')
  })

  it('warns and skips ellipses for native protocols', () => {
    const doc = sampleDoc()
    doc.objects.push({ id: 'e1', type: 'ellipse', x: 4, y: 30, w: 20, h: 8, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 0.3 })
    const tspl = buildCommands(doc, printerConfig(options('tspl')), output)
    expect(tspl.warnings.some((warning) => warning.includes('椭圆'))).toBe(true)
    const cpcl = buildCommands(doc, printerConfig(options('cpcl')), output)
    expect(cpcl.text).not.toContain('ELLIPSE ')
    expect(cpcl.warnings.some((warning) => warning.includes('椭圆'))).toBe(true)
  })
})

describe('images, Chinese text and built-in fonts', () => {
  it('embeds an image as TSPL BITMAP or ZPL ^GFA without a BMP header', () => {
    const doc = sampleDoc()
    doc.objects.push({ id: 'img1', type: 'image', x: 4, y: 30, w: 10, h: 8, rotation: 0, src: 'data:image/png;base64,x' })
    const tspl = buildCommands(doc, printerConfig(options('tspl')), { ...output, images: { img1: tinyMono() } })
    expect(tspl.text).toContain('BITMAP')
    const bins = tspl.segments.filter((segment) => segment.type === 'bin')
    expect(bins).toHaveLength(1)
    expect((bins[0] as { data: Uint8Array }).data).toHaveLength(8)
    // TSPL BITMAP is 0=black; MonoBitmap is 1=black, so bytes must be inverted.
    expect(Array.from((bins[0] as { data: Uint8Array }).data)).toEqual(Array(8).fill(0x00))

    const zpl = buildCommands(doc, printerConfig(options('zpl')), { ...output, images: { img1: tinyMono() } })
    expect(zpl.text).toContain('^GFA')
    expect(zpl.text).toContain('ff')
  })

  it('inverts TSPL bitmap bytes so zero means black', () => {
    const doc = sampleDoc()
    doc.objects.push({ id: 'img2', type: 'image', x: 4, y: 30, w: 10, h: 8, rotation: 0, src: 'data:image/png;base64,x' })
    const bitmap = { width: 8, height: 2, bytesPerRow: 1, bytes: Uint8Array.from([0xaa, 0x55]) }
    const result = buildCommands(doc, printerConfig(options('tspl')), { ...output, images: { img2: bitmap } })
    const bin = result.segments.find((segment) => segment.type === 'bin') as { data: Uint8Array } | undefined
    expect(bin).toBeDefined()
    expect(Array.from(bin!.data)).toEqual([0x55, 0xaa])
  })

  it('rasterizes Chinese text instead of emitting TEXT', () => {
    const doc = sampleDoc()
    doc.objects[1] = { ...doc.objects[1], source: { kind: 'constant', value: '中文标签' } } as LabelDoc['objects'][number]
    const byLabel = [{ [doc.objects[1].id]: tinyMono() }]
    const tspl = buildCommands(doc, printerConfig(options('tspl')), { ...output, imagesByLabel: byLabel })
    expect(tspl.text).toContain('BITMAP')
    expect(tspl.text).not.toContain('TEXT ')
    expect(tspl.segments.some((segment) => segment.type === 'bin')).toBe(true)
    const zpl = buildCommands(doc, printerConfig(options('zpl')), { ...output, imagesByLabel: byLabel })
    expect(zpl.text).toContain('^GFA')
  })

  it('uses printer built-in fonts', () => {
    const tsplDoc = sampleDoc()
    ;(tsplDoc.objects[1] as TextObj).printerFont = 'Font3'
    const tspl = buildCommands(tsplDoc, printerConfig(options('tspl')), output).text
    expect(tspl).toContain('TEXT ')
    expect(tspl).toContain('"3"')
    expect(tspl).not.toContain('"Font3"')

    const zplDoc = sampleDoc()
    ;(zplDoc.objects[1] as TextObj).printerFont = 'A'
    expect(buildCommands(zplDoc, printerConfig(options('zpl')), output).text).toContain('^AA')
  })
})

describe('RFID and shared script variables', () => {
  it('writes and locks EPC data in TSPL and ZPL', () => {
    const doc = sampleDoc()
    const rfid: RfidObj = {
      id: 'rf1',
      type: 'rfid',
      x: 5,
      y: 5,
      w: 30,
      h: 8,
      rotation: 0,
      bank: 'EPC',
      source: { kind: 'serial', prefix: 'E2', start: 1001, step: 1, digits: 6, current: 1001 },
      lock: true,
      accessPwd: 'A1B2C3D4',
      killPwd: '00000000'
    }
    doc.objects.push(rfid)

    const tspl = buildCommands(doc, printerConfig(options('tspl')), { ...output, allowScript: true }).text
    expect(tspl).toContain('RFID;EPC,E2001001')
    expect(tspl).toContain('RFID;LOCK,A1B2C3D4,00000000,EPC')

    const zpl = buildCommands(doc, printerConfig(options('zpl')), output).text
    expect(zpl).toContain('^RFW,H,,,A^FH\\^FDE2001001')
    expect(zpl).toContain('^RFS,H,P^FH\\^FDA1B2C3D4')
    expect(zpl).toContain('^RLM,,,L')
  })

  it('passes shared script variables across objects', () => {
    const doc = sampleDoc()
    doc.objects[1] = {
      ...doc.objects[1],
      source: { kind: 'script', code: 'function OnGetData(){ return "订单号-001"; }', sharedName: 'ORD' }
    } as LabelDoc['objects'][number]
    doc.objects.push({
      id: 'x1',
      type: 'text',
      x: 4,
      y: 34,
      w: 52,
      h: 4,
      rotation: 0,
      fontFamily: 'Arial',
      fontSize: 3,
      bold: false,
      align: 'left',
      color: '#000',
      source: { kind: 'script', code: 'function OnGetData(){ return "批次:" + ORD; }' }
    })
    const text = buildCommands(doc, printerConfig(options('tspl')), { ...output, allowScript: true }).text
    expect(text).toContain('"批次:订单号-001"')
  })
})
