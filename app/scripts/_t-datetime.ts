/* 验证日期/时间偏移（offset 天 / offset 分钟） */
const path = require('path')
const esbuild = require(path.join(__dirname, '../node_modules/esbuild'))

const out = path.join(__dirname, '_tmp_model.cjs')
esbuild.buildSync({
  entryPoints: [path.join(__dirname, '../src/shared/model.ts')],
  bundle: false,
  format: 'cjs',
  outfile: out,
  platform: 'node',
  logLevel: 'silent',
})
delete require.cache[require.resolve(out)]
const M = require(out)

let pass = 0
let fail = 0
function ok(cond, name) {
  if (cond) { pass++; console.log('PASS ' + name) }
  else { fail++; console.log('FAIL ' + name) }
}

const ctx = {}
// 今天
const today = M.resolveSourceText({ kind: 'date', format: 'yyyy-MM-dd', offset: 0 }, ctx)
const d = new Date()
const p = (n) => String(n).padStart(2, '0')
const todayStr = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
ok(today === todayStr, 'date offset 0 => today ' + today)

// 明天
const tm = M.resolveSourceText({ kind: 'date', format: 'yyyy-MM-dd', offset: 1 }, ctx)
const d2 = new Date(Date.now() + 86400000)
const tmStr = `${d2.getFullYear()}-${p(d2.getMonth() + 1)}-${p(d2.getDate())}`
ok(tm === tmStr, 'date offset 1 => tomorrow ' + tm)

// 昨天
const yd = M.resolveSourceText({ kind: 'date', format: 'yyyy-MM-dd', offset: -1 }, ctx)
const d3 = new Date(Date.now() - 86400000)
const ydStr = `${d3.getFullYear()}-${p(d3.getMonth() + 1)}-${p(d3.getDate())}`
ok(yd === ydStr, 'date offset -1 => yesterday ' + yd)

// 时间偏移 60 分钟（HH:mm）
const hhmm = (ms) => { const x = new Date(ms); return p(x.getHours()) + ':' + p(x.getMinutes()) }
const now0 = M.resolveSourceText({ kind: 'time', format: 'HH:mm', offset: 0 }, ctx)
const now60 = M.resolveSourceText({ kind: 'time', format: 'HH:mm', offset: 60 }, ctx)
const [h0, m0] = now0.split(':').map(Number)
const [h1, m1] = now60.split(':').map(Number)
const diff = ((h1 * 60 + m1) - (h0 * 60 + m0) + 1440) % 1440
ok(diff === 60, 'time offset 60 => +60m diff=' + diff + ' (' + now0 + ' -> ' + now60 + ')')

console.log('\n' + pass + ' PASS / ' + fail + ' FAIL')
process.exit(fail ? 1 : 0)
