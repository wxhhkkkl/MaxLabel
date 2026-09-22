/**
 * round-80：B1 簇「条码码制特性总表」（帮助 `barcode_summary.html` + 各码制特殊选项专页）。
 *
 * 覆盖矩阵 B-115 ～ B-137：每种码制的字符集 / 来源 / 符号结构 / 容量 / 校验与纠错 /
 * 识读特性 / 特殊选项，逐条与帮助原文对齐；并验证 25 码特殊选项分组
 * （Code25、ITF25、Matrix25、中国邮政码共用）真的作用到条码输出。
 */
import assert from 'node:assert'
import {
  BARCODE_CHARSETS,
  barcodeCharsetName,
  barcodeSpecRows,
  barcodeSpecialOptions,
  usesTwentyFiveOptions,
  validateBarcodeContent
} from '../src/shared/domain/barcodeCharset'
import { resolveBarcode, toBwipOptions } from '../src/renderer/src/editor/barcode'
import { BARCODE_TYPES } from '../src/renderer/src/editor/barcodeTypes'
import {
  DEFAULT_X_SIZE_MIL,
  PDF417_COLUMN_OPTIONS,
  PDF417_ROW_OPTIONS,
  X_SIZE_MIL_OPTION_LABELS,
  xSizeMilFromOptionLabel,
  xSizeMilOptionLabel
} from '../src/renderer/src/dialogs/barcodeSizeFields'

function check(name: string, fn: () => void): void {
  fn()
  console.log(`ok - ${name}`)
}

/** 取某码制「码制特性」面板里某一行的正文（面板行与帮助条目一一对应） */
function specValue(symbology: string, key: string): string {
  return barcodeSpecRows(symbology).find((r) => r.key === key)?.value ?? ''
}

// —— B-115 交叉 25 码与 ITF 14 的特性 ——
check('B-115 交叉25码：识读率高、一维码中密度较高、窄条宽度更宽可远距离读取', () => {
  const spec = BARCODE_CHARSETS.interleaved2of5
  assert.match(spec.reading ?? '', /识读率高/)
  assert.match(spec.reading ?? '', /密度较高/)
  assert.match(spec.structure ?? '', /窄条宽度更宽/)
  assert.match(spec.structure ?? '', /远距离读取/)
})

check('B-115 ITF14 字符集与交插二五码相同，由保护框/空白区/条码字符组成', () => {
  assert.strictEqual(BARCODE_CHARSETS.itf14.charset, '条码字符集与交插二五码相同')
  const structure = BARCODE_CHARSETS.itf14.structure ?? ''
  assert.match(structure, /连续型、定长、自带校验功能/)
  assert.match(structure, /矩形保护框/)
  assert.match(structure, /左侧空白区/)
  assert.match(structure, /右侧空白区/)
  assert.match(BARCODE_CHARSETS.itf14.reading ?? '', /非零售的商品/)
})

// —— B-116 Codabar 字符集与校验位 ——
check('B-116 Codabar 可表示 0-9、$、+、- 与只能作起始/终止符的 a-d', () => {
  const spec = BARCODE_CHARSETS.codabar
  assert.match(spec.charset ?? '', /数字 0-9/)
  assert.match(spec.charset ?? '', /只能用作起始\/终止符的 a、b、c、d/)
  assert.strictEqual(spec.check, '可变长度，没有校验位')
  assert.match(spec.structure ?? '', /4 条 3 空/)
  assert.match(spec.structure ?? '', /空白区比窄条宽 10 倍/)
})

check('B-116 Codabar 的 a-d 只是起始/终止符，写进数据要报错', () => {
  const r = validateBarcodeContent('codabar', 'a1234b')
  assert.strictEqual(r.ok, false)
  assert.match(r.message, /只能用作起始符\/终止符/)
  assert.strictEqual(validateBarcodeContent('codabar', '1234-56$+').ok, true)
})

