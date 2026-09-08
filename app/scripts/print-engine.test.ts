// ---------- 指令引擎单测（Node 环境，无硬件依赖） ----------
// 运行：npx esbuild scripts/print-engine.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_t.cjs && node scripts/_t.cjs
import assert from 'node:assert'
import type { Dataset, LabelDoc, PrinterConfig } from '../src/shared/model'
import { resolveSourceText } from '../src/shared/model'
import { buildCommands } from '../src/shared/print/engine'

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
    assert.ok(t.includes('PRINT 2,0'), 'PRINT 2,0')
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
    assert.ok(t.includes('! 0 200 200 203 1'), '初始化行')
    assert.ok(t.includes('PAGE-WIDTH 480'), '页宽')
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
  const r = buildCommands(doc, printer(), { count: 2, copy: 1, title: '测试', datasets: {} })
  check('脚本数据源返回逐张值', () => {
    assert.ok(r.text.includes('"S-1"'), 'S-1')
    assert.ok(r.text.includes('"S-2"'), 'S-2')
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
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {} })
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
  check('CPCL 椭圆：ELLIPSE 指令', () => {
    assert.ok(rC.text.includes('ELLIPSE '), 'ELLIPSE')
  })
}

// ---------- 脚本共享变量 ----------
{
  const doc = sampleDoc()
  doc.objects[1] = { ...doc.objects[1], source: { kind: 'script', code: 'function OnGetData(){ return "订单号-001"; }', sharedName: 'ORD' } } as LabelDoc['objects'][number]
  doc.objects.push({ id: 'x1', type: 'text', x: 4, y: 34, w: 52, h: 4, rotation: 0, fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000', source: { kind: 'script', code: 'function OnGetData(){ return "批次:" + ORD; }' } })
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {} })
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
  check('TSPL 图片嵌入：PUTBMP + 二进制分段', () => {
    assert.ok(r.text.includes('PUTBMP'), 'PUTBMP 指令')
    const bins = r.segments.filter((s) => s.type === 'bin')
    assert.strictEqual(bins.length, 1, '一个二进制段')
    const b = (bins[0] as { type: 'bin'; data: Uint8Array }).data
    assert.strictEqual(String.fromCharCode(b[0], b[1]), 'BM', 'BMP 文件头')
  })
  const rz = buildCommands(doc, printer({ driver: 'zpl' }), { count: 1, copy: 1, title: '测试', datasets: {}, images: { img1: tinyMono() } })
  check('ZPL 图片嵌入：^GFA 十六进制', () => {
    assert.ok(rz.text.includes('^GFA'), '^GFA')
    assert.ok(rz.text.includes('ff'), '十六进制数据')
  })
}

{
  // 含中文文本 → 逐张位图（TSPL PUTBMP + bin / ZPL ^GFA）
  const doc = sampleDoc()
  doc.objects[1] = { ...doc.objects[1], source: { kind: 'constant', value: '中文标签' } } as LabelDoc['objects'][number]
  const byLabel = [{ [doc.objects[1].id]: tinyMono() }]
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {}, imagesByLabel: byLabel })
  check('TSPL 中文位图：PUTBMP 嵌入而非 TEXT', () => {
    assert.ok(r.text.includes('PUTBMP'), 'PUTBMP')
    assert.ok(!r.text.includes('TEXT '), '不输出 TEXT 指令')
    assert.ok(r.segments.some((s) => s.type === 'bin'), '含二进制段')
  })
  const rz = buildCommands(doc, printer({ driver: 'zpl' }), { count: 1, copy: 1, title: '测试', datasets: {}, imagesByLabel: byLabel })
  check('ZPL 中文位图：^GFA 嵌入', () => {
    assert.ok(rz.text.includes('^GFA'), '^GFA')
  })
}

