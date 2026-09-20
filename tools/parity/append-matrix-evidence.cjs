/* round-114：把 ui-v122.cjs 的证据追加到 parity/matrix.md 的相关条目证据列。
 * 用法：node tools/parity/append-matrix-evidence.cjs */
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', '..', 'parity', 'matrix.md')
const NOTE = '；**round-114**：`app/scripts/ui-v122.cjs`（20/20，需求清单「对象编辑」15 条取证）覆盖本条'
const rows = ['B-02', 'B-10', 'B-11', 'B-14', 'B-18', 'B-23', 'B-25', 'B-26', 'B-56']

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
let touched = 0
for (let i = 0; i < lines.length; i += 1) {
  const match = /^\|\s*([A-E]-?\d+)\s*\|/.exec(lines[i])
  if (!match || !rows.includes(match[1])) continue
  if (lines[i].includes('ui-v122.cjs')) continue
  const cells = lines[i].split('|')
  if (cells.length < 4) continue
  cells[cells.length - 2] = cells[cells.length - 2].replace(/\s*$/, '') + NOTE
  lines[i] = cells.join('|')
  touched += 1
}
if (!touched) { console.error('没有匹配到条目'); process.exit(1) }
fs.writeFileSync(file, lines.join('\r\n'), 'utf8')
console.log(`已更新 ${touched} 条矩阵条目的证据列`)
