/* round-124：B-70 / B-71 的并排证据更正 —— 原引用的 cmp-props-r113.png 右侧其实是「常规」页，
 * 不能当「条码页」的对照；本轮补出真正的条码页并排图 cmp-propsbarcode-r124.png。只改证据列。 */
const fs = require('fs')
const path = require('path')
const matrix = path.join(__dirname, '..', '..', 'parity', 'matrix.md')
const MARK = '**round-124 补（当轮构建证据）**'
const CLONE = 'parity/reference/maxlabel/clone-propsbarcode-r124.png'
const CMP = 'parity/review/cmp-propsbarcode-r124.png'
const NOTE = '：复刻图 ' + CLONE + ' 与并排图 ' + CMP +
  '（左=真机条码页 verifier-20c-barcode-page.png，右=复刻版 round-124 构建，**两侧同为「条码属性 → 条码」页**）。' +
  '**更正**：本行原先引用的 parity/review/cmp-props-r113.png 右侧实为复刻版的「常规」页，不能作为条码页的对照图，已由本图取代。' +
  '并排图同时暴露并已修一处差异：复刻版原先对**所有**码制都渲染「条宽比」，真机只有 Code 39/CodaBar/25 码族/China Post/Pharmacode/ITF 14/PDF 417 有 —— ' +
  '已改为按码制条件渲染（见 parity/diffs.md DIFF-76），断言 app/scripts/ui-v126.cjs 13/13'
const rows = ['B-70', 'B-71']
const lines = fs.readFileSync(matrix, 'utf8').split(/\r?\n/)
let touched = 0
for (let i = 0; i < lines.length; i += 1) {
  const m = /^\|\s*([A-E]-?\d+)\s*\|/.exec(lines[i])
  if (!m || !rows.includes(m[1]) || lines[i].includes(MARK)) continue
  const cells = lines[i].split('|')
  const idx = lines[i].trimEnd().endsWith('|') ? cells.length - 2 : cells.length - 1
  cells[idx] = cells[idx].replace(/\s*$/, '') + ' ' + MARK + NOTE
  lines[i] = cells.join('|')
  touched += 1
}
if (!touched) { console.error('没有匹配到条目（可能已追加过）'); process.exit(1) }
fs.writeFileSync(matrix, lines.join('\r\n'), 'utf8')
console.log('已更新 ' + touched + ' 条')