{
  // RFID：TSPL RFID;EPC + 锁定；ZPL ^RFW / ^RFL
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
  const r = buildCommands(doc, printer(), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('TSPL RFID：写入 EPC + LOCK', () => {
    assert.ok(r.text.includes('RFID;EPC,E2001001'), 'RFID;EPC + 序列号值')
    assert.ok(r.text.includes('RFID;LOCK,A1B2C3D4,00000000,EPC'), 'LOCK 指令')
  })
  const rz = buildCommands(doc, printer({ driver: 'zpl' }), { count: 1, copy: 1, title: '测试', datasets: {} })
  check('ZPL RFID：^RFW 写入 + ^RFL 锁定', () => {
    assert.ok(rz.text.includes('^RFW,H,EPC,E2001001'), '^RFW')
    assert.ok(rz.text.includes('^RFL,H,A1B2C3D4'), '^RFL')
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

// ---------- 授权密钥往返（HMAC + 机器锁定） ----------
{
  const { generateLicenseKey, verifyLicenseKey, machineId } = require('../src/main/license')
  const mid = machineId()
  const key = generateLicenseKey(mid, 'pro', 365, 'demo@user')
  const v = verifyLicenseKey(key, mid)
  check('授权密钥：生成→校验往返成功且版本为 pro', () => {
    assert.ok(v.ok, '校验通过，实际: ' + JSON.stringify(v))
    assert.strictEqual(v.edition, 'pro')
  })
  check('授权密钥：机器不匹配则拒绝', () => {
    const v2 = verifyLicenseKey(key, 'deadbeefdeadbeef')
    assert.ok(!v2.ok, '应拒绝')
  })
  check('授权密钥：篡改签名被拒绝', () => {
    const tampered = key.slice(0, key.length - 1) + (key.endsWith('A') ? 'B' : 'A')
    const v3 = verifyLicenseKey(tampered, mid)
    assert.ok(!v3.ok, '应拒绝')
  })
}

// ---------- ODBC 连接串构造 ----------
{
  const { buildConnectionString } = require('../src/main/db')
  const sql = buildConnectionString({ id: '1', name: 'x', driver: 'sqlserver', server: 'SRV\\INST', database: 'inv', user: 'sa', password: 'p@ss' })
  check('ODBC：SQL Server 连接串包含驱动与库', () => {
    assert.ok(sql.includes('Driver={ODBC Driver 17 for SQL Server}'), sql)
    assert.ok(sql.includes('Server=SRV\\INST'), sql)
    assert.ok(sql.includes('Database=inv'), sql)
    assert.ok(sql.includes('Pwd=p@ss'), sql)
  })
  const mysql = buildConnectionString({ id: '1', name: 'x', driver: 'mysql', server: 'db', database: 'app', user: 'root', password: 'pw' })
  check('ODBC：MySQL 连接串', () => {
    assert.ok(mysql.includes('Driver={MySQL ODBC 8.0 Unicode Driver}'), mysql)
  })
  const dsn = buildConnectionString({ id: '1', name: 'x', driver: 'dsn', dsn: 'MYDSN', user: 'u', password: 'p' })
  check('ODBC：DSN 连接串', () => {
    assert.ok(dsn.startsWith('DSN=MYDSN'), dsn)
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

// ---------- resolveSourceText 单元 ----------
{
  check('序列号解析（按 labelIndex）', () => {
    const s = { kind: 'serial', prefix: 'SN-', start: 1001, step: 1, digits: 4, current: 5 } as const
    assert.strictEqual(resolveSourceText(s, { labelIndex: 1 } as never), 'SN-0005')
    assert.strictEqual(resolveSourceText(s, { labelIndex: 3 } as never), 'SN-0007')
  })
  check('日期/时间格式化', () => {
    const d = { kind: 'date', format: 'yyyy-MM-dd' } as const
    const out = resolveSourceText(d, undefined as never)
    assert.match(out, /^\d{4}-\d{2}-\d{2}$/, '日期格式')
  })
}

console.log('\n共通过 ' + passed + ' 项断言组。')
