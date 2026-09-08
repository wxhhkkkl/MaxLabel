/* 自定义命令透传单测：node scripts/_t-cmd.ts */
const path = require('path')
const esbuild = require('esbuild')
const os = require('os')
;(async () => {
  const out = path.join(os.tmpdir(), 'cmd-test-' + Date.now() + '.cjs')
  await esbuild.build({ entryPoints: [path.join(__dirname, '..', 'src', 'shared', 'print', 'engine.ts')], bundle: true, platform: 'node', format: 'cjs', outfile: out, external: [] })
  const m = require(out)
  let pass = 0, fail = 0
  function check(name, got, exp) {
    const ok = got === exp
    if (ok) { pass++; console.log('PASS', name) } else { fail++; console.log('FAIL', name, '=>', JSON.stringify(got), '(expect', JSON.stringify(exp) + ')') }
  }
  const doc = {
    name: 't', widthMm: 50, heightMm: 30, objects: [
      { id: 'a', type: 'text', x: 2, y: 2, w: 10, h: 5, color: '#000', fontSize: 4, fontFamily: 'Arial', bold: false, source: { kind: 'constant', value: 'HI' } }
    ]
  }
  const printer = {
    driver: 'tspl', dpi: 203, speed: 4, density: 8, printMode: 'thermal', labelType: 'gap',
    topOffsetMm: 0, mediaHandle: 'tear', backfeedMm: 0,
    preCmd: 'SYSVAR(50)="HELLO"',
    contentCmd: 'SET CUTTER ON',
    postCmd: 'SET TEAR ON',
    port: { type: 'file', encoding: 'utf8' }
  }
  const r = m.buildCommands(doc, printer, { count: 1, copy: 1 })
  check('preCmd present', r.text.includes('SYSVAR(50)="HELLO"'), true)
  check('contentCmd present', r.text.includes('SET CUTTER ON'), true)
  check('postCmd present', r.text.includes('SET TEAR ON'), true)
  // 顺序：pre 在最前、post 在最后
  check('pre first', r.text.indexOf('SYSVAR(50)') < r.text.indexOf('SET CUTTER'), true)
  check('post last', r.text.indexOf('SET TEAR') > r.text.indexOf('SET CUTTER'), true)
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
