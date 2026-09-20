/* round-114：把「对象编辑」15 条的取证结论写回 parity/需求清单-待验证队列.md
 * 用法：node tools/parity/fill-object-edit.mjs
 * 只替换行首为 `| <行号> |` 的那一行的最后一个单元格（（待填））。 */
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', '..', 'parity', '需求清单-待验证队列.md')
const conclusions = {
  38: '原版有：帮助 label_object_select_mouse.html「按住CTRL键单击选取，可以选择多个对象」；复刻版对齐（ui-v122「38 CTRL+单击追加选取」，另有 ui-v88 的 B-10）。',
  39: '原版有：同页「按住SHIFT键单击选取，可以选择/择选对象」（并记载空白处拖动圈选）；复刻版对齐（ui-v122「39 SHIFT+单击切换选择」+ ui-v88 B-11 的圈选断言）。',
  40: '原版有：帮助 shortcut_main.html 拷贝粘贴分组「CTRL+C 复制当前选取的对象到系统剪切板」「CTRL+V 粘贴系统剪切板上的内容到当前模板」——同模板与跨模板都能粘贴；复刻版对齐（ui-v122 两条：同模板复制粘贴数量 +1、新标签模板里 CTRL+V 得到剪贴板对象，粘贴件带新 id）。',
  41: '原版有：shortcut_main.html「CTRL+X 剪切当前选取的对象到系统剪切板」，剪切键位另有 SHIFT+DELETE；复刻版对齐（ui-v122 两条：CTRL+X 与 SHIFT+DELETE 剪切后数量 -1 且都能 CTRL+V 还原）。',
  42: '原版未见：原版帮助快捷键页没有 CTRL+拖动 这一组合（拷贝粘贴分组只有 CTRL+C/V/X 与 SHIFT+DELETE），真机鼠标拖动在现有工装下也无法验证；复刻版按「不复制副本、只移动」处理（ui-v122 断言对象数不变）。若真机实测为复制，需要照改。',
  45: '原版有：帮助 label_object_move_mouse.html「可以使用鼠标直接拖动选取的对象来移动对象的位置」；复刻版对齐（ui-v122 断言位移≈拖动量且尺寸不变）。本轮修掉了「一次纯拖动就把对象框改成渲染内容尺寸」的缺陷（见 parity/diffs.md DIFF-47）。',
  46: '原版有：label_object_move_key.html「可以通过 UP、DOWN、LEFT 和 RIGHT 键直接移动被选取的对象的位置」+ shortcut_main.html 移动对象分组（0.5 毫米，SHIFT 5 毫米）；复刻版对齐（ui-v122 断言 LEFT=-0.5mm、SHIFT+RIGHT=+5mm）。',
  47: '原版有：label_object_size.html（尺寸按步长离散、SHIFT 使水平垂直一致、拖角把柄保字体高宽比而拖中间把柄成「长扁字」）；复刻版对齐（ui-v76 的 B-15/B-16 + 单测 constrainFabricResize/snapResizeMm）。',
  54: '原版有：label_object_align_order.html（移到最前 / 前移 / 后移 / 移到最后）；复刻版对齐（ui-v122「排列菜单移到最前」+ ui-v96 A-62 + ui-v99 A-160…A-163 的四项层序）。',
  55: '原版有：shortcut_main.html 排列对象分组「CTRL+B 将当前选取的对象移到最后」；复刻版对齐（ui-v122 断言选中对象变成图层表最后一行；ui-v96 断言菜单快捷键标注为 Ctrl+B）。',
  56: '原版有：label_object_align_rotate.html（左旋90度 / 旋转180度 / 右旋90度，参考点为对象中心）；复刻版对齐（ui-v122 断言 rotation=90 且中心不动；ui-v96 A-62 断言左旋=270）。',
  57: '原版有：同页「当多个对象被同时旋转时，将以所有被选取对象组合后的中心点为参考点进行旋转」；复刻版对齐（ui-v99 A-152/A-154 断言多选绕视觉中心、ui-v75 B-26）。',
  58: '原版有：label_object_align_group.html（组合后单击组中任意对象即选中整组、被组合对象的属性不可直接改）；复刻版对齐（ui-v122 三条：CTRL+G 组合、单击组内子对象选中整组、多级嵌套组合；ui-v95 A-134）。',
  59: '原版有：label_object_align_group.html「排列菜单中的取消组合命令用于将组合在一起的对象拆开」；复刻版对齐（ui-v122 断言逐层拆开并还原为顶层对象；ui-v95 A-136）。',
  60: '原版有：label_object_align_pos.html「位置被锁定的对象不能被移动」+ label_object_page_general.html「使用常规属性页时位置选项被禁止无法更改其数值」「如果一个锁定的对象被组合，对象将失去位置锁定属性」；复刻版本轮补齐两项（DIFF-48 锁定未拦住方向键/对齐命令与属性页；DIFF-49 组合后未清锁定），ui-v122 五条断言（拖动/方向键/对齐无效、属性页 X/Y 与水平垂直位置禁用、解锁恢复、组合后失去锁定）。'
}

const text = fs.readFileSync(file, 'utf8')
const lines = text.split(/\r?\n/)
let filled = 0
for (let i = 0; i < lines.length; i += 1) {
  const match = /^\|\s*(\d+)\s*\|/.exec(lines[i])
  if (!match) continue
  const row = Number(match[1])
  const conclusion = conclusions[row]
  if (!conclusion) continue
  const cells = lines[i].split('|')
  // 行形如 `| 38 | ... | 不能实现 | （待填） |`：split 后首尾为空串，末两格是标记与结论
  if (cells.length < 4) continue
  if (!/待填/.test(cells[cells.length - 2])) continue
  cells[cells.length - 2] = ' ' + conclusion + ' '
  lines[i] = cells.join('|')
  filled += 1
}
if (!filled) { console.error('没有匹配到待填行'); process.exit(1) }
fs.writeFileSync(file, lines.join('\r\n'), 'utf8')
console.log(`已填 ${filled} 条结论`)
