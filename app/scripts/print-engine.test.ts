// ---------- 指令引擎单测（Node 环境，无硬件依赖） ----------
// 运行：npx esbuild scripts/print-engine.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_t.cjs && node scripts/_t.cjs
import assert from 'node:assert'
import type { Dataset, LabelDoc, PrinterConfig } from '../src/shared/model'
import { advanceSerial, resolveSourceText } from '../src/shared/model'
import { normalizeDocument } from '../src/shared/domain'
import { applyObjectFormat, decodeControlChars, runGlobalScriptHook, runScriptSource } from '../src/shared/domain/datasource'
import { buildCommands } from '../src/shared/print/engine'
import { resolvePrintScene } from '../src/shared/print/scene'
import { sceneNeedsRasterization } from '../src/shared/print/capabilities'
import { buildExecutablePrintPlan, buildPrintPlan } from '../src/shared/print/plan'
import { fromDocJson, toMsdx } from '../src/renderer/src/io/msdx'
import { decodeDelimitedText, detectDelimiter, parseCSV } from '../src/renderer/src/editor/dataImport'
import iconv from 'iconv-lite'
import { executePrint } from '../src/renderer/src/features/printing/printExecutor'
import { PRINT_LOG_CSV_HEADERS } from '../src/shared/print/logSchema'
import { rotateDocumentForPrint } from '../src/shared/print/layout'

function sampleDoc(): LabelDoc {
  return {
    version: 1,
    name: '测试标签',
    widthMm: 60,
    heightMm: 40,
    objects: [
      { id: '1', type: 'rect', x: 0, y: 0, w: 60, h: 40, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 0.3 },
      { id: '2', type: 'text', x: 4, y: 4, w: 52, h: 6, rotation: 0, fontFamily: '微软雅黑', fontSize: 5, bold: false, align: 'center', color: '#000', source: { kind: 'constant', value: '示例商品标签' } },
      { id: '3', type: 'barcode', x: 8, y: 13, w: 44, h: 14, rotation: 0, symbology: 'code128', showText: true, source: { kind: 'serial', prefix: 'SN-', start: 1001, step: 1, digits: 4, current: 1001 } },
      { id: '4', type: 'line', x: 8, y: 32, w: 44, h: 0, rotation: 0, stroke: '#000', strokeWidth: 0.3 }
    ]
  }
}

function printer(over: Partial<PrinterConfig> = {}): PrinterConfig {
  return {
    driver: 'tspl',
    dpi: 203,
    speed: 4,
    density: 8,
    printMode: 'thermal',
    labelType: 'gap',
    topOffsetMm: 0,
    mediaHandle: 'tear',
    backfeedMm: 0,
    port: { type: 'file', encoding: 'utf8' },
    ...over
  }
}

let passed = 0
function check(name: string, fn: () => void) {
  fn()
  passed++
  console.log('  ✓ ' + name)
}

console.log('指令引擎测试：')

// ---------- 文档编解码与兼容字段保真 ----------
{
  const source = { ...sampleDoc(), remark: '保留备注', orientation: 90, keyboardOrder: ['批号'], colorIndexTable: ['#000000'] }
  const decoded = fromDocJson(toMsdx(source))
  check('MSDX 往返保留 LabelShop 兼容文档字段', () => {
    assert.strictEqual(decoded.remark, source.remark)
    assert.strictEqual(decoded.orientation, source.orientation)
    assert.deepStrictEqual(decoded.keyboardOrder, source.keyboardOrder)
    assert.deepStrictEqual(decoded.colorIndexTable, source.colorIndexTable)
  })
  const normalized = normalizeDocument({
    ...sampleDoc(),
    printer: { ...printer({ dpi: 99999 }), port: { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 } },
    connections: { main: { id: 'main', name: '主库', driver: 'sqlserver', password: '', server: '' } }
  })
  check('文档入口统一规范化打印机与数据库连接配置', () => {
    assert.strictEqual(normalized.printer?.dpi, 1200)
    assert.strictEqual(normalized.connections?.main?.password, undefined)
    assert.strictEqual(normalized.connections?.main?.name, '主库')
  })
  check('模板保留 Windows 目标打印机名称', () => {
    const withTarget = normalizeDocument({ ...sampleDoc(), printer: { ...printer(), printerName: 'Zebra ZD421' } })
    assert.strictEqual(withTarget.printer?.printerName, 'Zebra ZD421')
  })
  check('数据集重复列名和表格方向字段被规范化', () => {
    const value = normalizeDocument({
      ...sampleDoc(),
      datasets: { d: { name: 'd', columns: ['sku', 'sku', ''], rows: [['1', '2', '3']] } },
      objects: [{ id: 'table', type: 'table', x: 0, y: 0, w: 30, h: 10, rotation: 0, rows: 2, cols: 2, borderWidth: 0.2, borderColor: '#000', colWidths: [1, 2], rowHeights: [2, 1], merges: [{ r: 1, c: 1, r2: 0, c2: 0 }] }]
    })
    assert.deepStrictEqual(value.datasets?.d.columns, ['sku', 'sku_2', '列3'])
    assert.deepStrictEqual((value.objects[0] as { merges?: unknown[] }).merges, [{ r: 0, c: 0, r2: 1, c2: 1 }])
  })
  check('MSDX 拒绝非法标签尺寸', () => {
    assert.throws(() => fromDocJson(JSON.stringify({ ...source, widthMm: 0 })), /尺寸无效/)
  })
  check('旧文档字段迁移到统一模型', () => {
    const legacy = { ...source, version: 0, objects: source.objects.map((object) => ({ ...object })) }
    const text = legacy.objects.find((object) => object.type === 'text') as Record<string, unknown>
    text.textFormat = 'upper'
    const barcode = legacy.objects.find((object) => object.type === 'barcode') as Record<string, unknown>
    barcode.moduleWidthMm = 0.4
    barcode.wideRatio = 2.5
    const migrated = fromDocJson(JSON.stringify(legacy))
    assert.strictEqual((migrated.objects.find((object) => object.type === 'text') as { format?: string }).format, 'upper')
    assert.strictEqual((migrated.objects.find((object) => object.type === 'barcode') as { barcodeOptions?: { xSizeMm?: number } }).barcodeOptions?.xSizeMm, 0.4)
  })
  check('键盘称重配置与子串共享变量通过规范化保真', () => {
    const raw = {
      ...source,
      objects: [
        {
          id: 'keyboard', type: 'text', x: 1, y: 1, w: 20, h: 5, rotation: 0,
          fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000',
          source: { kind: 'keyboard', label: '重量', inputDevice: 'weigh', weighProtocol: 'mettler', weighPort: 'COM8', weighBaud: '19200', weighUnit: 'kg', weighDecimals: 3, weighAutoPrint: true, weighUnitConv: true },
          subSources: [{ kind: 'constant', value: ' kg', sharedName: 'unit' }]
        }
      ]
    }
    const object = fromDocJson(JSON.stringify(raw)).objects[0] as { source: Record<string, unknown>; subSources?: Array<Record<string, unknown>> }
    assert.strictEqual(object.source.inputDevice, 'weigh')
    assert.strictEqual(object.source.weighProtocol, 'mettler')
    assert.strictEqual(object.source.weighPort, 'COM8')
    assert.strictEqual(object.source.weighDecimals, 3)
    assert.strictEqual(object.source.weighAutoPrint, true)
    assert.strictEqual(object.source.weighUnitConv, true)
    assert.strictEqual(object.subSources?.[0]?.sharedName, 'unit')
  })
  check('未来文档版本明确拒绝', () => {
    assert.throws(() => fromDocJson(JSON.stringify({ format: 'maxlabel-msdx', version: 99, app: 'MaxLabel', doc: source })), /版本不受支持/)
  })
}

