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

/** 主界面（A-174 界面元素 / A-165 状态栏）：`cmp-editor-r116.png` = 左真机 round-43（100×20mm 文档）× 右复刻版 round-116 构建。
 *  可比的是**界面框架**（菜单栏各项、工具栏、左面板、右面板「打印」区、状态栏）；
 *  **画布内容不可比**（真机那张是 100×20mm 带孔文档，复刻版是默认 100×70 文档），引用时写明。 */
const EDITOR_CMP = 'parity/review/cmp-editor-r116.png'
PLAN['A-174'] = `并排图 ${EDITOR_CMP}（左=真机 round-43 主界面，右=复刻版 round-116 构建）：**界面框架可比** —— 菜单栏（文件/编辑/查看/工具/排列/数据库/账户/云马通/选项/窗口/帮助/建议与反馈）、工具栏、左侧面板（起始页/文档标签/图层）、右侧「打印」区（参数设置/打印服务器页签、输入数据、打印机、打印数量/单张拷贝、打印按钮）、状态栏；**画布内容不可比**（真机为 100×20mm 带孔文档，复刻版为默认 100×70）`
PLAN['A-165'] = `并排图 ${EDITOR_CMP}（左=真机 round-43，右=复刻版 round-116 构建）：两图**状态栏均完整可见**（真机：打印机名+分辨率+格式名+数据库状态+光标位置+缩放；复刻版：打印机 / 纸张 / 数据库 / 光标 / 缩放 分段）——本行只主张状态栏的**分段结构与可见性**，具体数值随文档/打印机状态变化`

/* A-271（启始页右区）与 A-42（模板属性设置）等行**先出图再引用**：出图后用具体文件名加进来。
 * 教训（round-118）：不要先写带占位符（如 `<轮次>`）的引用 —— 占位符抽不出合法路径，存在性检查会放行，
 * 于是把不存在的文件名写进了证据列。现在的规则是：**追加文本里必须至少有一个真实存在的 parity 路径**。 */

const fsp = require('fs')
/** 从追加文本里抽出所有 tools/ 或 parity/ 形式的路径，逐个做存在性检查；缺一个就整行跳过该行。
 *  目的：绝不把**不存在**的文件名写进证据列（那会让覆盖率虚高）。存在性审计脚本：tools/parity/check-evidence-files.cjs */