// —— B-117 PDF417 模块结构与纠错 ——
check('B-117 PDF417 每符号字符 4 条 4 空、总模块数一定为 17', () => {
  const spec = BARCODE_CHARSETS.pdf417
  assert.match(spec.structure ?? '', /4 个条和 4 个空/)
  assert.match(spec.structure ?? '', /总模块数一定为 17/)
  assert.match(spec.capacity ?? '', /医院、驾驶证、物料管理、货物运输/)
  assert.match(spec.check ?? '', /错误纠正能使条形码正确解码/)
})

// —— B-118 QR Code 结构与容量 ——
check('B-118 QR 码为正方形、3 个角落有「回」字定位图案，可放 1817 汉字/7089 数字/4200 字母', () => {
  const spec = BARCODE_CHARSETS.qrcode
  assert.match(spec.structure ?? '', /呈正方形/)
  assert.match(spec.structure ?? '', /3 个角落/)
  assert.match(spec.structure ?? '', /回/)
  assert.match(spec.capacity ?? '', /1817 个汉字/)
  assert.match(spec.capacity ?? '', /7089 个数字/)
  assert.match(spec.capacity ?? '', /4200 个英文字母/)
  assert.match(spec.origin ?? '', /Denso 公司于 1994 年 9 月/)
})

// —— B-119 Data Matrix 字符集与尺寸 ——
check('B-119 Data Matrix 可编码 256 个字元、尺寸 14–0.0002 平方英寸、只读 20% 即可辨读', () => {
  const spec = BARCODE_CHARSETS.datamatrix
  assert.match(spec.charset ?? '', /共 256 个字元/)
  assert.match(spec.structure ?? '', /14 平方英寸/)
  assert.match(spec.structure ?? '', /0.0002 平方英寸/)
  assert.match(spec.reading ?? '', /20% 即可精确辨读/)
  assert.match(spec.capacity ?? '', /2,000 bytes/)
})

// —— B-120 汉信码容量 ——
check('B-120 汉信码容量：7829 数字 / 4350 ASCII / 2174 汉字 / 3262 字节', () => {
  const capacity = BARCODE_CHARSETS.hanxin.capacity ?? ''
  assert.match(capacity, /7829 个数字/)
  assert.match(capacity, /4350 个 ASCII 字符/)
  assert.match(capacity, /2174 个汉字/)
  assert.match(capacity, /3262 个 8 位字节信息/)
  assert.match(BARCODE_CHARSETS.hanxin.origin ?? '', /第一个制定了国家标准/)
})

// —— B-121 Code 39 特殊选项（启始符/终止符 + 校验字符四档）——
check('B-121 Code 39 特殊选项含「启始符/终止符」与四档校验字符，并标注 GB12908-2002', () => {
  const options = barcodeSpecialOptions('code39')
  assert.strictEqual(options.length, 2)
  assert.match(options[0], /启始符\/终止符/)
  assert.match(options[1], /无 \/ 模10校验 \/ 模43校验 \/ 图书馆用校验码/)
  assert.match(BARCODE_CHARSETS.code39.origin ?? '', /Intermec 公司于 1974 年/)
  assert.match(BARCODE_CHARSETS.code39.origin ?? '', /GB12908-2002/)
})

// —— B-122 Code 128 三个字符集与 UCC/EAN-128 ——
check('B-122 Code 128 三个字符集各 102 个字符，A/B/C 的范围与帮助一致', () => {
  const structure = BARCODE_CHARSETS.code128.structure ?? ''
  assert.match(structure, /每个 102 个字符/)
  assert.match(structure, /字符集A 为全 ASCII 除 26 个小写字母/)
  assert.match(structure, /字符集B 为全 ASCII 除 26 个控制字符/)
  assert.match(structure, /字符集C 为双密度数字/)
  assert.match(structure, /00 到 99/)
})

