/*
 * round-124：把本轮新出的「复刻图 + 并排图」写进矩阵证据列（只改证据列，不动其它列）。
 * 目的：让四件套普查能把这 5 行算成「四件套齐」（普查按证据列里出现的文件名判定）。
 * 安全：① 只对指定行做"末尾追加"；② 幂等（已含标记就不再追加）；③ 写完自检行数与表格结构。
 */
const fs = require('fs')
const path = require('path')

const repo = path.join(__dirname, '..', '..')
const matrix = path.join(repo, 'parity', 'matrix.md')
const MARK = '**round-124 补（当轮构建证据）**'

const CLONE = (s) => `parity/reference/maxlabel/clone-${s}-r124.png`
const CMP = (s) => `parity/review/cmp-${s}-r124.png`

/** 行号 → 追加文本 */
const PLAN = {
  'A-43': `复刻图 ${CLONE('menu')} 与并排图 ${CMP('menu')}（左=真机文件菜单 verifier-r43-file-menu.png，右=复刻版 round-124 构建）：两侧同为"有文档态"，` +
    `「最近的文件 ▸」子菜单项在两侧都可见；真机该项为可展开的二级菜单，复刻版空态下显示为禁用项（列表为空时不展开是既有实现，见本行正文）`,
  'A-121': `复刻图 ${CLONE('toolbar')} 与并排图 ${CMP('toolbar')}（左=真机 91-toolbar-customize-submenu.png，右=复刻版 round-124 构建）：` +
    `两侧都拍到工具栏最右端 » 展开后的「添加或删除按钮(A) ▸」二级菜单（含「标准 ▸」与「自定义...」两项）。` +
    `**状态差异（已知）**：真机那张是在**启始页**拍的（原版启始页也带工具栏），复刻版工具栏只在编辑器内渲染，故右侧多一个文档标签页；` +
    `本行只主张**该两级菜单的项名与层级**，两侧在这一点上同态可比`,
  'D-02': `复刻图 ${CLONE('print')} 与并排图 ${CMP('print')}（左=真机打印对话框 63-dlg-print.png，右=复刻版 round-124 构建，Ctrl+P 打开）：` +
    `两侧三组（打印机 / 打印范围 / 设置）与右栏「选取起始标签」8 格 + 「自动跟踪起始标签位置」结构一致；` +
    `**状态差异（已知）**：打印机名与位置随本机安装的打印机变化（真机 Microsoft Print to PDF / PORTPROMPT:，复刻版为「系统默认打印机」），不作对比项`,
  'D-34': `复刻图 ${CLONE('install')} 与并排图 ${CMP('install')}（左=真机「安装 LabelShop 打印机」probe-07-install-printer.png，右=复刻版 round-124 构建）：` +
    `两侧同为「可安装的打印机:」品牌下拉 + 打印机/状态 两列表 + 说明文字 + 安装/移除/帮助/返回 底排四按钮，且未选中行时安装与移除均为禁用态`,
  'D-35': `复刻图 ${CLONE('install')} 与并排图 ${CMP('install')}（左=真机 probe-07-install-printer.png，右=复刻版 round-124 构建）：` +
    `两侧列表首行同为 Gprinter GPL-N (203 dpi)；脚本 ui-v119.cjs 另行断言 125 行与首末行、39 项品牌过滤`,
}

const lines = fs.readFileSync(matrix, 'utf8').split(/\r?\n/)
let touched = 0
for (let i = 0; i < lines.length; i += 1) {
  const m = /^\|\s*([A-E]-?\d+)\s*\|/.exec(lines[i])
  if (!m || !PLAN[m[1]]) continue
  if (lines[i].includes(MARK)) continue
  const cells = lines[i].split('|')
  if (cells.length < 4) continue
  // 多数行以 `|` 结尾 → 证据列是倒数第二段；少数行（如 A-121）末尾少了最后一个竖线 → 证据列就是最后一段。
  // （survey-evidence-coverage.cjs 也按这个差异解析，这里必须一致，否则会把文字写进「状态」列。）
  const idx = lines[i].trimEnd().endsWith('|') ? cells.length - 2 : cells.length - 1
  cells[idx] = cells[idx].replace(/\s*$/, '') + ' ' + MARK + '：' + PLAN[m[1]]
  lines[i] = cells.join('|')
  touched += 1
}
if (!touched) { console.error('没有匹配到条目（可能已追加过）'); process.exit(1) }
fs.writeFileSync(matrix, lines.join('\r\n'), 'utf8')
console.log(`已更新 ${touched} 条矩阵条目的证据列`)
