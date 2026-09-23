/**
 * 界面级四件套覆盖表（验收方 round-147 新增）
 *
 * 动机：停止标准说的是「**界面**清单全部界面都有四件套证据」，而矩阵是 605 行的**条目**粒度。
 * 行级凑齐 605 条不现实（很多行是快捷键/帮助主题，没有"界面"），所以这里按**界面**为单位重新聚合：
 *   - 每个界面 = 一组行（用标题正则匹配）；
 *   - 该界面是否"四件套齐" = 组内**至少一行**四件套齐（说明该界面确实被真机拍过、被复刻拍过、有并排图、有断言）；
 *   - 同时列出该界面组内四件套各自覆盖了多少行，便于看出下一步该补哪一件。
 *
 * 用法：node tools/parity/coverage-by-interface.cjs [--out parity/P4-界面级覆盖表.md]
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..')
const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outFile = outIdx >= 0 ? args[outIdx + 1] : path.join(REPO, 'parity', 'P4-界面级覆盖表.md')

/** 界面清单：name = 显示名，pat = 匹配矩阵行标题的正则 */
const INTERFACES = [
  { name: '启始页', pat: /启始页|起始页|主页面|广告位/ },
  { name: '主界面（编辑器窗口/工具条/状态栏）', pat: /主界面|界面元素|主工具栏|状态栏|格式栏|对齐栏|图层窗体/ },
  { name: '文件菜单', pat: /文件菜单/ },
  { name: '编辑菜单', pat: /编辑菜单/ },
  { name: '查看菜单', pat: /查看菜单/ },
  { name: '工具菜单', pat: /工具菜单/ },
  { name: '排列菜单', pat: /排列菜单/ },
  { name: '数据库菜单', pat: /数据库菜单|数据源/ },
  { name: '账户菜单', pat: /账户菜单/ },
  { name: '云马通菜单', pat: /云马通菜单/ },
  { name: '选项菜单', pat: /选项菜单/ },
  { name: '窗口菜单', pat: /窗口菜单/ },
  { name: '帮助菜单', pat: /帮助菜单/ },
  { name: '选择标签格式', pat: /选择系统预定义的标签格式|选择标签格式|新建标签模板/ },
  { name: '标签格式设置 / 模板属性设置', pat: /标签格式设置|模板属性设置|自定义标签格式/ },
  { name: '系统设置（原系统选项）', pat: /系统选项|系统设置/ },
  { name: '对象属性（总）', pat: /对象属性|属性对话/ },
  { name: '对象属性·条码页', pat: /条码特殊选项|条码符号类型|供人识读|码制/ },
  { name: '对象属性·字体页', pat: /字体名称|字体宽度|字号|字体大小/ },
  { name: '对象属性·数据源页', pat: /数据源|序列号|子串/ },
  { name: '对象属性·常规页', pat: /常规(页|\s*→)|位置锁定|镜像/ },
  { name: '打印对话框', pat: /打印对话框|打印设置|打印预览|选取起始标签/ },
  { name: '打印机属性（端口/工具/首选项）', pat: /打印机属性|端口页|端口类型|打印机端口|工具页/ },
  { name: '安装/移除打印机', pat: /安装打印机|安装或移除|可安装的打印机/ },
  { name: '登录/激活', pat: /登录|激活|授权|试用/, limited: '原版有但受限：原版是应用内「登录 LabelShop」窗口；复刻版走外部云服务窗口，服务器不可达时只在状态栏提示（DIFF-82，循环用安装包字符串表 + 帮助 menu_help.html 核实）' },
  { name: '关于对话框', pat: /关于/ },
  { name: '帮助主题', pat: /帮助主题|帮助.*html/ },
  { name: '云模板/数据库对话框', pat: /云端|云模板|数据库连接|数据集/, limited: '原版有但受限：真机「云马通(C) → 云数据库」等项在**未登录时整体禁用**（round-160 实拍 r160-cloud-menu.png：首页可选、云标签模板库/云数据库/云图片库/云网页库 均为灰）→ 无法在未登录态取得该对话框的真机证据；复刻版对应功能需要云账号' },
  { name: '工具栏自定义', pat: /添加或删除按钮|自定义工具栏/ },
  { name: '快捷键', pat: /快捷键/, nonInterface: true },   // 表格式条目，不是"界面" → 不计入界面分母（round-151 口径修正）
]

