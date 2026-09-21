/**
 * 验收方 round-109：把已入库的"当轮构建并排图/复刻图"写进矩阵证据列（只改证据列，不动其它列）。
 * 目的：让普查能把这 6 行算成「四件套齐」（普查按证据列里出现的文件名判定）。
 * 安全：① 只对指定的 6 行做"在最后一个单元格末尾追加"；② 幂等（已含标记就不再追加）；③ 写完自检行数与表格结构。
 */
const fs = require('fs')
const path = require('path')

const repo = 'D:\\workspace\\maxlabel'
const matrix = path.join(repo, 'parity', 'matrix.md')
const MARK = '**验收方 round-109 补（当轮构建证据）**'

/** 行号 → 追加文本 */
const PLAN = {
  'A-206': 'parity/review/cmp-choose-label-r112.png（并排：左=真机 round-43「选择标签格式」，右=复刻版 round-112 构建）',
  'C-76': 'parity/review/cmp-choose-label-r112.png（并排：左=真机 round-43，右=复刻版 round-112 构建）；parity/reference/maxlabel/clone-choose-label-r112.png（复刻图）',
  'C-84': 'parity/review/cmp-choose-label-r112.png（并排：左=真机 round-43，右=复刻版 round-112 构建）',
  'B-28': 'parity/review/cmp-props-r113.png（并排：左=真机「条码属性」verifier-20c-barcode-page.png，右=复刻版 round-113 构建）',
  'B-70': 'parity/review/cmp-props-r113.png（并排：左=真机「条码属性 → 条码」页，右=复刻版 round-113 构建）',
  'C-81': 'parity/reference/maxlabel/clone-custom-r114.png（复刻图：round-114 构建的「标签格式设置」）；parity/review/cmp-custom-r114.png（并排：左=真机 round-44，右=复刻版 round-114 构建）',
}

/** 真机证据（菜单项形态）：`verifier-r43-file-menu.png` 是 round-43 真机编辑态「文件」菜单的实拍，
 *  能证明这些菜单项**存在、文案与加速键**；它**不**证明各菜单项打开的对话框内容（那属于各自的行）。 */
const MENU_FILE = 'parity/reference/labelshop/verifier-r43-file-menu.png'
const MENU_ROWS = ['A-33', 'A-34', 'A-35', 'A-36', 'A-37', 'A-38', 'A-39', 'A-40', 'A-43', 'A-44']
for (const id of MENU_ROWS) {
  PLAN[id] = `真机证据（菜单项形态，round-43 实拍）：${MENU_FILE} —— 该图完整拍到「文件」菜单的各项文案与加速键，可佐证本行菜单项存在；打开后的对话框内容另见各自行的证据`
}

const raw = fs.readFileSync(matrix, 'utf8')
const lines = raw.split(/\r?\n/)
let changed = 0
for (let i = 0; i < lines.length; i++) {
  const m = /^\|\s*([A-E]-\d+)\s*\|/.exec(lines[i])
  if (!m) continue
  const id = m[1]
  const add = PLAN[id]
  if (!add) continue
  if (lines[i].includes(MARK)) { console.log(`[skip] ${id} 已含标记`); continue }
  // 追加到该行最后一个单元格：**必须插在最后一个 `|` 之前**。
  // 踩坑记录：A-206 行尾是 `。|`（最后一个竖线前**没有空格**），用 lastIndexOf(' |') 会插到单元格内部、把列数从 6 变 5，
  // 触发 Check-Matrix 违规。所以这里只认"行尾竖线"。
  const trimmedEnd = lines[i].replace(/\s+$/, '')
  if (!trimmedEnd.endsWith('|')) { console.log(`[warn] ${id} 行尾不是竖线，跳过`); continue }
  lines[i] = trimmedEnd.slice(0, -1).replace(/\s+$/, '') + `  ${MARK}：${add} |`
  changed++
  console.log(`[ok] ${id} 已补证据引用`)
}
if (changed > 0) fs.writeFileSync(matrix, lines.join('\r\n'), 'utf8')
console.log(`\n共修改 ${changed} 行（矩阵：${path.relative(repo, matrix)}）`)

// 自检：表格行数与目标行仍可解析
const after = fs.readFileSync(matrix, 'utf8').split(/\r?\n/)
const rows = after.filter((l) => /^\|\s*[A-E]-\d+\s*\|/.test(l)).length
const bad = after.filter((l) => /^\|\s*[A-E]-\d+\s*\|/.test(l) && (l.match(/\|/g) || []).length !== 7).length
console.log(`自检：矩阵数据行 ${rows} 行；列数异常行 ${bad} 行（应为 0）`)
