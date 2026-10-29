import * as fabric from 'fabric'
import { makeObject } from '../../../src/renderer/src/rendering/fabricObjects'
import { pageCells, cellContext, pageSizeMm } from '../../../src/renderer/src/rendering/pageLayout'
import { renderLabel } from '../../../src/renderer/src/print/renderLabel'
import { renderLabelSvg } from '../../../src/renderer/src/print/renderLabelSvg'
import { prepareBitmapsForScene, textToMonoBitmap } from '../../../src/renderer/src/print/bitmapSource'
import { rotatedObjectBounds } from '../../../src/shared/print/bounds'
import { buildCommands } from '../../../src/shared/print/engine'
import { materializeScenePrimitive, resolvePrintScene } from '../../../src/shared/print/scene'
import { defaultPrinterConfig } from '../../../src/shared/domain/printer'
import { detectMonochrome } from '../../../src/renderer/src/print/imageValidation'
import { tableSegmentHidden } from '../../../src/shared/table'
import { PX_PER_MM } from '../../../src/shared/domain/units'
import type { LabelDoc } from '../../../src/shared/domain/document'
import type { DataCtx } from '../../../src/shared/domain/datasource'
import type { TextObj } from '../../../src/shared/domain/objects'
import { importLsdx } from '../../../src/renderer/src/io/lsdxImport'
import { flattenObjects } from '../../../src/shared/domain/objects'
import { normalizeDocument } from '../../../src/shared/domain/document'
import { resolvePrintPageScene } from '../../../src/shared/print/scene'
import { paperPath, roundRectRadiusMm } from '../../../src/shared/domain/paper'
import { barcodeToDataURL, invertBarcodeCanvas, renderBarcodeCanvasAtDpi } from '../../../src/renderer/src/editor/barcode'
import minimalLsdx from '../../../fixtures/lsdx/minimal.lsdx'

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const text: TextObj = { id: 'text', type: 'text', x: 3, y: 3, w: 30, h: 12, rotation: 0,
  fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000000', source: { kind: 'constant', value: 'Label\nTest' } }
const doc: LabelDoc = { version: 1, name: 'render test', widthMm: 60, heightMm: 40, objects: [text] }
const ctx: DataCtx = { labelIndex: 8, recordIndex: 4, count: 10, copy: 1, totalLabels: 30, title: 'test', printerName: '',
  datasets: { data: { name: 'data', columns: ['name'], rows: Array.from({ length: 20 }, (_, i) => [String(i)]) } },
  activeDataset: 'data', sharedVars: {}, keyboardValues: { input: 'Keyboard' } }
function pixels(canvas: HTMLCanvasElement) { return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data }
function same(a: HTMLCanvasElement, b: HTMLCanvasElement) { const x = pixels(a), y = pixels(b); return x.length === y.length && x.every((v, i) => v === y[i]) }
function diffRatio(a: HTMLCanvasElement, b: HTMLCanvasElement) {
  const x = pixels(a), y = pixels(b)
  if (x.length !== y.length) return 1
  let different = 0
  for (let i = 0; i < x.length; i += 4) if (x[i] !== y[i] || x[i + 1] !== y[i + 1] || x[i + 2] !== y[i + 2]) different++
  return different / (x.length / 4)
}
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

  // ---- 图片「无效图片」处理（帮助 label_object_page_picture.html）----
  const brokenImage = {
    id: 'img', type: 'image' as const, x: 4, y: 4, w: 20, h: 12, rotation: 0,
    src: '', imgType: 'link' as const, linkPath: 'Z:\\definitely-missing\\nope.png'
  }
  const skipImg = await makeObject({ ...brokenImage, missingImage: 'skip' } as never, 1, { ctx, doc, output: true, resolveImage: async () => { throw new Error('无法读取图片') } } as never)
  check(skipImg === null, 'invalid image with 忽略该对象 produces no output object')
  const placeholderImg = await makeObject({ ...brokenImage, missingImage: 'placeholder' } as never, 1, { ctx, doc, output: true, resolveImage: async () => { throw new Error('无法读取图片') } } as never)
  check(
    !!placeholderImg && (placeholderImg as unknown as { type?: string }).type === 'rect',
    'invalid image with 画占位框 produces a placeholder frame'
  )
  let threwOnMissing = false
  try {
    await makeObject({ ...brokenImage, missingImage: 'error' } as never, 1, { ctx, doc, output: true, resolveImage: async () => { throw new Error('无法读取图片') } } as never)
  } catch { threwOnMissing = true }
  check(threwOnMissing, 'invalid image with 中止输出 still fails the print output (default behaviour kept)')

  // ---- 标签纸颜色只在编辑期显示（帮助 label_page_page.html）----
  const colorDoc = { ...doc, objects: [text], layout: { rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0, shape: 'rect' as const, labelColor: '#fff8e1' } }
  const colorOut = await renderLabel(colorDoc as never, { dpi: 203 })
  const plainOut = await renderLabel({ ...doc, objects: [text] } as never, { dpi: 203 })
  check(same(colorOut, plainOut), 'label paper colour never reaches the printed output')

  // ---- 图片可变颜色仅单色黑白图（帮助 color_main.html）----
  const monoCanvas = document.createElement('canvas')
  monoCanvas.width = 8; monoCanvas.height = 8
  const monoCtx = monoCanvas.getContext('2d')!
  monoCtx.fillStyle = '#fff'; monoCtx.fillRect(0, 0, 8, 8)
  monoCtx.fillStyle = '#000'; monoCtx.fillRect(0, 0, 4, 8)
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = 8; colorCanvas.height = 8
  const colorCtx = colorCanvas.getContext('2d')!
  colorCtx.fillStyle = '#fff'; colorCtx.fillRect(0, 0, 8, 8)
  colorCtx.fillStyle = '#e11'; colorCtx.fillRect(0, 0, 4, 8)
  colorCtx.fillStyle = '#1e1'; colorCtx.fillRect(4, 0, 4, 4)
  const monoVerdict = await detectMonochrome(monoCanvas.toDataURL('image/png'))
  const colorVerdict = await detectMonochrome(colorCanvas.toDataURL('image/png'))
  check(monoVerdict === 'mono', 'a two-colour (black/white) bitmap is detected as monochrome')
  check(colorVerdict === 'color', 'a multi-colour bitmap is detected as colour')
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
  check(blank(await renderLabel({ ...doc, objects: [{ id: 'r', type: 'rfid', x: 0, y: 0, w: 20, h: 10, rotation: 0, bank: 'EPC', lock: false, source: { kind: 'constant', value: '1234' } }] }, { dpi: 203 })), 'RFID editor annotation is excluded from physical output')
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
  // Font antialiasing differs slightly across Windows runner images; allow a
  // 1% pixel budget while still catching geometry/scale regressions.
  check(diffRatio(editor.getElement(), normal) <= 0.01, 'editor object geometry and preview pixels match')
  await editor.dispose()
  const local = { ...text, x: 0, y: 0, italic: true, underline: true }
  const mono = await textToMonoBitmap('Label\nTest', local, 203)
  // 对象位图按「旋转后包围盒 + 描边余量」裁切，这里用同一套边界渲染对照。
  const bounds = rotatedObjectBounds(local, 0.4)
  const rendered = await renderLabel({ ...doc, widthMm: bounds.w, heightMm: bounds.h, objects: [{ ...local, x: local.x - bounds.x, y: local.y - bounds.y }] }, { dpi: 203 })
  const p = pixels(rendered)
  let mismatches = 0
  for (let y = 0; y < mono.height; y++) for (let x = 0; x < mono.width; x++) {
    const i = (y * mono.width + x) * 4
    const black = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2] < 128
    if (black !== !!(mono.bytes[y * mono.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7)))) mismatches++
  }
  check(mismatches === 0, `command text bitmap matches thresholded shared renderer pixel-for-pixel (mismatch=${mismatches} mono=${mono.width}x${mono.height} rendered=${rendered.width}x${rendered.height} bounds=${bounds.w}x${bounds.h})`)
  // 混合输出：原生条码 + 文字对象位图，不再整页位图
  const mixedDoc = { ...doc, objects: [
    { id: 'bc', type: 'barcode' as const, x: 2, y: 2, w: 54, h: 20, rotation: 0, symbology: 'code128', showText: true, color: '#000000', source: { kind: 'constant' as const, value: 'ABC123' } },
    { id: 'tx', type: 'text' as const, x: 4, y: 26, w: 30, h: 8, rotation: 0, fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'left' as const, color: '#000000', source: { kind: 'constant' as const, value: '中文测试' } }
  ] }
  const mixedPrinter = { ...defaultPrinterConfig(), driver: 'tspl' as const, dpi: 203 }
  const mixedScene = resolvePrintScene(mixedDoc, ctx)
  const mixedPrepared = await prepareBitmapsForScene(mixedScene, mixedPrinter)
  check(!mixedPrepared.pageBitmap, 'plain label no longer needs a page bitmap')
  check(mixedPrepared.primitives.some((primitive) => primitive.kind === 'text' && 'bitmap' in primitive && Boolean(primitive.bitmap)), 'text object gets its own bitmap')
  const mixedCommands = buildCommands(mixedDoc, mixedPrinter, { count: 1, copy: 1, title: 'mixed', datasets: {}, resolvedPages: [mixedPrepared] })
  check(mixedCommands.text.includes('BARCODE'), 'mixed output keeps the native barcode command')
  check(mixedCommands.text.includes('BITMAP') && !mixedCommands.text.includes('PAGE_RAW'), 'mixed output only rasters the text')
  let failed = false
  try { await renderLabel({ ...doc, objects: [{ id: 'img', type: 'image', x: 0, y: 0, w: 5, h: 5, rotation: 0, src: '' }] }, { dpi: 203 }) } catch { failed = true }
  check(failed, 'missing image fails output instead of silently printing incomplete label')
  const imported = await importLsdx(minimalLsdx, 'minimal.lsdx')
  check(imported.doc.widthMm === 80 && imported.doc.heightMm === 60, 'LSDX fixture preserves label dimensions')
  check(imported.doc.objects.length === 6 && imported.doc.objects.find((item) => item.type === 'group')?.type === 'group', 'LSDX fixture imports groups and basic object types')
  check(imported.doc.objects.some((item) => item.type === 'table' && item.rows === 2 && item.cols === 3), 'LSDX fixture imports basic table geometry')
  check(imported.doc.objects.some((item) => item.type === 'rfid' && item.bank === 'EPC'), 'LSDX fixture imports basic RFID parameters')
  check(imported.doc.objects.some((item) => item.type === 'image' && item.imgType === 'embed' && item.src.startsWith('data:image/png;base64,')), 'LSDX fixture imports an embedded image')
  const rounded = await importLsdx(minimalLsdx.replace('<labelobjects>', '<form corner="1" hole="1" holesize="1500"/><labelobjects>'), 'rounded.lsdx')
  check(rounded.doc.layout?.shape === 'roundRect' && rounded.doc.layout.innerDiameterMm === 15, '原版 form shape and centre hole import')
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
  // 原版 P0：默认圆角是固定约 1mm，且所有形状/输出路径共用 paperPath 的几何规则。
  check(roundRectRadiusMm(100, 70) === 1, 'roundRect default radius follows 原版 fixed 1mm rule')
  check(paperPath(100, 70, { shape: 'roundRect' }).includes('A 1 1'), 'roundRect preview path uses the shared 1mm arc')
  check(!paperPath(100, 70, { shape: 'rect' }).includes('A '), 'rect paper path has zero outer radius')
  check(paperPath(100, 100, { shape: 'ellipse' }).includes('A 50 50'), 'circle paper path uses width and height as diameters')
  const circleWithHole = paperPath(100, 100, { shape: 'ellipse', innerDiameterMm: 20 })
  check(circleWithHole.includes('A 10 10'), 'circle with a hole uses the hole diameter in the shared path')
  const defaultRoundDoc: LabelDoc = { ...doc, widthMm: 100, heightMm: 70, objects: [{ id: 'fill-default-round', type: 'rect', x: 0, y: 0, w: 100, h: 70, rotation: 0, fill: '#000000', stroke: '#000000', strokeWidth: 0 }], layout: { rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0, shape: 'roundRect' } }
  const defaultRoundOutput = await renderLabel(defaultRoundDoc, { dpi: 254 })
  check(defaultRoundOutput.getContext('2d')!.getImageData(0, 0, 1, 1).data[0] === 255, 'renderLabel clips the default roundRect corner with the shared radius')
  // 真机「孔洞」三项里的「矩形」（probe-round106-custom-label-combos.txt）。round-107b 只把孔形做到了
  // 对话框预览里，文档归一化 / 打印场景 / 位图输出三处都把 innerShape 丢掉 → 打印出来仍是圆孔。
  // 下面三条按「一条路径一条断言」钉死：文档存得住、场景带得走、位图裁得对。
  const rectHoleDoc: LabelDoc = { ...doc, widthMm: 60, heightMm: 60, objects: [{ id: 'fill-rect-hole', type: 'rect', x: 0, y: 0, w: 60, h: 60, rotation: 0, fill: '#000000', stroke: '#000000', strokeWidth: 0 }], layout: { rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0, shape: 'rect', innerDiameterMm: 20, innerShape: 'rectangle' } }
  check(normalizeDocument(JSON.parse(JSON.stringify(rectHoleDoc))).layout?.innerShape === 'rectangle', 'rectangle hole shape survives save/open normalization')
  const rectHoleScene = resolvePrintPageScene(rectHoleDoc, ctx)
  check(rectHoleScene.paperGeometry?.innerShape === 'rectangle', 'print scene forwards the rectangle hole shape to output')
  const rectHoleOutput = await renderLabel(rectHoleDoc, { dpi: 254, scene: rectHoleScene })
  const rectHolePixel = (x: number, y: number) => rectHoleOutput.getContext('2d')!.getImageData(x, y, 1, 1).data[0]
  // 60mm@254dpi=600px、20mm 孔=200px：取孔内 (380,380) —— 方孔在、圆孔（半径 100px）不在。
  const circleHoleOutput = await renderLabel({ ...rectHoleDoc, layout: { ...rectHoleDoc.layout!, innerShape: 'circle' } }, { dpi: 254 })
  check(rectHolePixel(300, 300) === 255 && rectHolePixel(380, 380) === 255 && rectHolePixel(300, 150) === 0, 'renderLabel clips the rectangle hole as a centred square')
  check(circleHoleOutput.getContext('2d')!.getImageData(380, 380, 1, 1).data[0] === 0, 'circle hole leaves the square corner printed (rect and circle holes differ)')
  // round-63：**透明底条码必须真的画出条码**。bwip-js 不接受 8 位带 alpha 的 backgroundcolor——
  // 传 'FFFFFF00' 会把整张图渲染成 100% 黑块（实测：透明 0% / 暗 100%），而新建条码默认
  // backgroundTransparent=true，用户看到的就是「新建条码全黑」。要透明底必须**不传** backgroundcolor
  // （实测：透明 53.2% / 暗 46.8%）。这两条断言就是钉住"别再写回 8 位 alpha"。
  const transparentBarcode = await barcodeToDataURL('code128', '1234567890', 12, {
    barcodeOptions: { xSizeMil: 10, xSizeMm: 0.254, w2n: 2, humanPosition: 'below', humanAlign: 'center', humanOffsetMm: 0 },
    showText: true,
    backgroundTransparent: true
  })
  const barcodeImage = await fabric.Image.fromURL(transparentBarcode)
  const barcodeEl = barcodeImage.getElement() as HTMLImageElement
  const barcodeCanvas = document.createElement('canvas')
  barcodeCanvas.width = barcodeEl.width
  barcodeCanvas.height = barcodeEl.height
  const barcodeCtx = barcodeCanvas.getContext('2d')!
  barcodeCtx.drawImage(barcodeEl, 0, 0)
  const barcodePixels = barcodeCtx.getImageData(0, 0, barcodeCanvas.width, barcodeCanvas.height).data
  let barcodeDark = 0
  let barcodeTransparent = 0
  for (let i = 0; i < barcodePixels.length; i += 4) {
    if (barcodePixels[i + 3] < 8) barcodeTransparent++
    else if (barcodePixels[i] < 64) barcodeDark++
  }
  const barcodeTotal = barcodeCanvas.width * barcodeCanvas.height
  check(barcodeDark / barcodeTotal > 0.2 && barcodeDark / barcodeTotal < 0.8, 'transparent-background barcode renders bars (not a solid black block)')
  check(barcodeTransparent / barcodeTotal > 0.2, 'transparent-background barcode keeps its transparent background')
  const styledBarcode = { id: 'styled-barcode', type: 'barcode' as const, x: 2, y: 2, w: 54, h: 24, rotation: 0, symbology: 'code128', showText: true, source: { kind: 'constant' as const, value: 'ABC12345' }, fontFamily: 'Arial', fontSize: 3, backgroundTransparent: true }
  const baseBarcodeDoc = { ...doc, objects: [styledBarcode] }
  const baseBarcodeCanvas = await renderLabel(baseBarcodeDoc, { dpi: 203 })
  for (const patch of [{ fontFamily: 'monospace' }, { fontSize: 5 }, { bold: true }, { italic: true }, { underline: true }, { strikeout: true }, { reverse: true }, { fontWidthScale: 1.5 }, { charSpacing: 0.7 }]) {
    const changed = await renderLabel({ ...doc, objects: [{ ...styledBarcode, ...patch }] }, { dpi: 203 })
    check(!same(baseBarcodeCanvas, changed), `barcode human text style changes output pixels: ${Object.keys(patch)[0]}`)
  }
  const hiddenText = { ...styledBarcode, barcodeOptions: { humanPosition: 'none' as const } }
  check(same(await renderLabel({ ...doc, objects: [hiddenText] }, { dpi: 203 }), await renderLabel({ ...doc, objects: [{ ...hiddenText, fontSize: 10, bold: true }] }, { dpi: 203 })), 'hidden barcode human text ignores font styles')
  const printer = { ...defaultPrinterConfig(), driver: 'tspl' as const, dpi: 203 }
  const styledScene = resolvePrintScene(baseBarcodeDoc, ctx)
  const preparedScene = await prepareBitmapsForScene(styledScene, printer)
  const objectBitmapOf = (scene: typeof preparedScene) => scene.primitives.find((primitive) => 'bitmap' in primitive && primitive.bitmap)?.bitmap as typeof preparedScene['primitives'][number]['bitmap']
  const barcodeBitmap = objectBitmapOf(preparedScene)
  check(!preparedScene.pageBitmap, 'styled barcode no longer forces a page bitmap')
  check(Boolean(barcodeBitmap), 'styled barcode gets its own object bitmap')
  const barcodeBounds = rotatedObjectBounds(styledBarcode, 0.4)
  const barcodeCrop = await renderLabel({ ...doc, widthMm: barcodeBounds.w, heightMm: barcodeBounds.h, objects: [{ ...styledBarcode, x: styledBarcode.x - barcodeBounds.x, y: styledBarcode.y - barcodeBounds.y }] }, { dpi: 203 })
  const cropPixels = barcodeCrop.getContext('2d')!.getImageData(0, 0, barcodeCrop.width, barcodeCrop.height).data
  let objectMismatches = 0
  const objectMono = barcodeBitmap!
  for (let y = 0; y < objectMono.height; y++) for (let x = 0; x < objectMono.width; x++) {
    const i = (y * objectMono.width + x) * 4
    const expected = 0.299 * cropPixels[i] + 0.587 * cropPixels[i + 1] + 0.114 * cropPixels[i + 2] < 128
    if (expected !== Boolean(objectMono.bytes[y * objectMono.bytesPerRow + (x >> 3)] & (0x80 >> (x & 7)))) objectMismatches++
  }
  check(objectMismatches === 0, 'object bitmap matches the cropped preview pixels')
  check(objectBitmapOf(await prepareBitmapsForScene(styledScene, printer)) === barcodeBitmap, 'unchanged scene reuses the cached object bitmap')
  for (const changed of [
    { ...styledScene, primitives: styledScene.primitives.map((primitive) => ({ ...primitive, object: { ...primitive.object, fontSize: 4 } })) },
    { ...styledScene, primitives: styledScene.primitives.map((primitive) => ({ ...primitive, context: { ...primitive.context, sharedVars: { color: '#ff0000' } } })) }
  ]) {
    check(objectBitmapOf(await prepareBitmapsForScene(changed, printer)) !== barcodeBitmap, 'changed object or context invalidates the object bitmap cache')
  }
  // 弧形文字改为按实测包围盒裁对象位图
  const arcScene = resolvePrintScene({ ...doc, objects: [{ ...text, arc: true }] }, ctx)
  const arcPrepared = await prepareBitmapsForScene(arcScene, printer)
  const arcBitmap = arcPrepared.primitives.find((primitive) => 'bitmap' in primitive && primitive.bitmap)?.bitmap
  check(!arcPrepared.pageBitmap && Boolean(arcBitmap), 'arc text uses its own measured-bounds object bitmap')
  check(Boolean(arcBitmap && arcBitmap.width > 0 && arcBitmap.bytes.some((byte) => byte !== 0)), 'arc text bitmap contains rendered ink')
  // 整页位图仍用于「光盘 + 越出可打印区域的原生图元」
  const discScene = resolvePrintScene({ ...doc, layout: { shape: 'ellipse' as const, innerDiameterMm: 5 }, objects: [
    { id: 'bc', type: 'barcode' as const, x: 50, y: 34, w: 20, h: 6, rotation: 0, symbology: 'code128', showText: false, color: '#000000', source: { kind: 'constant' as const, value: 'ABC123' } }
  ] }, ctx)
  const pagePrepared = await prepareBitmapsForScene(discScene, printer)
  check(Boolean(pagePrepared.pageBitmap), 'native object outside the disc still uses a page bitmap')
  const pageBitmap = pagePrepared.pageBitmap!
  check((await prepareBitmapsForScene(discScene, printer)).pageBitmap === pageBitmap, 'unchanged page reuses the cached page bitmap')
  for (const changed of [
    { ...discScene, labelShape: 'roundRect' as const },
    { ...discScene, paperGeometry: { innerDiameterMm: 5 } },
    { ...discScene, labelCells: [{ x: 0, y: 0, widthMm: 30, heightMm: 40 }] },
    { ...discScene, colorIndexTable: ['#ffffff', '#ff0000'] },
    { ...discScene, primitives: discScene.primitives.map((primitive) => ({ ...primitive, context: { ...primitive.context, sharedVars: { color: '#ff0000' } } })) }
  ]) {
    check((await prepareBitmapsForScene(changed, printer)).pageBitmap !== pageBitmap, 'changed geometry or render context invalidates page bitmap cache')
  }
  // 方形二维码必须是正方形图片：bwip 只给 height 时会把 QR 拉扁（新建即失真）。
  const qrUrl = await barcodeToDataURL('qrcode', '1234567890', 10, { showText: false })
  const qrImg = new Image()
  const qrLoaded = new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve()
    qrImg.onerror = () => reject(new Error('QR image failed'))
  })
  qrImg.src = qrUrl
  await qrLoaded
  check(Math.abs(qrImg.naturalWidth - qrImg.naturalHeight) <= 2, 'QR bitmap is square')
  // 二维码打印走对象位图，且位图要把框外的人读文字一起裁进来
  {
    const qrScene = resolvePrintScene({ ...doc, objects: [{
      id: 'qr-print', type: 'barcode' as const, x: 5, y: 5, w: 20, h: 20, rotation: 0,
      symbology: 'qrcode', showText: true, color: '#000000', fontFamily: 'Arial', fontSize: 3,
      source: { kind: 'constant' as const, value: '1234567890' }
    }] }, ctx)
    const qrPrepared = await prepareBitmapsForScene(qrScene, printer)
    const qrMono = qrPrepared.primitives.find((primitive) => 'bitmap' in primitive && primitive.bitmap)?.bitmap
    check(Boolean(qrMono) && !qrPrepared.pageBitmap, 'QR prints as an object bitmap (WYSIWYG size)')
    check(Boolean(qrMono && qrMono.height > 20 * 203 / 25.4), `QR object bitmap includes the human-readable text below the frame (h=${qrMono?.height} w=${qrMono?.width} page=${Boolean(qrPrepared.pageBitmap)})`)
  }
  // 二维码对象位图：必须真的有墨、且落点与对象框一致（DM 偏上/QR 不出图的回归）
  {
    for (const symbology of ['qrcode', 'datamatrix']) {
      const scene = resolvePrintScene({ ...doc, objects: [{
        id: `ink-${symbology}`, type: 'barcode' as const, x: 10, y: 10, w: 20, h: 20, rotation: 0,
        symbology, showText: true, color: '#000000', fontFamily: 'Arial', fontSize: 3,
        source: { kind: 'constant' as const, value: '1234567890' }
      }] }, ctx)
      const prepared = await prepareBitmapsForScene(scene, printer)
      const mono = prepared.primitives.find((primitive) => 'bitmap' in primitive && primitive.bitmap)?.bitmap
      const ink = mono ? mono.bytes.reduce((sum, byte) => sum + byte, 0) : 0
      check(Boolean(mono) && ink > 0, `${symbology} object bitmap has ink`)
      check(Boolean(mono && Math.abs((mono.originYMm ?? -1) - 10) < 0.6), `${symbology} bitmap origin matches the object top (y=${mono?.originYMm})`)
    }
  }
  // 现场同款：A4 标签上 10mm 二维码（带文字），准备出的对象位图必须真有墨
  {
    const a4Doc = resolvePrintScene({
      version: 1, name: 'a4', widthMm: 210, heightMm: 297, objects: [{
        id: 'qr-a4', type: 'barcode' as const, x: 27.7, y: 22.16, w: 10, h: 10, rotation: 0,
        symbology: 'qrcode', showText: true, color: '#000000', fontFamily: 'Arial', fontSize: 3,
        source: { kind: 'constant' as const, value: '1234567890' }
      }]
    }, ctx)
    const prepared = await prepareBitmapsForScene(a4Doc, printer)
    const mono = prepared.primitives.find((primitive) => 'bitmap' in primitive && primitive.bitmap)?.bitmap
    let bits = 0
    if (mono) for (const byte of mono.bytes) for (let bit = 0; bit < 8; bit++) if (byte & (1 << bit)) bits++
    const ratio = mono ? bits / (mono.width * mono.height) : 0
    const direct = await renderBarcodeCanvasAtDpi({ id: 'qr-a4', type: 'barcode', x: 27.7, y: 22.16, w: 10, h: 10, rotation: 0, symbology: 'qrcode', showText: true, color: '#000000', fontFamily: 'Arial', fontSize: 3, source: { kind: 'constant', value: '1234567890' } } as never, '1234567890', printer.dpi)
    const dctx = direct.canvas.getContext('2d')!
    const dp = dctx.getImageData(0, 0, direct.canvas.width, direct.canvas.height).data
    let ddark = 0
    for (let i = 0; i < dp.length; i += 4) if (dp[i] < 128) ddark++
    check(ratio > 0.05, `A4 10mm QR object bitmap has ink (dark=${(ratio * 100).toFixed(1)}% ${mono?.width}x${mono?.height})`)
  }
  // 10mm 小二维码 + 长文字（现场尺寸）：位图必须有足够墨，不能是空白
  {
    const small = { id: 'qr-small', type: 'barcode' as const, x: 10, y: 10, w: 10, h: 10, rotation: 0, symbology: 'qrcode', showText: true, color: '#000000', fontFamily: 'Arial', fontSize: 3, source: { kind: 'constant' as const, value: '1234567890' } }
    const rendered = await renderBarcodeCanvasAtDpi(small as never, '1234567890', 203)
    const context = rendered.canvas.getContext('2d')!
    const pixels = context.getImageData(0, 0, rendered.canvas.width, rendered.canvas.height).data
    let dark = 0
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 128) dark++
    const ratio = dark / (pixels.length / 4)
    check(ratio > 0.05, `small QR canvas has ink (dark=${(ratio * 100).toFixed(1)}% size=${rendered.canvas.width}x${rendered.canvas.height} symbol=${rendered.symbolWidthPx}x${rendered.symbolHeightPx})`)
  }
  // 驱动打印页（矢量 SVG）：二维码/DataMatrix 必须出现在对象框里，不能跑位或消失
  {
    const dpi = 203
    const dpm = dpi / 25.4
    for (const symbology of ['qrcode', 'datamatrix']) {
      const driverDoc = { ...doc, objects: [{
        id: `drv-${symbology}`, type: 'barcode' as const, x: 10, y: 10, w: 20, h: 20, rotation: 0,
        symbology, showText: true, color: '#000000', fontFamily: 'Arial', fontSize: 3,
        source: { kind: 'constant' as const, value: '1234567890' }
      }] }
      const svg = await renderLabelSvg(driverDoc as never, { dpi })
      const img = new Image()
      const loaded = new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('driver svg failed')) })
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
      await loaded
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(60 * dpm)
      canvas.height = Math.round(40 * dpm)
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      let inBox = 0
      let aboveBox = 0
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4
          if (data[i] >= 200) continue
          const xMm = x / dpm
          const yMm = y / dpm
          if (xMm >= 10 && xMm <= 30 && yMm >= 10 && yMm <= 30) inBox++
          else if (xMm >= 10 && xMm <= 30 && yMm >= 6 && yMm < 10) aboveBox++
        }
      }
      check(inBox > 50, `driver page draws the ${symbology} inside its object box (ink=${inBox})`)
      check(aboveBox === 0, `driver page keeps the ${symbology} inside its object box (above=${aboveBox})`)
    }
  }
  // 二维码实际生成 TSPL 指令时，BITMAP 坐标必须非负、且没有退回整页位图
  {
    const cmdScene = resolvePrintScene({ ...doc, objects: [{
      id: 'qr-cmd', type: 'barcode' as const, x: 10, y: 10, w: 20, h: 20, rotation: 0,
      symbology: 'qrcode', showText: true, color: '#000000', fontFamily: 'Arial', fontSize: 3,
      source: { kind: 'constant' as const, value: '1234567890' }
    }] }, ctx)
    const prepared = await prepareBitmapsForScene(cmdScene, printer)
    const commands = buildCommands({} as never, printer, { count: 1, copy: 1, title: 'qr', datasets: {}, resolvedPages: [prepared] })
    const bitmapLine = commands.text.split(String.fromCharCode(10)).find((line) => line.startsWith('BITMAP '))
    check(Boolean(bitmapLine), 'QR emits a BITMAP command')
    const coords = bitmapLine ? bitmapLine.split(',').slice(0, 2).map((part) => Number(part.replace('BITMAP ', ''))) : []
    check(coords.length === 2 && coords.every((value) => Number.isFinite(value) && value >= 0), `QR BITMAP coordinates are non-negative (${bitmapLine})`)
    check(!commands.text.includes('PAGE_RAW'), 'QR does not fall back to a page bitmap')
  }
  // 靠左放置 + 文字比码宽：位图不能出现负坐标（负 x 的 BITMAP 打印机会丢）
  {
    const edgeScene = resolvePrintScene({ ...doc, objects: [{
      id: 'qr-edge', type: 'barcode' as const, x: 0.5, y: 12, w: 10, h: 10, rotation: 0,
      symbology: 'qrcode', showText: true, color: '#000000', fontFamily: 'Arial', fontSize: 3,
      source: { kind: 'constant' as const, value: 'ABCDEFGHIJKLMNOP' }
    }] }, ctx)
    const prepared = await prepareBitmapsForScene(edgeScene, printer)
    const mono = prepared.primitives.find((primitive) => 'bitmap' in primitive && primitive.bitmap)?.bitmap
    check(Boolean(mono) && (mono?.originXMm ?? -1) >= -0.01, `edge QR bitmap has no negative origin (x=${mono?.originXMm})`)
    check(Boolean(mono && mono.bytes.some((byte) => byte !== 0)), 'edge QR bitmap still has ink')
  }
  // 二维码按打印 DPI 直接生成：码区 = 对象尺寸，模组落在整数点上（不再重采样）
  {
    const bar = { id: 'qr-dpi', type: 'barcode' as const, x: 5, y: 5, w: 20, h: 20, rotation: 0, symbology: 'qrcode', showText: false, color: '#000000', fontFamily: 'Arial', fontSize: 3, source: { kind: 'constant' as const, value: '1234567890' } }
    const at203 = await renderBarcodeCanvasAtDpi(bar as never, '1234567890', 203)
    const at300 = await renderBarcodeCanvasAtDpi(bar as never, '1234567890', 300)
    check(Math.abs(at203.symbolWidthPx / (203 / 25.4) - 20) < 1, 'DPI barcode symbol matches the object size')
    {
      const context = at203.canvas.getContext('2d')!
      const pixels = context.getImageData(0, 0, at203.canvas.width, at203.canvas.height).data
      let dark = 0
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 128) dark++
      const ratio = dark / (pixels.length / 4)
      check(ratio > 0.05, `DPI barcode canvas actually contains the symbol (dark=${(ratio * 100).toFixed(1)}%)`)
    }

    check(Math.abs(at300.symbolWidthPx / at203.symbolWidthPx - 300 / 203) < 0.05, 'DPI barcode scales with the printer resolution')
    check(Number.isInteger(at203.symbolWidthPx) && Number.isInteger(at203.symbolHeightPx), 'DPI barcode is generated on whole dots')
  }
  // Data Matrix 反白：白码黑底 —— 与正常图逐像素相反（反白暗像素比例 ≈ 1 - 正常暗像素比例）
  {
    const darkRatio = async (url: string) => {
      const img = new Image()
      const loaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('DM image failed'))
      })
      img.src = url
      await loaded
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(img, 0, 0)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let dark = 0
      for (let i = 0; i < pixels.length; i += 4) {
        // 透明像素按白底处理
        if (pixels[i + 3] > 0 && pixels[i] < 128) dark++
      }
      return dark / (pixels.length / 4)
    }
    const normalRatio = await darkRatio(await barcodeToDataURL('datamatrix', '123456', 10, { showText: false }))
    const inverseRatio = await darkRatio(await barcodeToDataURL('datamatrix', '123456', 10, { showText: false, barcodeOptions: { inverse: true } }))
    check(Math.abs(normalRatio + inverseRatio - 1) < 0.05, `inverse Data Matrix inverts the normal symbol (normal=${normalRatio.toFixed(3)} inverse=${inverseRatio.toFixed(3)})`)
    check(inverseRatio > 0.3 && inverseRatio < 0.95, 'inverse Data Matrix has black background and white modules')
  }
  let sizeRejected = false
  try { await barcodeToDataURL('code128', 'ABC12345', 12, { showText: true, humanTextStyle: { fontSize: 1000, fontWidthScale: 10 } }) }
  catch (error) { sizeRejected = error instanceof Error && error.message.includes('尺寸超限') }
  check(sizeRejected, 'oversized human text is rejected before allocating the output canvas')
  return results
}