// ---------- 统一 ResolvedPrintScene ----------
{
  const doc = sampleDoc()
  doc.objects.push({
    id: 'hidden', type: 'text', x: 0, y: 0, w: 10, h: 5, rotation: 0,
    visible: false, fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000',
    source: { kind: 'constant', value: 'HIDDEN' }
  })
  doc.objects.push({
    id: 'suppressed', type: 'barcode', x: 0, y: 0, w: 10, h: 5, rotation: 0,
    suppressPrint: true, symbology: 'code128', showText: false,
    source: { kind: 'constant', value: 'SUPPRESSED' }
  })
  const scene = resolvePrintScene(doc, {
    labelIndex: 2, recordIndex: 1, copy: 3, count: 2, totalLabels: 2,
    title: 'scene', printerName: 'test', datasets: {}, sharedVars: {}
  })
  check('ResolvedPrintScene 统一解析数据并过滤不可打印对象', () => {
    assert.strictEqual(scene.labelIndex, 2)
    assert.strictEqual(scene.copy, 3)
    assert.ok(scene.primitives.some((p) => p.kind === 'barcode' && p.value === 'SN-1002'))
    assert.ok(!scene.primitives.some((p) => p.object.id === 'hidden' || p.object.id === 'suppressed'))
  })
  const suppressedScene = resolvePrintScene(doc, {
    labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1,
    title: 'scene', printerName: 'test', datasets: {}, sharedVars: {}
  }, { includeSuppressed: true })
  check('打印选项允许显式包含 suppressPrint 对象', () => {
    assert.ok(suppressedScene.primitives.some((primitive) => primitive.object.id === 'suppressed'))
  })
  check('原生能力判定阻止动态颜色和条码高级选项静默失真', () => {
    const dynamic = resolvePrintScene({ ...doc, objects: [{ ...doc.objects[0], colorChange: { mode: 'index', tableSource: 'shared', privateTable: [], changeMode: 'solid', blockRows: 1, blockCols: 1, variableName: '' } }] }, {
      labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: 'scene', printerName: 'test', datasets: {}, sharedVars: {}
    })
    assert.strictEqual(sceneNeedsRasterization(dynamic, printer()), true)
    const advanced = resolvePrintScene({ ...doc, objects: [{ ...doc.objects[2], barcodeOptions: { xSizeMm: 0.25, eanAddon: '5' } }] }, {
      labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: 'scene', printerName: 'test', datasets: {}, sharedVars: {}
    })
    assert.strictEqual(sceneNeedsRasterization(advanced, printer()), true)
  })
  const resolvedDataScene = resolvePrintScene({
    ...doc,
    objects: [{ ...doc.objects[0], source: { kind: 'database', dataset: 'rows', field: 'value' } }]
  }, {
    labelIndex: 2, recordIndex: 1, copy: 1, count: 2, totalLabels: 2,
    title: 'scene', printerName: 'test', activeDataset: 'rows', recordRow: ['row-1'], sharedVars: {},
    datasets: { rows: { name: 'rows', columns: ['value'], rows: Array.from({ length: 1000 }, (_, index) => [String(index)]) } }
  })
  check('ResolvedPrintScene 快照只保留当前行与字段元数据', () => {
    const context = resolvedDataScene.primitives[0].context
    assert.deepStrictEqual(context.recordRow, ['row-1'])
    assert.strictEqual(context.datasets.rows.rows.length, 0)
    assert.deepStrictEqual(context.datasets.rows.columns, ['value'])
  })
}

{
  const r = buildCommands(sampleDoc(), printer(), {
    count: 1, copy: 2, title: 'layout', datasets: {},
    layout: { rows: 1, cols: 2, rowGapMm: 0, colGapMm: 2, printOrder: 'row', startPos: 'tl' }
  })
  check('原生指令拼版在同一物理页面偏移并推进数据', () => {
    assert.ok(r.text.includes('SIZE 122 mm,40 mm'), '两列页面宽度 = 60×2+2')
    assert.strictEqual(r.text.split('CLS').length - 1, 1, '一个物理页面只清屏一次')
    assert.ok(r.text.includes('"SN-1001"') && r.text.includes('"SN-1002"'), '单页两枚标签数据分别推进')
    const xs = [...r.text.matchAll(/BARCODE (\d+),/g)].map((m) => Number(m[1]))
    assert.strictEqual(xs.length, 2)
    assert.ok(xs[1] > xs[0] + 400, '第二枚标签具有列偏移')
    assert.strictEqual(r.labelCount, 4, '1页×2列×2份')
  })
}

