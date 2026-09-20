/* round-115：把「其它」8 条的取证结论写回 parity/需求清单-待验证队列.md
 * 用法：node tools/parity/fill-others.cjs */
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', '..', 'parity', '需求清单-待验证队列.md')
const conclusions = {
  270: '原版有：真机文件菜单有「分享(I)...」，未登录时置灰（INDEX.md 50 图 / PROBE-round108 的菜单项清单，位置紧随「另存为(A)...」）；帮助说明云模板保存/分享需要登录。复刻版对齐：文件菜单同一位置有「分享(I)...」（未登录禁用），登录后打开云模板对话框（`ui-v124` 两条断言）。',
  271: '原版有：帮助 shortcut_main.html 撤消/重做分组「CTRL+Z 撤消上步操作」「CTRL+Y 重做撤消的操作」，编辑菜单标注同为 Ctrl+Z / Ctrl+Y（INDEX.md 51 图「撤销(U) Ctrl+Z / 恢复(R) Ctrl+Y」）。复刻版对齐：连造对象后 Ctrl+Z 对象数 1→0、Ctrl+Y 回到 1（`ui-v124` + 单测 `document-history.test.ts` 9 条）。（本条清单的「单元=UNDO/REDO、功能=分享」两栏疑似错位，按撤销/恢复取证。）',
  272: '原版有：查看菜单「标签旋转 ▶」子菜单四项——正常显示 / 左旋90度 / 右旋90度 / 旋转180度（INDEX.md 52 图）。复刻版对齐：子菜单四项同名同序，左旋 90 度把板面按逆时针渲染（CSS 矩阵 b<0）、正常显示复位（`ui-v124`；另有 ui-v91 A-50、ui-v79 C-88/C-89）。',
  273: '原版有：查看菜单「放大(I) Ctrl+=」（INDEX.md 52 图），工具菜单也有「放大(I)」。复刻版对齐：查看菜单放大项把显示比例调大（`ui-v124` 断言比例变大；另有 ui-v91、ui-v86 工具菜单路径）。',
  274: '原版有：查看菜单「缩小(O) Ctrl+-」；工具菜单「缩小(O)」。复刻版对齐：缩小项把比例调小（`ui-v124`；另有 ui-v86 A-249）。',
  275: '原版有：查看菜单「撑满窗口(W) Ctrl+Alt+0」；工具菜单「适合窗口(W)」。复刻版对齐：进入窗口适应模式（data-zoom-mode=win，`ui-v124`；另有 ui-v86 A-252、ui-v79 C-87、ui-v93 A-119）。',
  280: '原版有：真机「关于」对话框（INDEX.md 66-dlg-about.png）为「程序图标 + 产品名 [ 标准版 - 未激活 ] (6.39.2511) 32位 + 产品ID: 未激活 + 按钮『激活』+ 二维码 + 公司行 + 官网链接 + 两行版权敬告 + 确定」；账户菜单另有「账号和授权管理...」（未登录禁用）。复刻版本轮按同一骨架重做「关于」（DIFF-54）：版本行取真实应用版本、产品ID 跟随授权状态、二维码用内置码制生成指向项目主页、「激活」按钮切到「授权与激活」对话框（`ui-v124` 三条断言）。',
  282: '原版有：表格对象（帮助 label_object_page_table.html）支持行高/列宽/边框宽度与颜色/合并单元格，并提示单元格「不能直接排入文字、条码」等对象。复刻版对齐：对象属性「表格」页含行高、列宽（逐行/逐列输入）、边框宽度与颜色、合并单元格（起点/终点 + 应用/取消）、以及「不能直接排入…」提示（`ui-v124`；另有 ui-v102 B-106/B-107、ui-v76 B-43、ui-v116 表格完整性）。'
}

const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
let filled = 0
for (let i = 0; i < lines.length; i += 1) {
  const match = /^\|\s*(\d+)\s*\|/.exec(lines[i])
  if (!match) continue
  const row = Number(match[1])
  const conclusion = conclusions[row]
  if (!conclusion) continue
  const cells = lines[i].split('|')
  if (cells.length < 4) continue
  if (!/待填/.test(cells[cells.length - 2])) continue
  cells[cells.length - 2] = ' ' + conclusion + ' '
  lines[i] = cells.join('|')
  filled += 1
}
if (!filled) { console.error('没有匹配到待填行'); process.exit(1) }
fs.writeFileSync(file, lines.join('\r\n'), 'utf8')
console.log(`已填 ${filled} 条结论`)
