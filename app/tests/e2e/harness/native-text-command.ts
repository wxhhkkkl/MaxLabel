// 在**应用主窗口**（带 preload，能走真实 IPC）里跑指令打印的中文文本位图路径：
// resolvePrintScene → prepareBitmapsForScene → 文本对象的 bitmap 应来自 GDI。
import { prepareBitmapsForScene } from '../../../src/renderer/src/print/bitmapSource'
import { makeObject } from '../../../src/renderer/src/rendering/fabricObjects'
import { PX_PER_MM } from '../../../src/renderer/src/types'
import { resolvePrintScene } from '../../../src/shared/print/scene'
import { defaultPrinterConfig } from '../../../src/shared/domain/printer'
import type { LabelDoc } from '../../../src/shared/domain/document'
import type { DataCtx } from '../../../src/shared/domain/datasource'

export async function run(): Promise<{ width: number; height: number; ink: number; originXMm: number; bytes: number; editorType: string; editorFontSize: number }> {
  const doc: LabelDoc = {
    version: 1,
    name: 'gdi command probe',
    widthMm: 60,
    heightMm: 40,
    objects: [{
      id: 'text-gdi',
      type: 'text',
      x: 2,
      y: 2,
      w: 40,
      h: 4,
      rotation: 0,
      fontFamily: 'Arial, 宋体',
      fontSize: (6 * 25.4) / 72,
      bold: false,
      align: 'left',
      color: '#000000',
      textType: 'single',
      source: { kind: 'constant', value: '本品为初级农产品' }
    }]
  }
  const ctx: DataCtx = {
    labelIndex: 1,
    recordIndex: 0,
    copy: 1,
    count: 1,
    totalLabels: 1,
    title: 'probe',
    printerName: '',
    datasets: {},
    sharedVars: {},
    keyboardValues: {},
    allowScript: false
  }
  const printer = { ...defaultPrinterConfig(), driver: 'tspl' as const, dpi: 203, port: { type: 'file' as const, encoding: 'utf8' as const } }
  const prepared = await prepareBitmapsForScene(resolvePrintScene(doc, ctx), printer)
  const primitive = prepared.primitives[0]
  const bitmap = primitive && 'bitmap' in primitive ? primitive.bitmap : undefined
  if (!bitmap) throw new Error('文本对象没有生成位图')
  let ink = 0
  for (let y = 0; y < bitmap.height; y++) {
    for (let x = 0; x < bitmap.width; x++) {
      if (bitmap.bytes[y * bitmap.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7))) ink++
    }
  }
  // 编辑画布路径：同一段文字应变成 GDI 位图，且尺寸按 406dpi → 8px/mm 换算。
  const editorImage = await makeObject(doc.objects[0], PX_PER_MM, { nativeText: true, ctx })
  return {
    width: bitmap.width,
    height: bitmap.height,
    ink,
    originXMm: bitmap.originXMm ?? -1,
    bytes: bitmap.bytes.length,
    editorType: editorImage ? String((editorImage as unknown as { type: string }).type) : '',
    editorFontSize: editorImage ? Number((editorImage as unknown as { fontSize?: number }).fontSize ?? -1) : -1
  }
}