// ---------- TSPL ----------
{
  const doc = sampleDoc()
  const r = buildCommands(doc, printer(), { count: 2, copy: 2, title: '测试', datasets: {} })
  const t = r.text
  check('TSPL 标签尺寸与密度', () => {
    assert.ok(t.includes('SIZE 60 mm,40 mm'), 'SIZE')
    assert.ok(t.includes('DENSITY 8'), 'DENSITY')
    assert.ok(t.includes('SPEED 4'), 'SPEED')
  })
  check('TSPL 批量块数 = 打印数量(2)', () => {
    assert.strictEqual(t.split('CLS').length - 1, 2, '两个 CLS')
  })
  check('TSPL 单签拷贝 PRINT', () => {
    assert.ok(t.includes('PRINT 1,2'), 'PRINT 1,2')
  })
  check('TSPL 序列号逐张推进', () => {
    assert.ok(t.includes('"SN-1001"'), 'SN-1001')
    assert.ok(t.includes('"SN-1002"'), 'SN-1002')
  })
  check('TSPL 条码指令', () => {
    assert.ok(t.includes('BARCODE'), 'BARCODE')
    assert.ok(t.includes('"128"'), '码制128')
  })
  check('TSPL 矩形与直线', () => {
    assert.ok(t.includes('BOX '), 'BOX')
    assert.ok(t.includes('LINE '), 'LINE')
  })
  check('labelCount = 数量×拷贝 = 4', () => {
    assert.strictEqual(r.labelCount, 4)
  })
  check('编码默认 utf8', () => {
    assert.strictEqual(r.encoding, 'utf8')
  })
}

// ---------- ZPL ----------
{
  const r = buildCommands(sampleDoc(), printer({ driver: 'zpl' }), { count: 1, copy: 1, title: '测试', datasets: {} })
  const t = r.text
  check('ZPL 起止标签', () => {
    assert.ok(t.includes('^XA'), '^XA')
    assert.ok(t.includes('^XZ'), '^XZ')
  })
  check('ZPL 打印宽度(60mm@203dpi=480)', () => {
    assert.ok(t.includes('^PW480'), '^PW480')
    assert.ok(t.includes('^LL320,Y'), '^LL320,Y')
    assert.ok(t.includes('^PQ1'), '^PQ1')
  })
  check('ZPL 条码与文本', () => {
    assert.ok(t.includes('^BC'), '^BC(Code128)')
    assert.ok(t.includes('^FD'), '^FD')
    assert.ok(t.includes('^FO'), '^FO')
  })
}

// ---------- CPCL ----------
{
  const r = buildCommands(sampleDoc(), printer({ driver: 'cpcl' }), { count: 1, copy: 1, title: '测试', datasets: {} })
  const t = r.text
  check('CPCL 初始化与页宽', () => {
    assert.ok(t.includes('! 0 200 200 315 1'), '初始化行中的 315 是 40mm 页高')
    assert.ok(t.includes('PAGE-WIDTH 472'), '页宽按 CPCL 200 units/inch')
  })
  check('CPCL FORM/PRINT', () => {
    assert.ok(t.includes('FORM'), 'FORM')
    assert.ok(t.includes('PRINT'), 'PRINT')
  })
}

// ---------- 脚本数据源 ----------
{
  const doc = sampleDoc()
  doc.objects[1] = { ...doc.objects[1], source: { kind: 'script', code: 'function OnGetData(){ return "S-" + V_LABELNO; }' } } as LabelDoc['objects'][number]
  const r = buildCommands(doc, printer(), { count: 2, copy: 1, title: '测试', datasets: {}, allowScript: true })
  check('脚本数据源返回逐张值', () => {
    assert.ok(r.text.includes('"S-1"'), 'S-1')
    assert.ok(r.text.includes('"S-2"'), 'S-2')
  })
  const disabled = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('脚本数据源默认关闭', () => {
    assert.ok(!disabled.text.includes('"S-1"'), '未显式允许时不执行脚本')
  })
  const unsafe = buildCommands({ ...doc, objects: [{ ...doc.objects[1], source: { kind: 'script', code: 'function OnGetData(){ while(true){} }' } } as LabelDoc['objects'][number]] }, printer(), { count: 1, copy: 1, title: '测试', datasets: {}, allowScript: true })
  check('脚本安全表达式拒绝循环和动态全局访问', () => {
    assert.ok(!unsafe.text.includes('while'), '不把脚本源码写入输出')
    assert.ok(!unsafe.text.includes('S-1'), '不执行危险脚本')
  })
}

// ---------- 统一打印计划 ----------
{
  const dataset: Dataset = { name: '货物', columns: ['copies'], rows: [['1'], ['2'], ['2'], ['1']] }
  const plan = buildPrintPlan({ test: false, requestedCount: 4, recordStart: 0, dataset, cellsPerPage: 2, defaultCopies: 1, copyField: 'copies' })
  check('打印计划按数据库记录正确计算拼版页', () => {
    assert.deepStrictEqual(plan.pages.map((page) => page.cells.map((cell) => cell.recordIndex)), [[0], [1, 2], [3]])
    assert.strictEqual(plan.physicalPageCount, 3)
    assert.strictEqual(plan.physicalLabelCount, 6)
    assert.strictEqual(plan.serialAdvanceCount, 4)
  })
  const offsetPlan = buildPrintPlan({ test: false, requestedCount: 2, recordStart: 0, dataset, cellsPerPage: 3, startSlot: 2, defaultCopies: 1 })
  check('打印计划保留首页起始标签空位', () => {
    assert.deepStrictEqual(offsetPlan.pages[0].cells.map((cell) => cell.slotIndex), [1, 2])
    assert.ok(offsetPlan.warnings.some((warning) => warning.includes('第 2 个拼版位置')))
  })
  const filteredPlan = buildPrintPlan({ test: false, requestedCount: 2, recordStart: 0, recordIndices: [0, 2], dataset, cellsPerPage: 2, defaultCopies: 1 })
  check('打印计划支持先去重再重新拼版，保留原始数据库行号', () => {
    assert.deepStrictEqual(filteredPlan.pages.flatMap((page) => page.cells.map((cell) => cell.recordIndex)), [0, 2])
    assert.strictEqual(filteredPlan.logicalLabelCount, 2)
  })
  const executable = buildExecutablePrintPlan({ test: false, requestedCount: 4, recordStart: 0, dataset, cellsPerPage: 1, defaultCopies: 1, copyField: 'copies' }, { deduplicateRecords: true })
  check('预览和正式打印共享查重计划', () => {
    assert.deepStrictEqual(executable.pages.flatMap((page) => page.cells.map((cell) => cell.recordIndex)), [0, 1])
    assert.strictEqual(executable.physicalLabelCount, 3)
  })
  const copyOrder = buildPrintPlan({ test: false, requestedCount: 2, recordStart: 0, dataset, cellsPerPage: 1, defaultCopies: 1, copyField: 'copies' })
  check('拷贝数按标签页拆分，驱动和原生输出可保持同一顺序', () => {
    assert.deepStrictEqual(copyOrder.pages.map((page) => ({ record: page.cells[0].recordIndex, copies: page.copies })), [{ record: 0, copies: 1 }, { record: 1, copies: 2 }])
  })
  const testPlan = buildPrintPlan({ test: true, requestedCount: 1, recordStart: 0, dataset, cellsPerPage: 4, startSlot: 3, defaultCopies: 1 })
  check('测试打印在多标签拼版中仍只输出一张标签', () => {
    assert.strictEqual(testPlan.logicalLabelCount, 1)
    assert.strictEqual(testPlan.physicalLabelCount, 1)
    assert.deepStrictEqual(testPlan.pages[0].cells.map((cell) => cell.slotIndex), [2])
  })
}