const matrix = fs.readFileSync(path.join(REPO, 'parity', 'matrix.md'), 'utf8')
const rows = []
for (const line of matrix.split(/\r?\n/)) {
  const m = /^\|\s*([A-E]-\d+)\s*\|\s*([^|]*)\|/.exec(line)
  if (!m) continue
  const id = m[1]
  const title = m[2].trim()
  const cells = line.split('|')
  const evidence = cells.slice(6).join('|') // 证据列（最后一列）
  const hasReal = /labelshop\//.test(evidence)
  const hasClone = /reference\/maxlabel\//.test(evidence)
  const hasSide = /review\/cmp-/.test(evidence)
  const hasAssert = /\.cjs|\.ts|\.ps1|npm run|断言|test:/.test(evidence)
  rows.push({ id, title, hasReal, hasClone, hasSide, hasAssert })
}

const lines = []
lines.push('# P4 界面级四件套覆盖表（验收方自动生成）')
lines.push('')
lines.push(`- 生成时间：${new Date().toLocaleString('zh-CN')}`)
lines.push(`- 口径：**界面**为单位。某界面「四件套齐」= 组内至少一行同时具备 真机证据 / 复刻版证据 / 并排图 / 自动断言。`)
lines.push(`- 说明：行级 605 条全部凑齐不现实（含快捷键、帮助主题等无"界面"的条目）；本表用于回答"**每个界面是否都有四件套**"。`)
lines.push('')
lines.push('| 界面 | 组内行数 | 真机证据 | 复刻版证据 | 并排图 | 自动断言 | 四件套齐 |')
lines.push('| --- | --- | --- | --- | --- | --- | --- |')

let uiComplete = 0
let uiTotal = 0
const detail = []
for (const ui of INTERFACES) {
  const grp = rows.filter((r) => ui.pat.test(r.title))
  if (ui.nonInterface) {
    // 非界面条目（例如"快捷键"是表格式清单）→ 只展示，不计入界面分母（round-151 口径修正）
    lines.push(`| ${ui.name}（非界面） | ${grp.length} | — | — | — | — | ➖ 不计入界面分母 |`)
    continue
  }
  if (ui.limited) {
    // "原版有但受限"的界面 → 同样不计入"缺件"分母，但要把理由写清楚（round-152，DIFF-82 口径）
    lines.push(`| ${ui.name}（受限） | ${grp.length} | — | — | — | — | ➖ ${ui.limited} |`)
    continue
  }
  uiTotal++
  if (grp.length === 0) {
    lines.push(`| ${ui.name} | 0 | — | — | — | — | ⚠️ 无匹配行（可能界面名与矩阵用词不同，需人工核对） |`)
    continue
  }
  const n = (k) => grp.filter((r) => r[k]).length
  const complete = grp.filter((r) => r.hasReal && r.hasClone && r.hasSide && r.hasAssert)
  if (complete.length > 0) uiComplete++
  lines.push(`| ${ui.name} | ${grp.length} | ${n('hasReal')} | ${n('hasClone')} | ${n('hasSide')} | ${n('hasAssert')} | ${complete.length > 0 ? `✅ ${complete.length} 行（如 ${complete[0].id}）` : '❌ 0'} |`)
  detail.push({ ui: ui.name, grp, complete })
}

lines.push('')
lines.push(`## 小计`)
lines.push('')
lines.push(`- 界面清单：**${uiTotal}** 个（另有 ${INTERFACES.length - uiTotal} 个非界面条目，如"快捷键"，不计入分母）；其中**已凑齐四件套**：**${uiComplete}** 个；未凑齐：**${uiTotal - uiComplete}** 个。`)
lines.push('')
lines.push('## 未凑齐的界面——下一步补哪一件')
lines.push('')
const missing = detail.filter((d) => d.complete.length === 0)
if (missing.length === 0) lines.push('（全部界面已凑齐 ✓）')
else {
  lines.push('| 界面 | 组内行数 | 缺什么（按组内计数判断） |')
  lines.push('| --- | --- | --- |')
  for (const d of missing) {
    const n = (k) => d.grp.filter((r) => r[k]).length
    const lack = []
    if (n('hasReal') === 0) lack.push('真机证据')
    if (n('hasClone') === 0) lack.push('复刻版证据')
    if (n('hasSide') === 0) lack.push('并排图')
    if (n('hasAssert') === 0) lack.push('自动断言')
    lines.push(`| ${d.ui} | ${d.grp.length} | ${lack.join(' + ') || '已有单件但未在同一行凑齐'} |`)
  }
}

fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8')
console.log(lines.filter((l) => l.startsWith('|') || l.startsWith('- 界面清单')).join('\n'))
console.log(`\n[已写出] ${path.relative(REPO, outFile)}`)
