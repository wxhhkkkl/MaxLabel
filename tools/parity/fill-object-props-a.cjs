/* round-57：把「对象属性」已取证的 18 条结论写回 parity/需求清单-待验证队列.md
 * （63/64/65/66/67/68 常规属性 6 条；72/76/77/79 字体属性 4 条；115~122 条码通用 8 条）
 * 用法：node tools/parity/fill-object-props-a.cjs */
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', '..', 'parity', '需求清单-待验证队列.md')
const conclusions = {
  63: '原版有：真机对象属性「常规」页 `旋转(&R)` 下拉 4 项 `0°/90°/180°/270°`（round-57 用 Probe-LabelShopCombos 读回，文字与条码对象都一样）。复刻版对齐：`data-testid=obj-rotation` 4 项同名同序（ui-v125）。',
  64: '原版有：真机 `镜像(&M)` 下拉 **3 项** `无/水平镜像/垂直镜像`。复刻版原先多一个「水平+垂直镜像」（共 4 项），本轮删掉对齐真机（DIFF-56），ui-v125 断言 3 项。',
  65: '原版有：真机 `背景(&B)` 下拉 2 项 `不透明/透明`，**默认选中「透明」**。复刻版本轮把新建文字/条码对象的 `backgroundTransparent` 默认成 true 对齐真机（ui-v125 断言默认值为 transparent）。',
  66: '原版有：真机「常规」页有 `位置锁定(&L)`；帮助 label_object_align_pos.html「位置被锁定的对象不能被移动」+ label_object_page_general.html「使用常规属性页时位置选项被禁止无法更改其数值」「被组合后失去锁定」。复刻版对齐（round-114 的 DIFF-48/49 + ui-v122 五条断言）。',
  67: '原版有：真机「常规」页有 `不打印输出(&N)` 复选框；帮助 label_object_page_general.html「选中不打印输出后此对象在打印机上输出时将不包括……可通过系统设置输出非打印对象」。复刻版对齐（`suppressPrint` + 系统选项「输出非打印对象」，ui-v125 断言该字段存在）。',
  68: '原版有：真机「常规」页有 `对象附加说明(&C)` 输入框；帮助「对象附加说明用于指定标签对象的附加说明，如系统设置了显示对象说明则第一行文字将在对象上显示」。复刻版对齐（`note` 字段 + 查看菜单「显示对象信息」，ui-v125 断言该字段存在）。',
  72: '原版有：真机「字体」页 `大小(&P)` 下拉 **31 项**，顺序为 `8,9,10,11,12,14,16,18,20,22,24,26,28,36,48,72, 初号(42),小初(36),一号(26),小一(24),二号(22),小二(18),三号(16),小三(15),四号(14),小四(12),五号(10.5),小五(9),六号(8),小六(7),七号(5)`。复刻版本轮把原来的纯数字下拉换成同名同序的 31 项（DIFF-58），ui-v125 逐项断言。',
  76: '原版有：真机「字体」页 `字体宽度方向缩放倍数(&H)`（默认 1.00，可输入）。复刻版对齐：字体页「字体宽度缩放倍数」（`fontWidthScale`，ui-v125 断言字段存在）。',
  77: '原版有：真机「字体」页 `字间距(&J)`（默认 0.00 毫米）。复刻版对齐：字体页「字间距」（`charSpacing`，ui-v125 断言字段存在）。',
  79: '原版有：真机「字体」页底部有 `示例` 组（预览当前字体/字号/样式，附「这是TRUETYPE字体，显示与打印完全相同!」）。复刻版本轮补上 `text-font-preview` 预览块（DIFF-58），ui-v125 断言存在。',
  115: '原版有：真机条码页 `X 尺寸(&X)` 是 **61 档下拉**（1.67 mil 起、步长 1.67 mil；当前 10.00 mil）。复刻版有等价控件 `barcode-x-size`，单位同为 mil、默认 10 mil；差别是**复刻版用数值输入框**而不是 61 档下拉（属形态差异，值域一致）。',
  116: '原版有：真机条码页 `码  高(&H)` 数值框（默认 10.00 毫米）。复刻版本轮在条码页补上「码 高（毫米）」输入（绑定对象高度，`barcode-height`），ui-v125 断言存在。',
  117: '原版有：真机条码页 `条宽比(&W)` 下拉 **7 档** `2.00/2.17/2.33/2.50/2.67/2.83/3.00`（仅 2-of-5 类码制显示，Code 128 下该控件 count=0）。复刻版本轮把原来的 3 档（2:1/2.5:1/3:1）扩成同样 7 档。',
  118: '原版有：真机在 EAN/UPC 码制下条码页出现 `缩减量`（与「X 尺寸」同一组）。**复刻版缺口**：属性页没有该项，只有「导出条码图片」对话框里有 `barcode-export-reduction` —— 记为 DIFF-57（下一轮补属性页字段并接到画布/打印路径）。',
  119: '原版有：真机条码页「供人识读字符」组的**位置**下拉 4 项 `默认/无/条码上方/条码下方`（默认「条码下方」）。复刻版本轮补上 `barcode-human-position` 4 项同名同序（DIFF-59），ui-v125 断言。',
  120: '原版有：真机条码页 `垂直偏移(&O)`（默认 0.00 毫米，作用于供人识读字符）。复刻版本轮补上 `barcode-human-offset`（`humanOffsetMm`），ui-v125 断言。',
  121: '原版有：真机条码页 `对齐方式(&A)` 4 项 `左齐/右齐/居中/撑满`（默认「居中」，作用于供人识读字符）。复刻版本轮补上 `barcode-human-align` 4 项同名同序（DIFF-59），ui-v125 断言。',
  122: '原版有：真机条码页有 `字符模板` 输入框。复刻版对齐：对象属性「字符模板」字段（`charTemplate`，帮助「一个 ? 表示原有数据的一个字符」），ui-v106 已覆盖。'
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