// ---------- 数据库数据源 ----------
{
  const datasets: Record<string, Dataset> = {
    货物: { columns: ['编号', '名称'], rows: [['A1', '苹果'], ['A2', '香蕉']] }
  }
  const doc = sampleDoc()
  doc.objects[1] = { ...doc.objects[1], source: { kind: 'database', dataset: '货物', field: '名称' } } as LabelDoc['objects'][number]
  const r = buildCommands(doc, printer(), { count: 2, copy: 1, title: '测试', datasets })
  check('数据库数据源逐记录取值', () => {
    assert.ok(r.text.includes('"苹果"'), '苹果')
    assert.ok(r.text.includes('"香蕉"'), '香蕉')
  })
}

// ---------- 对象级格式化 + 子串 ----------
{
  const doc = sampleDoc()
  doc.objects[1] = {
    ...doc.objects[1],
    source: { kind: 'constant', value: 'AbcDef' },
    format: 'upper',
    substr: { start: 1, length: 4 }
  } as LabelDoc['objects'][number]
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {}, allowScript: true })
  check('格式化+子串后文本 = BCDE', () => {
    assert.ok(r.text.includes('"BCDE"'), '得到 BCDE，实际：' + r.text)
  })
}

// ---------- 键盘输入数据源 ----------
{
  const doc = sampleDoc()
  doc.objects[1] = { ...doc.objects[1], source: { kind: 'keyboard', label: '请输入数量' } } as LabelDoc['objects'][number]
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {}, keyboardValues: { '请输入数量': '88' } })
  check('键盘输入数据源取收集值', () => {
    assert.ok(r.text.includes('"88"'), '得到 88')
  })
}

// ---------- 表格对象（TSPL / ZPL / CPCL 网格） ----------
{
  const doc = sampleDoc()
  doc.objects.push({ id: 't1', type: 'table', x: 4, y: 30, w: 52, h: 8, rotation: 0, rows: 2, cols: 3, borderWidth: 0.3, borderColor: '#000' })
  const rT = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('TSPL 表格：外框 BOX + 内部 LINE', () => {
    assert.ok(rT.text.includes('BOX '), 'BOX 外框')
    assert.ok(rT.text.includes('LINE '), 'LINE 网格')
  })
  const rZ = buildCommands(doc, printer({ driver: 'zpl' }), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('ZPL 表格：^GB 外框 + 网格', () => {
    assert.ok(rZ.text.includes('^GB'), '^GB')
  })
  const rC = buildCommands(doc, printer({ driver: 'cpcl' }), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('CPCL 表格：BOX + LINE', () => {
    assert.ok(rC.text.includes('BOX '), 'BOX')
    assert.ok(rC.text.includes('LINE '), 'LINE')
  })
}

// ---------- 椭圆对象 ----------
{
  const doc = sampleDoc()
  doc.objects.push({ id: 'e1', type: 'ellipse', x: 4, y: 30, w: 20, h: 8, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 0.3 })
  const rT = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('TSPL 椭圆：跳过并告警', () => {
    assert.ok(rT.warnings.some((w) => w.includes('椭圆')), '含椭圆告警')
  })
  const rC = buildCommands(doc, printer({ driver: 'cpcl' }), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('CPCL 椭圆：标准协议跳过并告警', () => {
    assert.ok(!rC.text.includes('ELLIPSE '), '不输出非标准 ELLIPSE')
    assert.ok(rC.warnings.some((w) => w.includes('椭圆')), '含椭圆告警')
  })
}

// ---------- 脚本共享变量 ----------
{
  const doc = sampleDoc()
  doc.objects[1] = { ...doc.objects[1], source: { kind: 'script', code: 'function OnGetData(){ return "订单号-001"; }', sharedName: 'ORD' } } as LabelDoc['objects'][number]
  doc.objects.push({ id: 'x1', type: 'text', x: 4, y: 34, w: 52, h: 4, rotation: 0, fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000', source: { kind: 'script', code: 'function OnGetData(){ return "批次:" + ORD; }' } })
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {}, allowScript: true })
  check('脚本共享变量跨对象传递', () => {
    assert.ok(r.text.includes('"批次:订单号-001"'), '共享变量生效')
  })
}

// ---------- 图片/中文位图嵌入（分段指令） ----------
function tinyMono(): import('../src/shared/model').MonoBitmap {
  // 8×8 全黑位图
  const bytes = new Uint8Array(8) // bytesPerRow=1, height=8
  bytes.fill(0xff)
  return { width: 8, height: 8, bytesPerRow: 1, bytes }
}

{
  const doc = sampleDoc()
  doc.objects.push({ id: 'img1', type: 'image', x: 4, y: 30, w: 10, h: 8, rotation: 0, src: 'data:image/png;base64,x' })
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {}, images: { img1: tinyMono() } })
  check('TSPL 图片嵌入：BITMAP + 原始点阵分段', () => {
    assert.ok(r.text.includes('BITMAP'), 'BITMAP 指令')
    const bins = r.segments.filter((s) => s.type === 'bin')
    assert.strictEqual(bins.length, 1, '一个二进制段')
    const b = (bins[0] as { type: 'bin'; data: Uint8Array }).data
    assert.strictEqual(b.length, 8, '8×8 点阵恰好 8 字节，无 BMP 文件头')
  })
  const rz = buildCommands(doc, printer({ driver: 'zpl' }), { count: 1, copy: 1, title: '测试', datasets: {}, images: { img1: tinyMono() } })
  check('ZPL 图片嵌入：^GFA 十六进制', () => {
    assert.ok(rz.text.includes('^GFA'), '^GFA')
    assert.ok(rz.text.includes('ff'), '十六进制数据')
  })
}

{
  // 含中文文本 → 逐张位图（TSPL BITMAP + bin / ZPL ^GFA）
  const doc = sampleDoc()
  doc.objects[1] = { ...doc.objects[1], source: { kind: 'constant', value: '中文标签' } } as LabelDoc['objects'][number]
  const byLabel = [{ [doc.objects[1].id]: tinyMono() }]
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {}, imagesByLabel: byLabel })
  check('TSPL 中文位图：BITMAP 嵌入而非 TEXT', () => {
    assert.ok(r.text.includes('BITMAP'), 'BITMAP')
    assert.ok(!r.text.includes('TEXT '), '不输出 TEXT 指令')
    assert.ok(r.segments.some((s) => s.type === 'bin'), '含二进制段')
  })
  const rz = buildCommands(doc, printer({ driver: 'zpl' }), { count: 1, copy: 1, title: '测试', datasets: {}, imagesByLabel: byLabel })
  check('ZPL 中文位图：^GFA 嵌入', () => {
    assert.ok(rz.text.includes('^GFA'), '^GFA')
  })
}

