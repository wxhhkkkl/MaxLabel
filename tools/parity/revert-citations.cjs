/**
 * 撤销"无效引用"（验收方 round-155 新增，用于我自己的纠错）
 *
 * 背景：round-150 我给菜单一族（A-45/48/54/57/60/63/66/68）引用了 r150-menu-*.png 作真机证据，
 * 但 **那些图其实没拍到菜单** ✗ —— 那一轮真机停在"启始页"（没有 编辑/查看/工具/排列/数据库/窗口/帮助 这些菜单），
 * `keys:%e` 之类的 Alt 加速键自然什么也没打开，截图只是起始页 ✗。我引完没逐张看图就写进了矩阵 ✗。
 *
 * 本脚本把这些**不成立的引用**从矩阵里删掉（只删我自己追加的那一段 ✓），保证覆盖率数字不再虚高。
 * 用法：node tools/parity/revert-citations.cjs [--dry]
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..')
const matrix = path.join(REPO, 'parity', 'matrix.md')
const dry = process.argv.includes('--dry')

/** 要删的引用：行号 → 从这个片段开始（含）删到该单元格末尾 */
const CUTS = {}
for (const id of ['A-45', 'A-48', 'A-54', 'A-57', 'A-60', 'A-63', 'A-66', 'A-68']) {
  CUTS[id] = '真机证据：parity/reference/labelshop/r150-menu-'
}

const lines = fs.readFileSync(matrix, 'utf8').split(/\r?\n/)
let changed = 0
for (let i = 0; i < lines.length; i++) {
  const m = /^\|\s*([A-E]-\d+)\s*\|/.exec(lines[i])
  if (!m) continue
  const cut = CUTS[m[1]]
  if (!cut) continue
  const at = lines[i].indexOf(cut)
  if (at < 0) { console.log(`[skip] ${m[1]} 未找到待删片段（可能已删过）`); continue }
  const before = lines[i].slice(0, at).replace(/[\s；;]+$/, '')
  const after = lines[i].slice(at)
  // 该单元格末尾：找到本行最后一个竖线（行尾竖线缺失的行也兼容）
  const tail = after.includes('|') ? after.slice(after.lastIndexOf('|')) : ''
  const keepTail = tail && tail.trim() === '|' ? ' |' : tail
  lines[i] = before + (keepTail ? (keepTail.startsWith(' ') ? keepTail : ' ' + keepTail) : '')
  changed++
  console.log(`[ok] ${m[1]} 已删掉无效引用（${after.length - keepTail.length} 字）`)
}
if (!dry && changed) fs.writeFileSync(matrix, lines.join('\r\n'), 'utf8')
console.log(`\n共清理 ${changed} 行${dry ? '（dry-run，未写盘）' : ''}`)