check('B-122 Code 128 特殊选项含 GS1/EAN-128 与字符集（默认自动、手动 ^A^B^C）', () => {
  const options = barcodeSpecialOptions('code128')
  assert.strictEqual(options.length, 2)
  assert.match(options[0], /GS1\/EAN-128/)
  assert.match(options[0], /\^1/)
  assert.match(options[1], /自动 \/ 字符集A \/ 字符集B \/ 字符集C \/ 手动设置/)
  assert.match(options[1], /\^A \^B \^C/)
  assert.match(BARCODE_CHARSETS.code128.note ?? '', /默认设置为「自动」/)
})

// —— B-123 Code 93 没有特殊选项 ——
check('B-123 Code 93 没有相关的特殊选项', () => {
  assert.strictEqual(barcodeCharsetName('code93'), 'Code 93')
  assert.deepStrictEqual(barcodeSpecialOptions('code93'), [])
  assert.match(BARCODE_CHARSETS.code93.note ?? '', /93码没有相关的特殊选项/)
})

// —— B-124 Codabar 特殊选项（校验字符 + 起始/终止符 a-d）——
check('B-124 Codabar 特殊选项：校验字符三档 + 起始符/终止符 a-d', () => {
  const options = barcodeSpecialOptions('codabar')
  assert.strictEqual(options.length, 3)
  assert.match(options[0], /无 \/ 模10校验 \/ 图书馆用校验码/)
  assert.match(options[1], /起始符/)
  assert.match(options[2], /终止符/)
})

// —— B-125 / B-126 / B-127 / B-128 EAN/UPC ——
check('B-125 EAN-13 特殊选项「附加条码」可加 2 位或 5 位附加码', () => {
  const options = barcodeSpecialOptions('ean13')
  assert.strictEqual(options.length, 1)
  assert.match(options[0], /附加条码/)
  assert.match(options[0], /2 位附加码 \/ 5 位附加码/)
  assert.match(BARCODE_CHARSETS.ean13.note ?? '', /690-699/)
})

check('B-126 EAN-8 为 8 位缩短版并同样支持附加码', () => {
  assert.match(BARCODE_CHARSETS.ean8.charset ?? '', /共 8 位/)
  assert.match(BARCODE_CHARSETS.ean8.origin ?? '', /缩短版/)
  assert.match(barcodeSpecialOptions('ean8')[0] ?? '', /附加条码/)
})

check('B-127 UPC-A 为 12 位标准版、主要用于美国和加拿大地区', () => {
  assert.match(BARCODE_CHARSETS.upca.charset ?? '', /共 12 位/)
  assert.match(BARCODE_CHARSETS.upca.origin ?? '', /美国和加拿大地区/)
  assert.match(BARCODE_CHARSETS.upca.origin ?? '', /标准版/)
})

check('B-128 UPC-E 为 7 位缩短版并同样支持附加码', () => {
  assert.match(BARCODE_CHARSETS.upce.charset ?? '', /共 7 位/)
  assert.match(BARCODE_CHARSETS.upce.origin ?? '', /缩短版/)
  assert.match(barcodeSpecialOptions('upce')[0] ?? '', /附加条码/)
})

// —— B-129 ITF14 检验字符与保护框 ——
check('B-129 ITF14 特殊选项含「检验字符」与「保护框」，保护框按 X 尺寸比值设置', () => {
  const options = barcodeSpecialOptions('itf14')
  assert.strictEqual(options.length, 2)
  assert.match(options[0], /检验字符/)
  assert.match(options[0], /建议总是选中/)
  assert.match(options[1], /保护框/)
  assert.match(options[1], /粗细与空白区/)
  assert.match(BARCODE_CHARSETS.itf14.note ?? '', /保护框用来防止打印压力直接集中在条码上/)
})

