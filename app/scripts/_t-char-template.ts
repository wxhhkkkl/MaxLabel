/* 验证字符模板：一个 '?' 表示原有数据的一个字符，其它字符插入数据序列 */
const path = require('path')
const { execSync } = require('child_process')
const esbuild = require(path.join(__dirname, '../node_modules/esbuild'))
const fs = require('fs')

// 用 esbuild 转译 model.ts 为 CJS
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

// 1. 简单模板：每个 ? 填一个数据字符
let r = M.applyObjectFormat('0123456789', undefined, undefined, undefined, '(01)??????????')
ok(r === '(01)0123456789', 'template basic (01)0123456789 => ' + r)

// 2. 模板含空 ?（数据比 ? 少）→ 留空
r = M.applyObjectFormat('12', undefined, undefined, undefined, '(??)??')
ok(r === '(12)', 'template empty leftover => ' + r)

// 3. 数据比 ? 多 → 多余丢弃
r = M.applyObjectFormat('1234567890123456', undefined, undefined, undefined, '???? ???? ???? ????')
ok(r === '1234 5678 9012 3456', 'template 4-group spaces => ' + r)

// 4. 与大小写组合：先格式化再套模板
r = M.applyObjectFormat('abcdef', 'upper', undefined, undefined, '???-???')
ok(r === 'ABC-DEF', 'template after upper => ' + r)

// 5. 与子串组合
r = M.applyObjectFormat('0123456789', undefined, { start: 0, length: 5 }, undefined, '(??)???')
ok(r === '(01)234', 'template after substr => ' + r)

// 6. resolveObjectText 走 charTemplate 字段
r = M.resolveObjectText({ source: { kind: 'constant', value: '01069012345678921020150321' }, charTemplate: '(01)?? … (10)??' })
// 只有两个 ?，填前两个字符 '01' 和 '10'？实际按序填：位置1='0'位置2='1'
ok(r.startsWith('(01)'), 'resolveObjectText with template starts (01) => ' + r)

// 7. 无 '?' 的模板 → 原样返回数据
r = M.applyObjectFormat('ABC', undefined, undefined, undefined, 'NO_QUESTION')
ok(r === 'ABC', 'template without ? returns original => ' + r)

console.log('\n' + pass + ' PASS / ' + fail + ' FAIL')
process.exit(fail ? 1 : 0)
