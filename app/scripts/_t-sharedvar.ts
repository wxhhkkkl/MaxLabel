/* 验证共享变量：同名子串在同一打印（同一 DataCtx）内只解析一次，多对象引用同一值 */
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

// 同一 ctx 内：对象A子串 B01 命名 Batch；对象B子串 B02 命名 Batch → B 应取缓存 B01
const objA = { source: { kind: 'constant', value: 'A' }, subSources: [{ kind: 'constant', value: 'B01', sharedName: 'Batch' }] }
const objB = { source: { kind: 'constant', value: 'A' }, subSources: [{ kind: 'constant', value: 'B02', sharedName: 'Batch' }] }
const ctx1 = {}
const ta = M.resolveObjectText(objA, ctx1)
const tb = M.resolveObjectText(objB, ctx1)
ok(ta === 'AB01', 'objA resolves own sub ' + ta)
ok(tb === 'AB01', 'objB reuses shared Batch value (not B02) => ' + tb)

// 不同 ctx：B 解析出自己的 B02
const ctx2 = {}
const tb2 = M.resolveObjectText(objB, ctx2)
ok(tb2 === 'AB02', 'objB fresh ctx resolves own sub => ' + tb2)

// 无共享名：各自独立
const ctx3 = {}
const c1 = M.resolveObjectText({ source: { kind: 'constant', value: 'X' }, subSources: [{ kind: 'constant', value: '1' }] }, ctx3)
const c2 = M.resolveObjectText({ source: { kind: 'constant', value: 'X' }, subSources: [{ kind: 'constant', value: '2' }] }, ctx3)
ok(c1 === 'X1' && c2 === 'X2', 'no sharedName independent => ' + c1 + ',' + c2)

// 三个对象共享同一变量
const objC = { source: { kind: 'constant', value: 'C' }, subSources: [{ kind: 'constant', value: 'SHARED', sharedName: 'S1' }] }
const objD = { source: { kind: 'constant', value: 'D' }, subSources: [{ kind: 'constant', value: 'OTHER', sharedName: 'S1' }] }
const ctx4 = {}
const tc1 = M.resolveObjectText(objC, ctx4)
const td1 = M.resolveObjectText(objD, ctx4)
ok(tc1 === 'CSHARED' && td1 === 'DSHARED', '3-obj chain shares value => ' + tc1 + ',' + td1)

console.log('\n' + pass + ' PASS / ' + fail + ' FAIL')
process.exit(fail ? 1 : 0)
