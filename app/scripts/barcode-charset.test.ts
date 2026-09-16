import assert from 'node:assert'
import {
  BARCODE_CHARSETS,
  barcodeCharsetLabel,
  barcodeCharsetName,
  eanCheckDigit,
  validateBarcodeContent
} from '../src/shared/domain/barcodeCharset'

function check(name: string, fn: () => void): void {
  fn()
  console.log(`ok - ${name}`)
}

// —— B-112 商品条码 EAN/UPC 的位数与校验字符（帮助 barcode_summary.html）——
check('B-112 EAN-13 是 13 位、EAN-8 是 8 位、UPC-A 是 12 位、UPC-E 是 7 位', () => {
  assert.strictEqual(BARCODE_CHARSETS.ean13.digits?.totalChars, 13)
  assert.strictEqual(BARCODE_CHARSETS.ean13.digits?.dataChars, 12)
  assert.strictEqual(BARCODE_CHARSETS.ean8.digits?.totalChars, 8)
  assert.strictEqual(BARCODE_CHARSETS.ean8.digits?.dataChars, 7)
  assert.strictEqual(BARCODE_CHARSETS.upca.digits?.totalChars, 12)
  assert.strictEqual(BARCODE_CHARSETS.upca.digits?.dataChars, 11)
  assert.strictEqual(BARCODE_CHARSETS.upce.digits?.totalChars, 7)
  for (const key of ['ean13', 'ean8', 'upca', 'upce']) {
    assert.strictEqual(BARCODE_CHARSETS[key].digitsOnly, true, `${key} 应为纯数字定长码制`)
  }
})

check('B-112 中国商品条码 690-699 开头、13 位带校验字符可通过校验', () => {
  const data = '690123456789'
  const full = data + eanCheckDigit(data)
  assert.strictEqual(validateBarcodeContent('ean13', data).ok, true, '12 位数据应可自动补校验字符')
  assert.strictEqual(validateBarcodeContent('ean13', full).ok, true, `${full} 应通过校验`)
})

check('B-112 校验字符错误与位数错误都要给出提示', () => {
  const bad = validateBarcodeContent('ean13', '6901234567890')
  assert.strictEqual(bad.ok, false)
  assert.match(bad.message, /校验字符/)
  const short = validateBarcodeContent('ean8', '690')
  assert.strictEqual(short.ok, false)
  assert.match(short.message, /需要 7 位数据/)
  const alpha = validateBarcodeContent('upca', '69012ABC')
  assert.strictEqual(alpha.ok, false)
  assert.match(alpha.message, /只能使用数字/)
})

// —— B-113 Code 39 字符集与字符数 ——
check('B-113 Code 39 可表示 44 个符号且内容合法时通过', () => {
  const label = barcodeCharsetLabel('code39')
  assert.match(label, /44 个符号/)
  assert.strictEqual(validateBarcodeContent('code39', 'ABC-1234.5').ok, true)
  assert.strictEqual(validateBarcodeContent('code39', 'A B$/+%').ok, true)
})

check('B-113 Code 39 的「*」仅作启始符和终止符，出现在数据里要报错', () => {
  const r = validateBarcodeContent('code39', '*ABC*')
  assert.strictEqual(r.ok, false)
  assert.match(r.message, /启始符和终止符/)
})

check('B-113 Code 39 数据字符集不含小写以外的其它符号（如 @）', () => {
  const r = validateBarcodeContent('code39', 'ABC@123')
  assert.strictEqual(r.ok, false)
  assert.match(r.message, /不支持字符「@」/)
})

// —— B-114 Code 128 字符集与编码密度 ——
check('B-114 Code 128 可表示 ASCII 0 到 ASCII 127 共 128 个字符', () => {
  assert.match(barcodeCharsetLabel('code128'), /ASCII 0 – ASCII 127 共 128 个字符/)
  assert.strictEqual(validateBarcodeContent('code128', 'ABCabc0123!@#$%^&*()').ok, true)
  const ctrl = String.fromCharCode(0) + 'AB'
  assert.strictEqual(validateBarcodeContent('code128', ctrl).ok, true, 'ASCII 0 应属合法范围')
})

check('B-114 Code 128 超出 ASCII 127 的字符要报错', () => {
  const r = validateBarcodeContent('code128', '中文ABC')
  assert.strictEqual(r.ok, false)
  assert.match(r.message, /ASCII 0 – ASCII 127/)
})

check('B-114 帮助原文：Code 128 比 Code 39 编码密度更高，两者码制名与字符集描述并存', () => {
  assert.strictEqual(barcodeCharsetName('code128'), 'Code 128')
  assert.strictEqual(barcodeCharsetName('code39'), 'Code 39')
  assert.notStrictEqual(BARCODE_CHARSETS.code128.charset, BARCODE_CHARSETS.code39.charset)
})

// —— 其它码制不应被误伤 ——
check('未登记的码制不做内容校验（QR/PDF417/DataMatrix 等）', () => {
  for (const key of ['qrcode', 'pdf417', 'datamatrix', 'interleaved2of5', 'codabar', 'itf14', 'hanxin']) {
    assert.strictEqual(validateBarcodeContent(key, '任意中文@#$`~').ok, true, `${key} 不应被校验拦截`)
  }
  assert.strictEqual(barcodeCharsetLabel('qrcode'), '')
})

check('空内容不报错（未输入时不打扰）', () => {
  for (const key of Object.keys(BARCODE_CHARSETS)) {
    assert.strictEqual(validateBarcodeContent(key, '   ').ok, true)
  }
})