// —— B-130 / B-131 / B-132 25 码特殊选项分组 ——
check('B-130 交叉25 码特殊选项为「校验字符」，且签赋LabelShop 使用模10校验字符', () => {
  const options = barcodeSpecialOptions('interleaved2of5')
  assert.strictEqual(options.length, 1)
  assert.match(options[0], /校验字符/)
  assert.match(BARCODE_CHARSETS.interleaved2of5.note ?? '', /模10校验字符/)
  assert.match(BARCODE_CHARSETS.interleaved2of5.note ?? '', /需要用户程序自行检验/)
})

check('B-131/B-132 Code25、Matrix25、中国邮政码与 ITF25 共用同一组 25 码特殊选项', () => {
  for (const key of ['industrial2of5', 'matrix2of5', 'datalogic2of5']) {
    assert.strictEqual(usesTwentyFiveOptions(key), true, `${key} 应归入 25 码特殊选项分组`)
    assert.deepStrictEqual(barcodeSpecialOptions(key), barcodeSpecialOptions('interleaved2of5'))
  }
  assert.strictEqual(barcodeCharsetName('industrial2of5'), 'Code 25 码')
  assert.strictEqual(barcodeCharsetName('matrix2of5'), 'Matrix 25 码')
  assert.strictEqual(barcodeCharsetName('datalogic2of5'), 'China Post 中国邮政码')
  assert.strictEqual(usesTwentyFiveOptions('code39'), false)
})

check('B-131 25 码「校验字符」勾选后模10校验字符附加到条码数据（Code25/Matrix25/中国邮政码同样生效）', () => {
  for (const key of ['interleaved2of5', 'industrial2of5', 'matrix2of5', 'datalogic2of5']) {
    const off = resolveBarcode(key, '1234567', { itf25Check: false })
    const on = resolveBarcode(key, '1234567', { itf25Check: true })
    assert.strictEqual(off.text, '1234567', `${key} 未勾选时不应添加校验字符`)
    assert.strictEqual(on.text.length, 8, `${key} 勾选后应在末尾附加 1 位校验字符`)
    assert.strictEqual(on.text.slice(0, 7), '1234567')
  }
})

// —— B-133 RSS / GS1 DataBar ——
check('B-133 RSS 特殊选项：保持 GS1 规格 / 类型五档 / 分隔符', () => {
  const options = barcodeSpecialOptions('databaromni')
  assert.strictEqual(options.length, 3)
  assert.match(options[0], /保持 GS1 规格/)
  assert.match(options[1], /全向式 \/ 截断式 \/ 层排式 \/ 全向层排式 \/ 限定式/)
  assert.match(options[2], /分隔符尺寸与 X 尺寸的比值/)
})

check('B-133 RSS 类型选择后映射到对应的 GS1 DataBar 变体码制', () => {
  const cases: Array<[string, string]> = [
    ['truncated', 'databartruncated'],
    ['stacked', 'databarstacked'],
    ['stackedomni', 'databarstackedomni'],
    ['limited', 'databarlimited']
  ]
  for (const [type, bcid] of cases) {
    assert.strictEqual(resolveBarcode('databaromni', '0123456789', { rssType: type as never }).bcid, bcid)
  }
  assert.strictEqual(resolveBarcode('databaromni', '0123456789', { rssType: 'omni' }).bcid, 'databaromni')
})

// —— B-134 PDF417 特殊选项 ——
check('B-134 PDF417 特殊选项：截短型 / 纠错级别 / 层数 / 列数（1 到 30）', () => {
  const options = barcodeSpecialOptions('pdf417')
  assert.strictEqual(options.length, 4)
  assert.match(options[0], /截短型 PDF417/)
  assert.match(options[1], /纠错级别/)
  assert.match(options[2], /层数/)
  assert.match(options[3], /列数/)
  assert.match(options[3], /1 到 30/)
  assert.match(BARCODE_CHARSETS.pdf417.reading ?? '', /X 尺寸的三倍/)
  assert.match(BARCODE_CHARSETS.pdf417.reading ?? '', /2 : 1/)
})

