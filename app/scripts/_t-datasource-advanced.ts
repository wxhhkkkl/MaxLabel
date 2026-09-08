/* 验证数据源高级处理：控制字符 / 截短 / 字符数限制 */
const path = require('path')
const ts = require('fs').readFileSync(path.join(__dirname, '../src/shared/model.ts'), 'utf8')
// 用 ts 编译太重，直接快速转译：写临时 mjs 复用 esbuild？直接用简易 require 不行（TS）。
// 方案：用 electron 的 tsx？改用 babel 太重。这里改用编译后的模块：用 esbuild 转译 model.ts
const { execSync } = require('child_process')
const esbuild = require(path.join(__dirname, '../node_modules/esbuild'))
esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/shared/model.ts')], bundle: true, format: 'cjs', outfile: path.join(__dirname, '_model_test.cjs'), platform: 'node' })
const m = require('./_model_test.cjs')

function check(name, actual, expect) {
  const ok = JSON.stringify(actual) === JSON.stringify(expect)
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + ' => ' + JSON.stringify(actual) + (ok ? '' : ' (expect ' + JSON.stringify(expect) + ')'))
}

// 1) 控制字符
check('control HT', m.decodeControlChars('123456<HT>7890'), '123456\t7890')
check('control CRLF', m.decodeControlChars('a<CR><LF>b'), 'a\r\nb')
check('escape <<HT>', m.decodeControlChars('<<HT>'), '<HT>')
check('escape <<<HT>', m.decodeControlChars('<<<HT>'), '<<HT>')
check('no angle', m.decodeControlChars('plain text'), 'plain text')

// 2) 截短
const obj1 = { source: { kind: 'constant', value: '  hello  ' }, format: 'none', substr: { start: 0, length: 0, cutType: 'trimLeft' } }
check('trimLeft', m.resolveObjectText(obj1), 'hello  ')
const obj2 = { source: { kind: 'constant', value: '  hello  ' }, substr: { start: 0, length: 0, cutType: 'trimRight' } }
check('trimRight', m.resolveObjectText(obj2), '  hello')
const obj3 = { source: { kind: 'constant', value: 'ABCDEF' }, substr: { start: 0, length: 0, cutType: 'dropLeft', cutCount: 2 } }
check('dropLeft 2', m.resolveObjectText(obj3), 'CDEF')
const obj4 = { source: { kind: 'constant', value: 'ABCDEF' }, substr: { start: 0, length: 0, cutType: 'keepRight', cutCount: 3 } }
check('keepRight 3', m.resolveObjectText(obj4), 'DEF')

// 3) 字符数限制
const obj5 = { source: { kind: 'constant', value: 'ABC' }, lengthLimit: { mode: 'min', min: 5, padDir: 'left', padChar: '0' } }
check('pad left 0 -> 00ABC', m.resolveObjectText(obj5), '00ABC')
const obj6 = { source: { kind: 'constant', value: 'ABC' }, lengthLimit: { mode: 'max', max: 2, trimDir: 'right' } }
check('max 2 trim right', m.resolveObjectText(obj6), 'AB')
const obj7 = { source: { kind: 'constant', value: 'ABC' }, lengthLimit: { mode: 'max', max: 2, trimDir: 'left' } }
check('max 2 trim left', m.resolveObjectText(obj7), 'BC')

// 4) 组合：控制字符 + 截短 + 子串 + 大小写 + 长度
const obj8 = { source: { kind: 'constant', value: '  abc<HT>def  ' }, format: 'upper', substr: { start: 0, length: 0, cutType: 'trimLeft' }, lengthLimit: { mode: 'max', max: 7, trimDir: 'right' } }
check('combo', m.resolveObjectText(obj8), 'ABC\tDEF')

console.log('DONE')
