/* 验证多数据源（子串）连接：主源 + 子串依次拼接、子串序列号推进、键盘子串取值 */
const path = require('path')
const esbuild = require(path.join(__dirname, '../node_modules/esbuild'))
esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/shared/model.ts')], bundle: true, format: 'cjs', outfile: path.join(__dirname, '_model_test.cjs'), platform: 'node' })
const m = require('./_model_test.cjs')

function check(name, actual, expect) {
  const ok = JSON.stringify(actual) === JSON.stringify(expect)
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' => ' + JSON.stringify(actual) + (ok ? '' : ' (expect ' + JSON.stringify(expect) + ')'))
}

// 1) 主常量 + 子串常量拼接
check(
  'concat const+const',
  m.resolveObjectText({
    source: { kind: 'constant', value: '单价：' },
    subSources: [{ kind: 'constant', value: '12.5元' }]
  }),
  '单价：12.5元'
)

// 2) 常量 + 序列号 + 常量（多子串）
const obj = {
  source: { kind: 'constant', value: 'NO.' },
  subSources: [
    { kind: 'serial', prefix: '', start: 1, step: 1, digits: 3, current: 7, charset: '' },
    { kind: 'constant', value: '/2026' }
  ]
}
check('concat const+serial+const', m.resolveObjectText(obj, { labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: '', printerName: '', datasets: {}, sharedVars: {} }), 'NO.007/2026')

// 3) 无子串时正常
check('no subs', m.resolveObjectText({ source: { kind: 'constant', value: 'AB' } }, { labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: '', printerName: '', datasets: {}, sharedVars: {} }), 'AB')

// 4) 子串键盘输入取值
check(
  'sub keyboard value',
  m.resolveObjectText({
    source: { kind: 'constant', value: '重量：' },
    subSources: [{ kind: 'keyboard', label: '重量' }]
  }, { labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: '', printerName: '', datasets: {}, sharedVars: {}, keyboardValues: { 重量: '3.5kg' } } as any),
  '重量：3.5kg'
)

// 5) 子串序列号推进
const after = m.advanceSerial(obj.subSources[0], 1)
check('sub serial advance', m.serialText(after, 1), '008')