{
  // RFID：TSPL RFID;EPC + 锁定；ZPL ^RFW / ^RFS / ^RLM
  const doc = sampleDoc()
  const rfidObj: import('../src/shared/model').RfidObj = {
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
  doc.objects.push(rfidObj)
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {}, allowScript: true })
  check('TSPL RFID：写入 EPC + LOCK', () => {
    assert.ok(r.text.includes('RFID;EPC,E2001001'), 'RFID;EPC + 序列号值')
    assert.ok(r.text.includes('RFID;LOCK,A1B2C3D4,00000000,EPC'), 'LOCK 指令')
  })
  const rz = buildCommands(doc, printer({ driver: 'zpl' }), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('ZPL RFID：^RFW 写入 + 访问密码 + ^RLM 锁定', () => {
    assert.ok(rz.text.includes('^RFW,H,,,A^FH\\^FDE2001001'), '^RFW EPC 自动调整 PC bits')
    assert.ok(rz.text.includes('^RFS,H,P^FH\\^FDA1B2C3D4'), '^RFS 访问密码')
    assert.ok(rz.text.includes('^RLM,,,L'), '^RLM 锁定 EPC')
  })
}

{
  // 打印机内建字体：TSPL TEXT "Font3" / ZPL ^A3
  const doc = sampleDoc()
  const t = doc.objects[1] as import('../src/shared/model').TextObj
  t.printerFont = 'Font3'
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('TSPL 内建字体：TEXT "Font3"', () => {
    assert.ok(r.text.includes('TEXT '), 'TEXT')
    assert.ok(r.text.includes('"Font3"'), 'Font3')
  })
  const rzDoc = sampleDoc()
  const tz = rzDoc.objects[1] as import('../src/shared/model').TextObj
  tz.printerFont = 'A'
  const rz = buildCommands(rzDoc, printer({ driver: 'zpl' }), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('ZPL 内建字体：^AA', () => {
    assert.ok(rz.text.includes('^AA'), '^AA')
  })
}

// ---------- 协议语法回归（依据 TSC / Zebra 官方编程手册） ----------
{
  const doc = sampleDoc()
  const text = doc.objects[1] as import('../src/shared/model').TextObj
  text.source = { kind: 'constant', value: 'ROTATE' }
  text.rotation = 90
  const barcode = doc.objects[2] as import('../src/shared/model').BarcodeObj
  barcode.rotation = 270
  const r = buildCommands(doc, printer({ backfeedMm: 2 }), { count: 1, copy: 3, title: 'syntax', datasets: {} })
  check('TSPL 旋转使用 0/90/180/270，回退使用点数', () => {
    assert.match(r.text, /TEXT .*?,90,/)
    assert.match(r.text, /BARCODE .*?,270,/)
    assert.ok(r.text.includes('BACKFEED 16'), '2mm@203dpi=16dot')
    assert.ok(r.text.includes('PRINT 1,3'), '三份使用第二个 PRINT 参数')
  })
}

{
  const doc = sampleDoc()
  const text = doc.objects[1] as import('../src/shared/model').TextObj
  text.source = { kind: 'constant', value: 'A^B~C\\D' }
  const barcode = doc.objects[2] as import('../src/shared/model').BarcodeObj
  barcode.symbology = 'code93'
  doc.objects.push({ ...barcode, id: 'dm', y: 28, symbology: 'datamatrix', source: { kind: 'constant', value: 'DM-001' } })
  const r = buildCommands(doc, printer({ driver: 'zpl' }), { count: 1, copy: 4, title: 'syntax', datasets: {} })
  check('ZPL Code93/Data Matrix 命令与字段转义', () => {
    assert.ok(r.text.includes('^BA'), 'Code93 必须为 ^BA')
    assert.ok(r.text.includes('^BX'), 'Data Matrix 必须为 ^BX')
    assert.ok(!r.text.includes('^BD'), '^BD 是 MaxiCode，不可用于 Data Matrix')
    assert.ok(r.text.includes('^FH\\^FDA\\5EB\\7EC\\5CD^FS'), '字段控制符十六进制转义')
    assert.ok(r.text.includes('^PQ4'), '四份使用 ^PQ4')
  })
}

{
  const doc = sampleDoc()
  const base = doc.objects[2] as import('../src/shared/model').BarcodeObj
  doc.objects.push(
    { ...base, id: 'qr', y: 26, symbology: 'qrcode', source: { kind: 'constant', value: 'QR-001' }, barcodeOptions: { eclevel: 'Q', xSizeMm: 0.5 } },
    { ...base, id: 'pdf', y: 28, symbology: 'pdf417', source: { kind: 'constant', value: 'PDF-001' }, barcodeOptions: { eclevel: '4' } },
    { ...base, id: 'dm', y: 30, symbology: 'datamatrix', source: { kind: 'constant', value: 'DM-001' } }
  )
  const r = buildCommands(doc, printer({ driver: 'cpcl' }), { count: 1, copy: 3, title: 'syntax', datasets: {}, images: { '2': tinyMono() } })
  check('CPCL 页头、线性条码、QR/PDF417/Data Matrix 语法', () => {
    assert.ok(r.text.includes('! 0 200 200 315 3'), '页高与份数位置正确')
    assert.match(r.text, /BARCODE 128 \d+ \d+ \d+ \d+ \d+ SN-1001/)
    assert.ok(r.text.includes('BARCODE QR ') && r.text.includes('QA,QR-001') && r.text.includes('ENDQR'))
    assert.ok(r.text.includes('BARCODE PDF-417 ') && r.text.includes('ENDPDF'))
    assert.ok(r.text.includes('BARCODE DATAMATRIX ') && r.text.includes('ENDDATAMATRIX'))
  })
}

{
  const doc = sampleDoc()
  doc.objects.push({ id: 'img1', type: 'image', x: 4, y: 30, w: 10, h: 8, rotation: 0, src: 'x' })
  const rz = buildCommands(doc, printer({ driver: 'zpl' }), { count: 1, copy: 1, title: 'gfa', datasets: {}, images: { img1: tinyMono() } })
  const rc = buildCommands(doc, printer({ driver: 'cpcl' }), { count: 1, copy: 1, title: 'eg', datasets: {}, images: { img1: tinyMono() } })
  check('位图行宽保持真实值：ZPL ^GFA / CPCL EG', () => {
    assert.ok(rz.text.includes('^GFA,8,8,1,'), '8×8 图的每行字节数为 1')
    assert.ok(rc.text.includes('EG 1 8 '), 'CPCL EG 每行字节数为 1')
  })
}

{
  const doc = sampleDoc()
  doc.objects[2].suppressPrint = true
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: 'suppress', datasets: {} })
  check('suppressPrint 对象不进入原生指令', () => {
    assert.ok(!r.text.includes('BARCODE '), '条码已抑制打印')
  })
}