// round-129：真机同一个「尺寸」组里的三个**下拉**（`probe-sym-pdf417-values.txt` / `-combos.txt`）——
// `X 尺寸(&X):` 61 项、`层数(&R):` 89 项、`列数(&C):` 31 项；复刻版此前是三个自由数字框。
check('B-134a X尺寸(&X): 为真机 61 项下拉（60 个 mil 档 + 固定宽度），默认第 6 项 10.00 mil', () => {
  assert.strictEqual(X_SIZE_MIL_OPTION_LABELS.length, 61)
  assert.strictEqual(X_SIZE_MIL_OPTION_LABELS[0], '1.67 mil')
  assert.strictEqual(X_SIZE_MIL_OPTION_LABELS[5], '10.00 mil')
  assert.strictEqual(X_SIZE_MIL_OPTION_LABELS[59], '100.00 mil')
  assert.strictEqual(X_SIZE_MIL_OPTION_LABELS[60], '固定宽度')
  assert.strictEqual(DEFAULT_X_SIZE_MIL, 10)
  // 默认档与「新建条码」的模型默认值一致（xSizeMil 10 / xSizeMm 0.254）
  assert.strictEqual(xSizeMilOptionLabel(10, false), '10.00 mil')
  assert.strictEqual(xSizeMilFromOptionLabel('10.00 mil'), 10)
  assert.strictEqual(xSizeMilFromOptionLabel('固定宽度'), undefined)
})

check('B-134a 层数(&R): 89 项（自动 + 3…90）、列数(&C): 31 项（自动 + 1…30），默认均为自动', () => {
  assert.strictEqual(PDF417_ROW_OPTIONS.length, 89)
  assert.deepStrictEqual(PDF417_ROW_OPTIONS.slice(0, 4), ['自动', '3', '4', '5'])
  assert.strictEqual(PDF417_ROW_OPTIONS[PDF417_ROW_OPTIONS.length - 1], '90')
  assert.strictEqual(PDF417_COLUMN_OPTIONS.length, 31)
  assert.deepStrictEqual(PDF417_COLUMN_OPTIONS.slice(0, 3), ['自动', '1', '2'])
  assert.strictEqual(PDF417_COLUMN_OPTIONS[PDF417_COLUMN_OPTIONS.length - 1], '30')
})

check('B-134a 层数/列数真正进入编码：自动=不设值，选定值转发 bwip-js 的 rows/columns', () => {
  const auto = toBwipOptions('pdf417', '1234567890', { barcodeOptions: {} })
  assert.strictEqual(auto.rows, undefined)
  assert.strictEqual(auto.columns, undefined)
  const fixed = toBwipOptions('pdf417', '1234567890', { barcodeOptions: { pdf417Rows: 12, pdf417Columns: 5 } })
  assert.strictEqual(fixed.rows, 12)
  assert.strictEqual(fixed.columns, 5)
  // 其它码制不转发（真机只有 PDF 417 有这两个下拉）
  const qr = toBwipOptions('qrcode', 'ABC', { barcodeOptions: { pdf417Rows: 12, pdf417Columns: 5 } })
  assert.strictEqual(qr.rows, undefined)
  assert.strictEqual(qr.columns, undefined)
})

check('B-134a X尺寸选「固定宽度」时不设 xsize（由对象宽度决定），选 mil 档时按 mil→mm 转发', () => {
  const fixedWidth = toBwipOptions('code128', '1234567890', { barcodeOptions: { xSizeFixed: true, xSizeMil: 10, xSizeMm: 0.254 } })
  assert.strictEqual(fixedWidth.xsize, undefined)
  const mil = toBwipOptions('code128', '1234567890', { barcodeOptions: { xSizeFixed: false, xSizeMil: 20, xSizeMm: 20 * 0.0254 } })
  assert.ok(Math.abs((mil.xsize as number) - 0.508) < 1e-9)
})