function refsMissing(text) {
  const re = /(?:tools\/)?parity\/[A-Za-z0-9._\-\u4e00-\u9fa5/]+\.(?:png|txt|md|json|cjs|ps1|log|pdf)/g
  const hits = text.match(re) || []
  if (hits.length === 0) return ['（追加文本里没有任何可识别的 parity 证据路径）']
  return hits.filter((h) => !fsp.existsSync(path.join(repo, h.replace(/\//g, path.sep))))
}

/* 文件菜单（A-34/35/37/38/39）：`cmp-menu-r119.png` = 左真机 round-43「文件」菜单展开态 × 右复刻版 **round-119 构建**，
 *  且**两侧都是"有文档态"**（round-121 那张 r115 是无文档态、两边不可比，已废弃不用）。
 *  同态对比结论：14 项**全部存在、顺序一致**；唯一差异是 `分享` 的加速键（真机 `分享(T)...` vs 复刻版 `分享(I)...`，已在任务清单登记）。 */
const MENU_CMP = 'parity/review/cmp-menu-r119.png'

/* 启始页（A-271 起始页右区）：`cmp-start-r119.png` = 左真机启始页 × 右复刻版 round-119 构建。
 *  两侧都能看到右区的三块（重要通知 / 签赋学堂 / 各类不干胶标签）与「最新文章」标题；
 *  ⚠️ banner 里的商品图是版权素材、复刻版用自绘图形替代（已记录边界）；「最新文章」列表是否为空待复核。 */
PLAN['A-271'] = `并排图 parity/review/cmp-start-r119.png（左=真机启始页，右=复刻版 round-119 构建）：右区三块（重要通知 / 签赋学堂 / 各类不干胶标签）与「最新文章」标题两侧都有；复刻图 parity/reference/maxlabel/clone-start-r119.png`
PLAN['A-34'] = `并排图 ${MENU_CMP}（左=真机 round-43「文件」菜单，右=复刻版 round-119 构建，**两侧同为有文档态**）：两侧都能看到 ` + '`新建条幅飘带`' + ` 项且文案一致`
PLAN['A-35'] = `并排图 ${MENU_CMP}（同态）：两侧都能看到 ` + '`打开(O)... Ctrl+O`' + ` 且文案与加速键一致`
PLAN['A-37'] = `并排图 ${MENU_CMP}（同态）：两侧都能看到 ` + '`保存(S) Ctrl+S`' + ` 且文案与加速键一致`
PLAN['A-38'] = `并排图 ${MENU_CMP}（同态）：两侧都能看到 ` + '`另存为(A)...`' + ` 且文案一致（真机该项无加速键显示，复刻版同）`
PLAN['A-39'] = `并排图 ${MENU_CMP}（同态）：两侧都能看到「分享」项；**加速键不同**（真机 分享(T)... / 复刻版 分享(I)...）——差异已登记，引用本图即为此项证据`

/** 真机证据（菜单项形态）：`verifier-r43-file-menu.png` 是 round-43 真机编辑态「文件」菜单的实拍，
 *  能证明这些菜单项**存在、文案与加速键**；它**不**证明各菜单项打开的对话框内容（那属于各自的行）。 */
const MENU_FILE = 'parity/reference/labelshop/verifier-r43-file-menu.png'
const MENU_ROWS = ['A-33', 'A-34', 'A-35', 'A-36', 'A-37', 'A-38', 'A-39', 'A-40', 'A-43', 'A-44']
for (const id of MENU_ROWS) {
  // 不要覆盖更具体的条目（A-34/A-35 另有并排图引用）——round-121 踩过：后面的赋值把前面的覆盖了，结果那两条没写进去。
  if (PLAN[id]) continue
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
  const addPaths = (add.match(/(?:tools\/)?parity\/[A-Za-z0-9._\-\u4e00-\u9fa5/]+\.(?:png|txt|md|json|cjs|ps1|log|pdf)/g) || [])
  const missing = refsMissing(add)
  if (missing.length) { console.log(`[skip] ${id} 引用的文件还不存在：${missing.join(', ')}`); continue }
  // 幂等判据用**内容**（该行是否已经引用了这批文件），而不是用标记 —— 否则同一行第二次补别的图会被误跳过。
  const already = addPaths.every((p) => lines[i].includes(p))
  if (already) { console.log(`[skip] ${id} 已引用过这些文件`); continue }
  // 追加到该行最后一个单元格：**必须插在最后一个 `|` 之前**。
  // 踩坑记录：A-206 行尾是 `。|`（最后一个竖线前**没有空格**），用 lastIndexOf(' |') 会插到单元格内部、把列数从 6 变 5，
  // 触发 Check-Matrix 违规。所以这里只认"行尾竖线"。
  const trimmedEnd = lines[i].replace(/\s+$/, '')
  if (trimmedEnd.endsWith('|')) {
    lines[i] = trimmedEnd.slice(0, -1).replace(/\s+$/, '') + `  ${MARK}：${add} |`
  } else {
    // 少数行**没有结尾竖线**（例如 A-271 原本就少写了一个 `|`，Check-Matrix 容忍但结构不完整）。
    // 这种行不能按"插在最后竖线前"处理（会插进单元格中间），直接追加到行尾、**并保持它原有的形状**（不擅自补竖线）。
    lines[i] = trimmedEnd + `  ${MARK}：${add}`
    console.log(`[note] ${id} 该行没有结尾竖线，按"追加到行尾"处理（未改动其结构）`)
  }
  changed++
  console.log(`[ok] ${id} 已补证据引用`)
}
if (changed > 0) fs.writeFileSync(matrix, lines.join('\r\n'), 'utf8')
console.log(`\n共修改 ${changed} 行（矩阵：${path.relative(repo, matrix)}）`)

// 自检：表格数据行数 + 提示权威校验脚本
// 注意：**不要**用"每行竖线数是否相等"做自检 —— 单元格正文里本身可能含 `|`（例如"宽×高 | 说明"），
// 于是会出现一堆假异常（round-109/118 都被这个假象误导过）。列结构的权威判定是 `tools/parity/Check-Matrix.ps1`。
const after = fs.readFileSync(matrix, 'utf8').split(/\r?\n/)
const rows = after.filter((l) => /^\|\s*[A-E]-\d+\s*\|/.test(l)).length
console.log(`自检：矩阵数据行 ${rows} 行。列结构请跑：powershell -File tools/parity/Check-Matrix.ps1（权威）`)
console.log(`引用存在性请跑：node tools/parity/check-evidence-files.cjs；覆盖度请跑：node tools/parity/survey-evidence-coverage.cjs`)