// ---------- 设备授权标识 ----------
{
  const { machineId } = require('../src/main/license')
  const mid = machineId()
  check('机器码为 16 位十六进制', () => {
    assert.match(mid, /^[0-9a-f]{16}$/)
  })
}

// ---------- ODBC 连接串构造 ----------
{
  const { buildConnectionString } = require('../src/main/db')
  const sql = buildConnectionString({ id: '1', name: 'x', driver: 'sqlserver', server: 'SRV\\INST', database: 'inv', user: 'sa', password: 'p@ss' })
  check('ODBC：SQL Server 连接串包含驱动与库', () => {
    assert.ok(sql.includes('Driver={ODBC Driver 17 for SQL Server}'), sql)
    assert.ok(sql.includes('Server={SRV\\INST}'), sql)
    assert.ok(sql.includes('Database={inv}'), sql)
    assert.ok(sql.includes('Pwd={p@ss}'), sql)
  })
  const mysql = buildConnectionString({ id: '1', name: 'x', driver: 'mysql', server: 'db', database: 'app', user: 'root', password: 'pw' })
  check('ODBC：MySQL 连接串', () => {
    assert.ok(mysql.includes('Driver={MySQL ODBC 8.0 Unicode Driver}'), mysql)
  })
  const dsn = buildConnectionString({ id: '1', name: 'x', driver: 'dsn', dsn: 'MYDSN', user: 'u', password: 'p' })
  check('ODBC：DSN 连接串', () => {
    assert.ok(dsn.startsWith('DSN={MYDSN}'), dsn)
  })
}

// ---------- 打印机真机兼容矩阵 ----------
{
  const { recommendEngine, buildCompatChecklist, COMPAT_MATRIX } = require('../src/shared/print/compat')
  check('兼容矩阵：Zebra 推荐 ZPL、佳博推荐 TSPL', () => {
    assert.strictEqual(recommendEngine('ZD421', 'Zebra').engine, 'zpl')
    assert.strictEqual(recommendEngine('GP-M323', '佳博').engine, 'tspl')
    assert.strictEqual(recommendEngine('', '').engine, 'tspl')
  })
  check('兼容矩阵：未知品牌回退 TSPL 且矩阵含兜底条目', () => {
    assert.ok(COMPAT_MATRIX.some((e) => e.engines.length >= 3 && e.model === '—'), '含兜底条目')
  })
  const p: import('../src/shared/model').PrinterConfig = {
    driver: 'tspl',
    dpi: 203,
    speed: 4,
    density: 8,
    printMode: 'thermal',
    labelType: 'gap',
    topOffsetMm: 0,
    mediaHandle: 'tear',
    backfeedMm: 0,
    port: { type: 'com', comPort: 'COM3', baudRate: 9600, encoding: 'gbk' }
  }
  const cl = buildCompatChecklist(p)
  check('兼容矩阵：清单包含串口与中文编码检查项', () => {
    assert.ok(cl.some((c) => c.includes('COM3')), '含串口项')
    assert.ok(cl.some((c) => c.includes('GBK')), '含编码项')
  })
}

