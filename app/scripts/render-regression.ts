import * as fabric from 'fabric'
import { makeObject } from '../src/renderer/src/rendering/fabricObjects'
import { pageCells, cellContext, pageSizeMm } from '../src/renderer/src/rendering/pageLayout'
import { renderLabel } from '../src/renderer/src/print/renderLabel'
import { textToMonoBitmap } from '../src/renderer/src/print/bitmapSource'
import { tableSegmentHidden } from '../src/shared/table'
import { PX_PER_MM, type LabelDoc, type DataCtx, type TextObj } from '../src/renderer/src/types'
import { importLsdx } from '../src/renderer/src/io/lsdxImport'
import { flattenObjects } from '../src/shared/domain/objects'
import { normalizeDocument } from '../src/shared/domain/document'
import { resolvePrintPageScene } from '../src/shared/print/scene'
import minimalLsdx from '../fixtures/lsdx/minimal.lsdx'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const text: TextObj = { id: 'text', type: 'text', x: 3, y: 3, w: 30, h: 12, rotation: 0,
  fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000000', source: { kind: 'constant', value: 'Label\nTest' } }
const doc: LabelDoc = { version: 1, name: 'render test', widthMm: 60, heightMm: 40, objects: [text] }
const ctx: DataCtx = { labelIndex: 8, recordIndex: 4, count: 10, copy: 1, totalLabels: 30, title: 'test', printerName: '',
  datasets: { data: { name: 'data', columns: ['name'], rows: Array.from({ length: 20 }, (_, i) => [String(i)]) } },
  activeDataset: 'data', sharedVars: {}, keyboardValues: { input: 'Keyboard' } }
function pixels(canvas: HTMLCanvasElement) { return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data }
function same(a: HTMLCanvasElement, b: HTMLCanvasElement) { const x = pixels(a), y = pixels(b); return x.length === y.length && x.every((v, i) => v === y[i]) }
function blank(canvas: HTMLCanvasElement) { const p = pixels(canvas); return p.every((v, i) => i % 4 === 3 || v === 255) }

export async function run() {
  const results: string[] = []
  const check = (condition: unknown, message: string) => { assert(condition, message); results.push(message) }
  const table = { id: 'table', type: 'table' as const, x: 5, y: 5, w: 20, h: 10, rotation: 0, rows: 2, cols: 2, borderWidth: 0.2, borderColor: '#000000', merges: [{ r: 0, c: 0, r2: 1, c2: 1 }] }
  check(tableSegmentHidden(table, 1, 1, 'v') && tableSegmentHidden(table, 1, 1, 'h'), 'merged cells hide internal borders through last row and column')
  check(!blank(await renderLabel({ ...doc, objects: [table] }, { dpi: 203 })), 'table outline is rendered')
  // 表格几何必须与模型 x/y/w/h 一致：历史上用 fabric.Group 拼表格时，fabric 7 的组重排
  // 会把整组包围盒撑大并把表格画到画布原点（编辑器与打印同时错位）。
  const tableGeom = (await makeObject(table, 1, { ctx, doc } as never)) as unknown as {
    type?: string; left?: number; top?: number; width?: number; height?: number
  }
  check(
    !!tableGeom && tableGeom.left === table.x && tableGeom.top === table.y,
    'table object sits at its model x/y (not at the canvas origin)'
  )
  check(
    !!tableGeom && tableGeom.width === table.w && tableGeom.height === table.h,
    'table object keeps the exact model size'
  )
  const layout = { rows: 1, cols: 3, rowGapMm: 0, colGapMm: 1.3 }
  const cells = pageCells(doc, layout)
  check(cells.length === 3 && cells[2].x === 122.6, 'one-row layout preserves exact mm spacing')
  const c = cellContext(ctx, 2)!
  check(c.labelIndex === 10 && c.recordIndex === 6 && c.totalLabels === 30 && c.recordRow?.[0] === '6', 'page context preserves job indices and record row')
  c.sharedVars.changed = 'yes'
  check(!ctx.sharedVars.changed, 'cell evaluation does not mutate caller shared variables')
  check(cellContext(ctx, 0)!.labelIndex === 8, 'single-label rendering does not reset serial index')
  const reversed = pageCells(doc, { ...layout, rows: 2, cols: 2, printOrder: 'col', startPos: 'br' })
  check(reversed[0].x === 61.3 && reversed[0].y === 40 && reversed[1].y === 0, 'column order and bottom-right start')
  for (const dpi of [203, 300, 600]) {
    const out = await renderLabel(doc, { dpi, layout })
    const size = pageSizeMm(doc, layout)
    check(out.width === Math.round(size.widthMm * dpi / 25.4) && out.height === Math.round(size.heightMm * dpi / 25.4), 'page raster dimensions at ' + dpi + ' DPI')
  }
  const source: TextObj = { ...text, source: { kind: 'serial', start: 1, current: 1, step: 1, digits: 3, prefix: '' } }
  const serialDoc = { ...doc, objects: [source] }
  check(!same(await renderLabel(serialDoc, { dpi: 203, ctx }), await renderLabel(serialDoc, { dpi: 203, ctx: { ...ctx, labelIndex: 9 } })), 'consecutive serial labels produce different pixels')
  const keyboardDoc = { ...doc, objects: [{ ...text, source: { kind: 'keyboard' as const, label: 'input' } }] }
  check(!blank(await renderLabel(keyboardDoc, { dpi: 203, ctx })), 'keyboard input is rendered into output')
  const hidden: LabelDoc = { ...doc, objects: [{ id: 'g', type: 'group', x: 0, y: 0, w: 40, h: 20, rotation: 0, visible: false, children: [text] }] }
  check(blank(await renderLabel(hidden, { dpi: 203 })), 'hidden group children do not print')
  check(blank(await renderLabel({ ...doc, objects: [{ ...text, suppressPrint: true }] }, { dpi: 203 })), 'suppressed objects do not print')
  const nested = flattenObjects([{
    id: 'outer', type: 'group', x: 30, y: 20, w: 40, h: 30, rotation: 90,
    children: [{ id: 'inner', type: 'group', x: 20, y: 15, w: 20, h: 10, rotation: 90, children: [{ ...text, id: 'nested-text', x: 25, y: 15 }] }]
  }])
  check(nested.length === 1 && Math.abs(nested[0].x - 30) < 0.01 && Math.abs(nested[0].y - 10) < 0.01 && Math.abs(nested[0].rotation - 180) < 0.01, 'nested groups compose parent rotation and center correctly')
  const filledRect = { id: 'filled', type: 'rect' as const, x: 0, y: 0, w: 60, h: 40, rotation: 0, fill: '#000000', stroke: '#000000', strokeWidth: 0 }
  const roundLabel = await renderLabel({ ...doc, objects: [filledRect], layout: { rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0, shape: 'ellipse' } }, { dpi: 203 })
  const rectangularLabel = await renderLabel({ ...doc, objects: [filledRect] }, { dpi: 203 })
  const roundCorner = roundLabel.getContext('2d')!.getImageData(0, 0, 1, 1).data
  const rectangularCorner = rectangularLabel.getContext('2d')!.getImageData(0, 0, 1, 1).data
  check(roundCorner[0] === 255 && rectangularCorner[0] < 16, 'label shape masks the page boundary')
  check(blank(await renderLabel({ ...doc, objects: [{ id: 'r', type: 'rfid', x: 0, y: 0, w: 20, h: 10, rotation: 0, bank: 'EPC', source: { kind: 'constant', value: '1234' } }] }, { dpi: 203 })), 'RFID editor annotation is excluded from physical output')
  const normal = await renderLabel(doc, { dpi: 203 })
  const grouped: LabelDoc = { ...doc, objects: [{ id: 'g', type: 'group', x: 30, y: 20, w: 60, h: 40, rotation: 0, children: [text] }] }
  check(same(await renderLabel(grouped, { dpi: 203 }), normal), 'group rendering preserves child geometry')
  for (const [name, props] of Object.entries({ italic: { italic: true }, underline: { underline: true }, reverse: { reverse: true }, rotation: { rotation: 30 }, arc: { arc: true } })) {
    check(!same(normal, await renderLabel({ ...doc, objects: [{ ...text, ...props }] }, { dpi: 203 })), name + ' changes output pixels')
  }
  // Compare shared editor object scene with preview output at the identical raster scale.
  const editor = new fabric.StaticCanvas(document.createElement('canvas'), { width: Math.round(60 * 203 / 25.4), height: Math.round(40 * 203 / 25.4), backgroundColor: '#ffffff', enableRetinaScaling: false, renderOnAddRemove: false })
  const z = 203 / 25.4 / PX_PER_MM
  editor.setViewportTransform([z, 0, 0, z, 0, 0])
  editor.add((await makeObject(text, PX_PER_MM))!)
  editor.renderAll()
  check(same(editor.getElement(), normal), 'editor object geometry and preview pixels match')
  await editor.dispose()
  const local = { ...text, x: 0, y: 0, italic: true, underline: true }
  const mono = await textToMonoBitmap('Label\nTest', local, 203)
  const rendered = await renderLabel({ ...doc, widthMm: local.w, heightMm: local.h, objects: [local] }, { dpi: 203 })
  const p = pixels(rendered)
  let matches = true
  for (let y = 0; y < mono.height; y++) for (let x = 0; x < mono.width; x++) {
    const i = (y * mono.width + x) * 4
    const black = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2] < 128
    if (black !== !!(mono.bytes[y * mono.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7)))) matches = false
  }
  check(matches, 'command text bitmap matches thresholded shared renderer pixel-for-pixel')
  let failed = false
  try { await renderLabel({ ...doc, objects: [{ id: 'img', type: 'image', x: 0, y: 0, w: 5, h: 5, rotation: 0, src: '' }] }, { dpi: 203 }) } catch { failed = true }
  check(failed, 'missing image fails output instead of silently printing incomplete label')
  const imported = await importLsdx(minimalLsdx, 'minimal.lsdx')
  check(imported.doc.widthMm === 80 && imported.doc.heightMm === 60, 'LSDX fixture preserves label dimensions')
  check(imported.doc.objects.length === 5 && imported.doc.objects.find((item) => item.type === 'group')?.type === 'group', 'LSDX fixture imports groups and basic object types')
  check(imported.doc.objects.some((item) => item.type === 'table' && item.rows === 2 && item.cols === 3), 'LSDX fixture imports basic table geometry')
  check(imported.doc.objects.some((item) => item.type === 'rfid' && item.bank === 'EPC'), 'LSDX fixture imports basic RFID parameters')
  const rounded = await importLsdx(minimalLsdx.replace('<labelobjects>', '<form corner="1" hole="1" holesize="1500"/><labelobjects>'), 'rounded.lsdx')
  check(rounded.doc.layout?.shape === 'roundRect' && rounded.doc.layout.innerDiameterMm === 15, 'LabelShop form shape and centre hole import')
  for (const shape of ['rect', 'roundRect', 'ellipse', 'disc'] as const) {
    const paperDoc: LabelDoc = { ...doc, widthMm: 60, heightMm: 60, objects: [], layout: { rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0, shape, cornerRadiusMm: 10, innerDiameterMm: 20 } }
    const saved = normalizeDocument(JSON.parse(JSON.stringify(paperDoc)))
    check(saved.layout?.shape === shape && saved.layout.innerDiameterMm === 20 && saved.layout.cornerRadiusMm === 10, shape + ' paper settings survive save/open normalization')
    check(blank(await renderLabel(paperDoc, { dpi: 254 })), shape + ' blank paper has no printed outline or hole outline')
    const filled: LabelDoc = { ...paperDoc, objects: [{ id: 'fill', type: 'rect', x: 0, y: 0, w: 60, h: 60, rotation: 0, fill: '#000000', stroke: '#000000', strokeWidth: 0 }] }
    const scene = resolvePrintPageScene(filled, ctx)
    const output = await renderLabel(filled, { dpi: 254, scene })
    const pixel = (x: number, y: number) => output.getContext('2d')!.getImageData(x, y, 1, 1).data[0]
    check(pixel(300, 300) === 255 && pixel(300, 150) === 0, shape + ' centre hole clips content but preserves printable paper')
    if (shape !== 'rect') check(pixel(1, 1) === 255, shape + ' outer paper shape clips corner content')
  }
  return results
}
