/* 验证条码各码制专属选项 → bwip-js 参数映射 */
const path = require('path')
const esbuild = require(path.join(__dirname, '../node_modules/esbuild'))
esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/renderer/src/editor/barcode.ts')], bundle: true, format: 'cjs', outfile: path.join(__dirname, '_barcode_test.cjs'), platform: 'node' })
const m = require('./_barcode_test.cjs')

function check(name, actual, expect) {
  const ok = JSON.stringify(actual) === JSON.stringify(expect)
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' => ' + JSON.stringify(actual) + (ok ? '' : ' (expect ' + JSON.stringify(expect) + ')'))
}

check('code128 gs1', m.toBwipOptions('code128', '123', { barcodeOptions: { gs1: true } }), { gs1: true })
check('code128 manual parsefnc', m.toBwipOptions('code128', '123', { barcodeOptions: { charset: 'manual' } }), { parsefnc: true })
check('code128 auto none', m.toBwipOptions('code128', '123', { barcodeOptions: { charset: 'auto' } }), {})
check('qr eclevel', m.toBwipOptions('qrcode', 'x', { barcodeOptions: { eclevel: 'H' } }), { eclevel: 'H' })
check('pdf417 eclevel', m.toBwipOptions('pdf417', 'x', { barcodeOptions: { eclevel: '4' } }), { eclevel: '4' })
check('hanxin eclevel', m.toBwipOptions('hanxin', 'x', { barcodeOptions: { eclevel: 'L3' } }), { eclevel: 'L3' })
check('datamatrix gs1+ecc', m.toBwipOptions('datamatrix', 'x', { barcodeOptions: { gs1: true, eclevel: 'H' } }), { gs1: true, eclevel: 'S' })
check('utf8 parse', m.toBwipOptions('qrcode', '中文', { barcodeOptions: { encoding: 'utf8' } }), { parse: true, alttext: '中文' })
check('code39 mod43', m.toBwipOptions('code39', 'AB', { barcodeOptions: { code39Check: 'mod43' } }), { includecheck: true, includecheckintext: true })
check('no options', m.toBwipOptions('ean13', '123', {}), {})

// resolveBarcode
check('rss truncated map', m.resolveBarcode('databaromni', '01', { rssType: 'truncated' }).bcid, 'databartruncated')
check('rss stackedomni map', m.resolveBarcode('databaromni', '01', { rssType: 'stackedomni' }).bcid, 'databarstackedomni')
check('rss omni default', m.resolveBarcode('databaromni', '01', {}).bcid, 'databaromni')
check('codabar start/stop', m.resolveBarcode('codabar', '123', { codabarStart: 'a', codabarStop: 'd' }).text, 'A123D')
const cob = m.resolveBarcode('codabar', '123456', { codabarStart: 'a', codabarStop: 'b', codabarCheck: 'mod10' }).text
check('codabar mod10', cob, 'A1234565B')
const itf = m.resolveBarcode('interleaved2of5', '123456', { itf25Check: true }).text
check('itf25 check appends', itf, '1234565')
check('itf25 no check', m.resolveBarcode('interleaved2of5', '123456', {}).text, '123456')
const c39 = m.resolveBarcode('code39', '12345', { code39Check: 'mod10' }).text
check('code39 mod10 appends', c39, '12345' + m.mod10CheckDigit('12345'))
check('mod10 123456', m.mod10CheckDigit('123456'), '5')
check('library digit', m.libraryCheckDigit('9787'), '1')
