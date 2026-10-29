import { describe, expect, it } from 'vitest'
import { printModeHint } from '@shared/print/capabilities'
import { resolvePrintScene } from '@shared/print/scene'
import { defaultPrinterConfig, type PortConfig } from '@shared/domain/printer'
import { createLabelObject } from '@/features/editor/objectFactory'

const ctx = { labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: 't', printerName: '', datasets: {}, sharedVars: {}, keyboardValues: {} }
/** 指令直连端口（TCP/COM/USB/蓝牙/云盒）：真正不弹对话框的那条链路。 */
const directPort: PortConfig = { type: 'tcp', tcpHost: '127.0.0.1', tcpPort: 9100, encoding: 'utf8' }
const driverPort: PortConfig = { type: 'driver', encoding: 'utf8' }
const filePort: PortConfig = { type: 'file', encoding: 'utf8' }
const doc = (objects: unknown[], port: PortConfig = directPort) => ({
  version: 1, name: 't', widthMm: 60, heightMm: 40, objects,
  printer: { ...defaultPrinterConfig(), driver: 'tspl' as const, dpi: 203, port }
})

describe('当前打印方式提示', () => {
  it('纯黑条码+文字走指令直连，没有原因', () => {
    const d = doc([
      { id: 'b', type: 'barcode', x: 2, y: 2, w: 40, h: 10, rotation: 0, symbology: 'code128', showText: true, color: '#000000', source: { kind: 'constant', value: '123456' } }
    ])
    expect(printModeHint(resolvePrintScene(d as never, ctx as never), d.printer as never)).toEqual({ mode: 'native', reason: null })
  })

  it('个别元素走位图时提示「混合」，不再是整页位图', () => {
    const d = doc([
      { id: 't', type: 'text', x: 2, y: 2, w: 40, h: 10, rotation: 0, fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#C0392B', source: { kind: 'constant', value: 'Hello' } }
    ])
    expect(printModeHint(resolvePrintScene(d as never, ctx as never), d.printer as never)).toEqual({ mode: 'mixed', reason: null })
  })

  it('旋转表格只把表格自己转位图，提示「混合」', () => {
    const d = doc([
      { id: 'tbl', type: 'table', x: 5, y: 5, w: 20, h: 10, rotation: 15, rows: 2, cols: 2, borderWidth: 0.3, borderColor: '#000000' }
    ])
    expect(printModeHint(resolvePrintScene(d as never, ctx as never), d.printer as never)).toEqual({ mode: 'mixed', reason: null })
  })

  it('弧形文字也能单独裁图，提示「混合」', () => {
    const d = doc([
      { id: 'a', type: 'text', x: 2, y: 2, w: 40, h: 10, rotation: 0, fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000000', arc: true, source: { kind: 'constant', value: 'ARC' } }
    ])
    expect(printModeHint(resolvePrintScene(d as never, ctx as never), d.printer as never)).toEqual({ mode: 'mixed', reason: null })
  })

  it('光盘上越出可打印区域的原生图元才提示整页位图', () => {
    const d = {
      ...doc([
        { id: 'b', type: 'barcode', x: 50, y: 34, w: 20, h: 6, rotation: 0, symbology: 'code128', showText: false, color: '#000000', source: { kind: 'constant', value: '123456' } }
      ]),
      layout: { shape: 'ellipse', innerDiameterMm: 5 }
    }
    expect(printModeHint(resolvePrintScene(d as never, ctx as never), d.printer as never).mode).toBe('raster')
  })

  it('标签形状不是矩形不影响打印：仍走指令直连', () => {
    for (const shape of ['roundRect', 'ellipse'] as const) {
      const d = doc([
        { id: 'b', type: 'barcode', x: 2, y: 2, w: 40, h: 10, rotation: 0, symbology: 'code128', showText: true, color: '#000000', source: { kind: 'constant', value: '123456' } }
      ])
      const withShape = { ...d, layout: { shape } }
      expect(printModeHint(resolvePrintScene(withShape as never, ctx as never), withShape.printer as never)).toEqual({ mode: 'native', reason: null })
    }
  })

  it('新建条码自带的默认字体样式不算自定义，不提示位图', () => {
    const barcode = createLabelObject('barcode', 2, 2) as never
    const d = doc([barcode])
    expect(printModeHint(resolvePrintScene(d as never, ctx as never), d.printer as never)).toEqual({ mode: 'native', reason: null })
  })

  it('改过条码字体大小才提示自定义字体样式', () => {
    const barcode = { ...(createLabelObject('barcode', 2, 2) as Record<string, unknown>), fontSize: 12 * 25.4 / 72 }
    const d = doc([barcode])
    const hint = printModeHint(resolvePrintScene(d as never, ctx as never), d.printer as never)
    expect(hint.mode).toBe('mixed')
    expect(hint.reason).toBeNull()
  })

  it('Windows 驱动端口不宣称指令直连：会弹系统打印对话框', () => {
    const d = doc([
      { id: 'b', type: 'barcode', x: 2, y: 2, w: 40, h: 10, rotation: 0, symbology: 'code128', showText: true, color: '#000000', source: { kind: 'constant', value: '123456' } }
    ], driverPort)
    expect(printModeHint(resolvePrintScene(d as never, ctx as never), d.printer as never)).toEqual({ mode: 'driver', reason: null })
  })

  it('输出到指令文件时会弹保存对话框', () => {
    const d = doc([
      { id: 'b', type: 'barcode', x: 2, y: 2, w: 40, h: 10, rotation: 0, symbology: 'code128', showText: true, color: '#000000', source: { kind: 'constant', value: '123456' } }
    ], filePort)
    expect(printModeHint(resolvePrintScene(d as never, ctx as never), d.printer as never)).toEqual({ mode: 'file', reason: null })
  })
})