// —— B-135 QR Code 特殊选项 ——
check('B-135 QR Code 特殊选项：GS1 模式 / 纠错级别 / 字符编码 / 图标区域', () => {
  const options = barcodeSpecialOptions('qrcode')
  assert.strictEqual(options.length, 4)
  assert.match(options[0], /GS1 模式/)
  assert.match(options[1], /纠错级别/)
  assert.match(options[2], /字符编码：ANSI \/ UTF-8/)
  assert.match(options[3], /图标区域/)
})

// —— B-136 DataMatrix 特殊选项 ——
check('B-136 DataMatrix 特殊选项：GS1 模式 / 纠错级别（仅 ECC200）/ 字符编码', () => {
  const options = barcodeSpecialOptions('datamatrix')
  assert.strictEqual(options.length, 3)
  assert.match(options[0], /GS1 模式/)
  assert.match(options[1], /纠错级别/)
  assert.match(options[1], /只支持 ECC200/)
  assert.match(options[2], /字符编码：ANSI \/ UTF-8/)
})

// —— B-137 汉信码特殊选项 ——
check('B-137 汉信码特殊选项：纠错级别 / 字符编码 / 版本（建议自动）', () => {
  const options = barcodeSpecialOptions('hanxin')
  assert.strictEqual(options.length, 3)
  assert.match(options[0], /纠错级别/)
  assert.match(options[1], /字符编码：ANSI \/ UTF-8/)
  assert.match(options[2], /版本/)
  assert.match(options[2], /建议选择自动/)
})

// —— 覆盖度：真机「条码符号类型(码制)」下拉的 20 项全部登记，特性面板只输出帮助写明了的字段 ——
check('20 种码制（真机下拉全量）全部登记在特性总表里，且特性面板只输出帮助写明了的字段', () => {
  // 顺序与名称照抄真机下拉（round-57 用 Probe-LabelShopCombos 的 CB_GETLBTEXT 读回）
  assert.deepStrictEqual(BARCODE_TYPES.map((t) => t.label), [
    'Code 39', 'Code 128', 'EAN-13', 'Interleaved 25', 'Code 93', 'UPC-A', 'EAN-8', 'UPC-E', 'CodaBar',
    'Code 25', 'Matrix 25', 'China Post', 'Pharmacode', 'ITF 14', 'GS1 RSS 条码', 'PDF 417', 'QR Code',
    'Data Matrix', '汉信码', 'Micro QR'
  ])
  const SYMBOLOGIES = [
    'code39', 'code128', 'ean13', 'interleaved2of5', 'code93', 'upca', 'ean8', 'upce',
    'codabar', 'industrial2of5', 'matrix2of5', 'datalogic2of5', 'pharmacode', 'itf14', 'databaromni',
    'pdf417', 'qrcode', 'datamatrix', 'hanxin', 'microqrcode'
  ]
  assert.deepStrictEqual(BARCODE_TYPES.map((t) => t.bcid), SYMBOLOGIES)
  // code93 / pharmacode / microqrcode 是帮助未单列特殊选项的码制（后两个连帮助页都没有，
  // 只有真机下拉能证明存在），故允许特殊选项为空。
  const NO_OPTION_PAGES = ['code93', 'pharmacode', 'microqrcode']
  for (const key of SYMBOLOGIES) {
    assert.ok(BARCODE_CHARSETS[key], `${key} 应登记在 BARCODE_CHARSETS`)
    assert.ok(barcodeCharsetName(key).length > 0)
    assert.ok(barcodeSpecialOptions(key).length > 0 || NO_OPTION_PAGES.includes(key), `${key} 应有特殊选项或帮助写明没有`)
  }
  assert.ok(specValue('qrcode', 'capacity').includes('1817 个汉字'))
  assert.strictEqual(specValue('qrcode', 'charset'), '', '帮助未写 QR 的字符集，不应凭空补')
  assert.ok(specValue('ean13', 'structure').includes('无含义、定长、纯数字'))
  assert.strictEqual(barcodeSpecRows('unknown-symbology').length, 0)
})
