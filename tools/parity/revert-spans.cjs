/**
 * 删除矩阵里"夹在两条引用之间"的过期片段（验收方 round-162）
 *
 * 场景：我先用 r156 那批图引了菜单一族，后来发现其中 3 张贴错标签 ✗ → 换成 r162 的正确图重新引了一遍 ✓。
 * 但 cite 脚本只会**追加**，于是旧片段还留在行里 ✗。本脚本按"起始标记 → 结束标记"把中间那段删掉 ✓。
 *
 * 用法：node tools/parity/revert-citations.cjs --span
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..')
const matrix = path.join(REPO, 'parity', 'matrix.md')
const dry = process.argv.includes('--dry')

const START = '真机证据：parity/reference/labelshop/r156-menu-'
/** 新引用（保留段）的起点：r162 菜单图或 r160 数据库菜单图 */
const END_RE = /真机证据：(parity\/reference\/labelshop\/r162-menu-|parity\/reference\/labelshop\/r160-db-menu\.png)/

const lines = fs.readFileSync(matrix, 'utf8').split(/\r?\n/)
let changed = 0
for (let i = 0; i < lines.length; i++) {
  const m = /^\|\s*([A-E]-\d+)\s*\|/.exec(lines[i])
  if (!m) continue
  let line = lines[i]
  let removed = 0
  // 反复处理（同一行可能被追加过多次）
  for (;;) {
    const s = line.indexOf(START)
    if (s < 0) break
    const rest = line.slice(s)
    const e = rest.search(END_RE)
    if (e <= 0) break                      // 后面没有新引用 → 不动（交给 --cut 模式或人工）
    const cut = rest.slice(0, e)
    line = line.slice(0, s) + rest.slice(e)
    removed += cut.length
  }
  if (removed > 0) {
    lines[i] = line
    changed++
    console.log(`[ok] ${m[1]} 删除过期片段 ${removed} 字（保留了 r162 的新引用）`)
  }
}
if (!dry && changed) fs.writeFileSync(matrix, lines.join('\r\n'), 'utf8')
console.log(`\n共处理 ${changed} 行${dry ? '（dry-run）' : ''}`)