// ---------- IPC 边界契约 ----------
{
  const { validateCloudServerUrl, validateCommandPayload, validateDbConnection, validatePort } = require('../src/main/ipc/validation') as {
    validateCloudServerUrl: (value: unknown) => string
    validateCommandPayload: (value: unknown) => unknown
    validateDbConnection: (value: unknown) => { password?: string }
    validatePort: (value: unknown) => Record<string, unknown>
  }
  check('离线云库允许空地址并拒绝不安全远程地址', () => {
    assert.strictEqual(validateCloudServerUrl(''), '')
    assert.strictEqual(validateCloudServerUrl('offline'), '')
    assert.strictEqual(validateCloudServerUrl('https://cloud.example.com/'), 'https://cloud.example.com')
    assert.throws(() => validateCloudServerUrl('http://cloud.example.com'), /HTTPS/)
  })
  check('数据库空密码保留为系统安全存储回退语义', () => {
    assert.strictEqual(validateDbConnection({ id: 'db', name: '数据库', driver: 'sqlserver', password: '' }).password, undefined)
  })
  check('空指令在主进程边界被拒绝', () => {
    assert.throws(() => validateCommandPayload({ segments: [], encoding: 'utf8', port: { type: 'file', encoding: 'utf8' } }), /打印指令为空/)
  })
  check('打印端口边界不透传未知字段', () => {
    const port = validatePort({ type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100, injected: 'ignored' })
    assert.strictEqual(port.injected, undefined)
    assert.deepStrictEqual(port, { type: 'tcp', encoding: 'utf8', tcpHost: '127.0.0.1', tcpPort: 9100 })
  })
  check('LPT 端口保留 LabelShop 并口配置且不透传未知字段', () => {
    const port = validatePort({ type: 'lpt', encoding: 'gbk', lptPort: 'LPT2', injected: 'ignored' })
    assert.deepStrictEqual(port, { type: 'lpt', encoding: 'gbk', lptPort: 'LPT2' })
  })
}

// ---------- resolveSourceText 单元 ----------
{
  check('序列号解析（按 labelIndex）', () => {
    const s = { kind: 'serial', prefix: 'SN-', start: 1001, step: 1, digits: 4, current: 5 } as const
    assert.strictEqual(resolveSourceText(s, { labelIndex: 1 } as never), 'SN-0005')
    assert.strictEqual(resolveSourceText(s, { labelIndex: 3 } as never), 'SN-0007')
  })
  check('序列号重复按标签推进并在打印后推进一次', () => {
    const s = { kind: 'serial', prefix: 'NO.', start: 1, step: 1, digits: 3, current: 1, repeat: 2, repeatBasis: 'label' } as const
    assert.strictEqual(resolveSourceText(s, { labelIndex: 1 } as never), 'NO.001')
    assert.strictEqual(resolveSourceText(s, { labelIndex: 2 } as never), 'NO.001')
    assert.strictEqual(resolveSourceText(s, { labelIndex: 3 } as never), 'NO.002')
    assert.strictEqual((advanceSerial(s, 2) as { current: number }).current, 2)
  })
  check('序列号初始值可从键盘输入或数据库字段读取', () => {
    const s = { kind: 'serial', prefix: '', start: 1, step: 1, digits: 3, current: 1, initialValueSource: 'keyboard', initialValueField: '批号' } as const
    const keyboard = { labelIndex: 1, keyboardValues: { 批号: '12' } } as never
    assert.strictEqual(resolveSourceText(s, keyboard), '012')
    const db = { kind: 'serial', prefix: '', start: 1, step: 1, digits: 2, current: 1, initialValueSource: 'database', initialValueField: '起始值' } as const
      const dbCtx = { labelIndex: 1, recordIndex: 0, activeDataset: 'd', datasets: { d: { name: 'd', columns: ['起始值'], rows: [['7']] } } } as never
      assert.strictEqual(resolveSourceText(db, dbCtx), '07')
    })
    check('database source uses the selected field and per-label record offset', () => {
      const ctx = {
        labelIndex: 1,
        recordIndex: 0,
        datasets: {
          inventory: {
            name: 'inventory',
            columns: ['SKU', 'name'],
            rows: [['A-01', 'alpha'], ['B-02', 'beta']]
          }
        }
    } as never
    assert.strictEqual(resolveSourceText({ kind: 'database', dataset: 'inventory', field: 'name' }, ctx), 'alpha')
    assert.strictEqual(resolveSourceText({ kind: 'database', dataset: 'inventory', field: 'SKU', recordOffset: 1 }, ctx), 'B-02')
    assert.strictEqual(resolveSourceText({ kind: 'database', dataset: 'inventory', field: 'name' }, { ...ctx, recordIndex: 1 } as never), 'beta')
  })
    check('日期/时间格式化', () => {
    const d = { kind: 'date', format: 'yyyy-MM-dd' } as const
    const out = resolveSourceText(d, undefined as never)
    assert.match(out, /^\d{4}-\d{2}-\d{2}$/, '日期格式')
  })
  check('同一打印上下文固定日期时间快照', () => {
    const fixed = new Date(2024, 0, 2, 3, 4, 5).getTime()
    const d = { kind: 'date', format: 'yyyy-MM-dd' } as const
    const t = { kind: 'time', format: 'HH:mm:ss' } as const
    const ctx = { labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: '', printerName: '', datasets: {}, sharedVars: {}, keyboardValues: {}, now: fixed }
    assert.strictEqual(resolveSourceText(d, ctx), '2024-01-02')
    assert.strictEqual(resolveSourceText(t, ctx), '03:04:05')
  })
  check('日期格式支持中文组合与日期偏移', () => {
    const fixed = new Date(2024, 0, 2, 3, 4, 5).getTime()
    assert.strictEqual(resolveSourceText({ kind: 'date', format: 'yyyy年M月d日', offset: 1 }, { now: fixed } as never), '2024年1月3日')
  })
  check('时间区域与偏移字段可解析', () => {
    const fixed = Date.UTC(2024, 0, 2, 3, 4, 5)
    const out = resolveSourceText({ kind: 'time', format: 'HH:mm:ss', region: 'UTC', offset: 60 }, { now: fixed } as never)
    assert.strictEqual(out, '04:04:05')
  })
}

