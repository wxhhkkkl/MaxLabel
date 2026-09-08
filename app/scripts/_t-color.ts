/* 变色设置单测：node scripts/_t-color.ts */
const path = require('path')
const esbuild = require('esbuild')
const fs = require('fs')
const os = require('os')
;(async () => {
  const out = path.join(os.tmpdir(), 'color-test-' + Date.now() + '.cjs')
  await esbuild.build({ entryPoints: [path.join(__dirname, '..', 'src', 'shared', 'model.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out })
  const m = require(out)
  let pass = 0, fail = 0
  function check(name, got, exp) {
    const g = JSON.stringify(got), e = JSON.stringify(exp)
    if (g === e) { pass++; console.log('PASS', name, '=>', g) } else { fail++; console.log('FAIL', name, '=>', g, '(expect', e + ')') }
  }
  const shared = ['#FF0000', '#00FF00', '#0000FF']
  const ccIndex = { mode: 'index', tableSource: 'shared', privateTable: ['#111'], changeMode: 'solid', blockRows: 1, blockCols: 1, variableName: '' }
  const ccPriv = { ...ccIndex, tableSource: 'private', privateTable: ['#AAA', '#BBB'] }
  const ccVar = { ...ccIndex, mode: 'variable', variableName: 'COLOR' }
  const ctx = { labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: '', printerName: '', datasets: {}, sharedVars: {}, keyboardValues: {} }
  check('index rec0', m.resolveObjectColor({ colorChange: ccIndex }, ctx, '#000000', shared), '#FF0000')
  check('index rec2', m.resolveObjectColor({ colorChange: ccIndex }, { ...ctx, recordIndex: 2 }, '#000000', shared), '#0000FF')
  check('index wrap', m.resolveObjectColor({ colorChange: ccIndex }, { ...ctx, recordIndex: 3 }, '#000000', shared), '#FF0000')
  check('private table', m.resolveObjectColor({ colorChange: ccPriv }, { ...ctx, recordIndex: 1 }, '#000000', shared), '#BBB')
  check('no colorChange fixed', m.resolveObjectColor({}, ctx, '#FF0000', shared), '#FF0000')
  check('variable keyboard', m.resolveObjectColor({ colorChange: ccVar }, { ...ctx, keyboardValues: { COLOR: '#123456' } }, '#000000', shared), '#123456')
  const ds = { name: 'DB1', columns: ['COLOR', 'NAME'], rows: [['#ABCDEF', 'X']] }
  check('variable db field', m.resolveObjectColor({ colorChange: ccVar }, { ...ctx, activeDataset: 'DB1', datasets: { DB1: ds }, recordRow: ['#ABCDEF', 'X'] }, '#000000', shared), '#ABCDEF')
  check('variable no value fallback', m.resolveObjectColor({ colorChange: ccVar }, ctx, '#000000', shared), '#000000')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
