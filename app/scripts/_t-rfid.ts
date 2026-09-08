/* RFID 指令输出单测：node scripts/_t-rfid.ts */
const path = require('path')
const esbuild = require('esbuild')
const os = require('os')
;(async () => {
  const out = path.join(os.tmpdir(), 'rfid-test-' + Date.now() + '.cjs')
  await esbuild.build({ entryPoints: [path.join(__dirname, '..', 'src', 'shared', 'print', 'tspl.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, external: [] })
  const m = require(out)
  let pass = 0, fail = 0
  function check(name, got, exp) {
    const ok = got === exp
    if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, '=>', JSON.stringify(got), '(expect', JSON.stringify(exp) + ')') }
  }
  const mk = (patch) => ({
    name: 't', widthMm: 50, heightMm: 30, objects: [
      { id: 'r', type: 'rfid', x: 2, y: 2, w: 10, h: 5, rotation: 0, bank: 'EPC', source: { kind: 'constant', value: 'A1B2C3' }, lock: false, ...patch }
    ]
  })
  const printer = { driver: 'tspl', dpi: 203, speed: 4, density: 8, printMode: 'thermal', labelType: 'gap', topOffsetMm: 0, mediaHandle: 'tear', backfeedMm: 0, port: { type: 'file', encoding: 'utf8' } }
  const ctx = { labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: 't', printerName: '', datasets: {}, sharedVars: {}, keyboardValues: {} }

  const r1 = m.buildTSPL(mk({}), printer, ctx, [])
  check('EPC hex uppercase', r1.includes('RFID;EPC,A1B2C3'), true)

  // ascii 数据源自动转 hex
  const r2 = m.buildTSPL(mk({ source: { kind: 'constant', value: 'XY' } }), printer, ctx, [])
  check('ascii auto to hex', /RFID;EPC,5859/.test(r2), true)

  // dataType=hex 强制原样（即使非纯hex）
  const r3 = m.buildTSPL(mk({ source: { kind: 'constant', value: 'ABC' }, dataType: 'hex' }), printer, ctx, [])
  check('force hex', r3.includes('RFID;EPC,ABC'), true)

  // startBlock
  const r4 = m.buildTSPL(mk({ startBlock: 2 }), printer, ctx, [])
  check('startBlock', r4.includes('RFID;EPC,A1B2C3,2'), true)

  // pcWord + lockOp permanent
  const r5 = m.buildTSPL(mk({ pcWord: '0x3000', lockOp: 'permanent', accessPwd: '11223344', killPwd: '55667788' }), printer, ctx, [])
  check('pcWord', r5.includes('RFID;PC,3000'), true)
  check('perm alock', /RFID;PERMALOCK,11223344,55667788,EPC/.test(r5), true)

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