{
  const vbCtx = { labelIndex: 3, recordIndex: 1, copy: 2, count: 3, totalLabels: 6, title: 'T', printerName: 'P', datasets: {}, sharedVars: {}, keyboardValues: {}, allowScript: true }
  check('VBScript OnGetData supports concatenation, arithmetic and globals', () => {
    assert.strictEqual(runScriptSource('Function OnGetData()\n  OnGetData = "SC=" & V_LABELNO + V_ROW\nEnd Function', vbCtx), 'SC=5')
  })
  check('template lifecycle updates output count and shared variables', () => {
    const result = runGlobalScriptHook('Function OnBeginPrint(State)\n  If State = 2 Then\n    V_TOTALLABELS = 4\n    Batch = "B-" & V_PAGE\n  End If\nEnd Function', vbCtx, 'OnBeginPrint', 2)
    assert.strictEqual(result.totalLabels, 4)
    assert.strictEqual(result.sharedVars.Batch, 'B-3')
  })
  check('substring cut/trim/keep and max length', () => {
    assert.strictEqual(applyObjectFormat('  ABCD  ', undefined, { start: 0, length: -1, cutType: 'trimLeft' }), 'ABCD  ')
    assert.strictEqual(applyObjectFormat('ABCDEFG', undefined, { start: 0, length: -1, cutType: 'keepRight', cutCount: 3 }), 'EFG')
    assert.strictEqual(applyObjectFormat('ABCDEFG', undefined, undefined, { mode: 'max', max: 4, trimDir: 'left' }), 'DEFG')
  })
  check('min length padding', () => {
    assert.strictEqual(applyObjectFormat('7', undefined, undefined, { mode: 'min', min: 3, padDir: 'left', padChar: '0' }), '007')
    assert.strictEqual(applyObjectFormat('7', undefined, undefined, { mode: 'min', min: 3, padDir: 'right', padChar: '0' }), '700')
  })
  check('ASCII 控制字符 1-31 全表解码', () => {
    const names = ['SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI', 'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US']
    const decoded = decodeControlChars(names.map((name) => `<${name}>`).join(''))
    assert.deepStrictEqual([...decoded].map((value) => value.charCodeAt(0)), names.map((_, index) => index + 1))
  })
  check('ASCII 控制字符支持双左尖括号转义', () => {
    assert.strictEqual(decodeControlChars('A<HT>B<<HT>'), `A\tB<HT>`)
  })
}

// ---------- 分隔文本导入 ----------
{
  const csv = '商品,数量,批次\r\n甲产品,10,第一批\r\n乙产品,20,第二批'
  check('分隔文本默认逗号并支持制表符/引号', () => {
    assert.strictEqual(detectDelimiter(csv), ',')
    assert.deepStrictEqual(parseCSV(csv, ','), [['商品', '数量', '批次'], ['甲产品', '10', '第一批'], ['乙产品', '20', '第二批']])
    assert.strictEqual(detectDelimiter('商品\t数量\n甲产品\t10'), '\t')
    assert.deepStrictEqual(parseCSV('商品,备注\n甲产品,"含,逗号"'), [['商品', '备注'], ['甲产品', '含,逗号']])
  })
  check('分隔文本按 BOM 识别 UTF-8/UTF-16，无 BOM 回退 GB18030', () => {
    const utf8 = Uint8Array.from([0xef, 0xbb, 0xbf, ...Buffer.from(csv, 'utf8')])
    const utf16le = Uint8Array.from([0xff, 0xfe, ...Buffer.from(csv, 'utf16le')])
    const gb18030 = iconv.encode(csv, 'gb18030')
    for (const bytes of [utf8, utf16le, gb18030]) {
      const decoded = decodeDelimitedText(bytes)
      assert.strictEqual(parseCSV(decoded)[1][0], '甲产品')
      assert.strictEqual(parseCSV(decoded)[2][2], '第二批')
    }
  })
}

async function runPrintDialogSideEffectChecks() {
  const originalWindow = (globalThis as { window?: unknown }).window
  let commandCalls = 0
  let logCalls = 0
  let serialBumps = 0
  let lastStatus = ''
  ;(globalThis as { window?: unknown }).window = {
    maxlabel: {
      printCommand: async () => {
        commandCalls += 1
        return { ok: true, status: 'submitted' }
      }
    }
  }
  try {
    // 使用无对象模板避开 Node 测试环境没有浏览器 Canvas 的限制；执行路径仍完整经过
    // test 计划、指令提交、日志门禁和序列号回写门禁。
    const doc: LabelDoc = { version: 1, name: '测试打印', widthMm: 60, heightMm: 40, objects: [] }
    const tab = {
      key: 'test-print', title: doc.name, doc, selectedId: null, count: 8, copies: 2,
      datasetName: '', zoom: 1, tool: 'select', recordIdx: 0, startLabel: 1,
      dirty: false, revision: 0
    } as never
    await executePrint(true, {
      sourceDoc: doc,
      printTab: tab,
      printer: printer(),
      options: {
        allowScript: false,
        printNonPrintable: false,
        advanced: { autoCount: false, copyField: true, copyFieldName: 'copies', firstCopyAsk: true, dupcheck: true, currentOnly: false, updateSerial: true },
        keyboardValues: {}
      },
      refreshAutoDb: async () => ({ doc, error: null, revision: 0 }),
      bumpSerial: async () => { serialBumps += 1; return { ok: true } },
      logPrint: async () => { logCalls += 1 },
      setBusy: () => undefined,
      setStatus: (status) => { lastStatus = status }
    }, {})
    assert.strictEqual(commandCalls, 1, `测试打印仍提交一张指令标签：${lastStatus}`)
    assert.strictEqual(logCalls, 0, '测试打印不写打印日志')
    assert.strictEqual(serialBumps, 0, '测试打印不推进序列号')
    assert.match(lastStatus, /测试打印不计日志、不推进序列号/)
    console.log('  ✓ 测试打印不写日志且不推进序列号')
    passed++
  } finally {
    if (originalWindow === undefined) delete (globalThis as { window?: unknown }).window
    else (globalThis as { window?: unknown }).window = originalWindow
  }
  check('打印日志 CSV 表头覆盖 LabelShop 保存项目', () => {
    assert.deepStrictEqual([...PRINT_LOG_CSV_HEADERS], ['时间', '模板', '打印方式', '数量', '单签拷贝', '计划标签张数', '已发送标签张数', '状态', '测试打印', '打印机'])
  })
  check('旋转180度输出只改变打印副本方向', () => {
    const source = { ...sampleDoc(), orientation: 90 as const }
    assert.strictEqual(rotateDocumentForPrint(source, true).orientation, 270)
    assert.strictEqual(source.orientation, 90)
  })
}

void runPrintDialogSideEffectChecks()
  .then(() => console.log('\n共通过 ' + passed + ' 项断言组。'))
  .catch((error) => {
    console.error('打印执行回归失败：', error)
    process.exitCode = 1
  })
