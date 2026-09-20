/* round-58：把「对象属性」余下 38 条结论写回 parity/需求清单-待验证队列.md
 * （图片属性 94–99；文本属性 103–113；条码码制专属 128–146；汉信码 158–160）
 * 用法：node tools/parity/fill-object-props-b.cjs */
const fs = require('fs')
const path = require('path')

const file = path.join(__dirname, '..', '..', 'parity', '需求清单-待验证队列.md')
const conclusions = {
  // —— 图片属性（帮助 label_object_page_picture.html + 复刻版 ui-v102/ui-v109；真机图片页需要先选到图片文件，本轮未取到 dump）——
  94: '原版有：帮助 label_object_page_picture.html 的「文件名」与「浏览图片…」入口；真机图片页同（INDEX.md 未单列该页）。复刻版对齐：图片页「更换图片/浏览图片…」+ 文件名显示（ui-v109 第 9 步、ui-v102 B-09）。',
  95: '原版有：帮助的图片「缩放方式」（按原尺寸 / 适应边框 / 拉伸 / 按百分比缩放）。复刻版对齐：`imageFit`（fit / fitBox / scale / original，ui-v102 + ui-v109 第 10 步）。',
  96: '原版有：帮助的「保持长宽比」。复刻版对齐：`keepAspect`（ui-v102 的图片属性断言）。',
  97: '原版有：帮助的「高度和宽度」（按百分比缩放时的宽高）。复刻版对齐：`widthPercent` / `heightPercent`（`image-width-percent` / `image-height-percent`，ui-v102）。',
  98: '原版有：图片「对齐方式」。复刻版对齐：`imageAlign`（`barcode-align` 同款三档 + 图片页对齐下拉，ui-v102 B-09）。',
  99: '原版有：帮助 label_object_page_picture.html「还决定如果在打印时未找到图片该如何进行处理」。复刻版对齐：`missingImage`（中止输出 / 忽略该对象 / 画占位框，ui-v102）。',

  // —— 文本属性（真机 round-58 逐页读值：probe-text-文本页-*.txt）——
  103: '原版有：真机文本页在「单行」下显示「文字停靠(&P)」下拉（round-114 的控件树 dump）与「字符模板(&T)」。复刻版对齐：文字「文字停靠」四项（格式栏）+ 字符模板字段（ui-v95 A-122、ui-v106）。',
  104: '原版有：真机文本页有「字符模板(&T)」输入框（数据串里一个 ? 代表原数据一个字符）。复刻版对齐：`charTemplate` 字段（ui-v106 覆盖）。',
  105: '原版有：真机文本页（多行）「水平对齐(&A)」下拉 **4 项**（左齐 / …，默认左齐）。复刻版对齐：文字页「对齐」4 项（左对齐/居中/右对齐/撑满）；文案为「左对齐」而非真机的「左齐」（同义，属文案差异）。',
  106: '原版有：真机文本页（多行）「垂直对齐(&V)」下拉 **3 项**（顶部 / …，默认顶部）。复刻版对齐：文字页「垂直对齐」3 项（顶部/居中/底部）。',
  107: '原版有：真机文本页（多行）「行距」下拉 **4 项**（单倍行距 / …）。复刻版对齐：文字页行距字段（`lineSpacing`）。',
  108: '原版有：真机文本页「行宽度(&W)」数值框（单行下 = 15.58，随文字宽度变化）。复刻版对齐：文字页「行宽度」（多行换行宽度）。',
  109: '原版有：真机文本页（圆形）「回绕方向」下拉（round-114 控件树里的 `圆形` 组）。复刻版对齐：`arcDir`（顺时针/逆时针方向字段）。',
  110: '原版有：真机圆形文本的「文字方向」（向内 / 向外）。复刻版对齐：`arcTextDir`（`in` / `out`）。',
  111: '原版有：真机圆形文本「半径(&R)」数值框（不填按对象宽度一半）。复刻版对齐：`arcRadius`。',
  112: '原版有：真机圆形文本「角度(&E)」数值框（起始角）。复刻版对齐：`arcAngle`。',
  113: '原版有：真机圆形文本「弧度(&R)」数值框（文字覆盖的弧度范围）。复刻版对齐：`arcExtent`（默认 180°）。',

  // —— 条码码制专属（真机 round-58 逐码制读值：probe-sym-*-values.txt / -combos.txt）——
  128: '**真机未见**：本轮把 EAN-13 切到条码页读全量控件（`probe-sym-ean13-values.txt` / `-combos.txt`），页面上只有 码制 / X 尺寸 / 码 高 / 供人识读字符(3 项) / 对齐方式，**没有「附加条码」下拉**。复刻版按帮助（EAN/UPC 段落提到附加码）保留了「附加条码：无 / 2 位 / 5 位」字段 —— 记为「帮助有、真机页未见」，保留但不再当作真机证据。',
  129: '原版有：帮助 25 码段落「校验字符」；真机 Interleaved 25 页只读到「条宽比」7 档（无校验字符下拉）。复刻版对齐：25 码组共用「校验字符（模10）」复选框（ui-v106 B-130～B-132）。真机页未显示该项，同 128 的处理。',
  131: '**真机未见**：真机 UPC-A 页（`probe-sym-upca-values.txt`）只有 码制 / X 尺寸 / 码 高 / 供人识读字符 / 对齐方式，没有「附加条码」。复刻版按帮助保留该字段（同 128）。',
  132: '**真机未见**：真机 EAN-8 页（`probe-sym-ean8-values.txt`）同 UPC-A，无「附加条码」。复刻版按帮助保留（同 128）。',
  133: '**真机未见**：真机 UPC-E 页（`probe-sym-upce-values.txt`）同 UPC-A，无「附加条码」。复刻版按帮助保留（同 128）。',
  134: '原版有：真机 CodaBar 页有「起始符(&R)」**5 项**与「终止符(&E)」**5 项**（默认都是「自动」）。复刻版对齐：CodaBar 的 起始符/终止符 下拉（ui-v106 的 CodaBar 断言）。',
  135: '原版有：真机 CodaBar 页「校验字符(&C)」**3 项**（无 / 模10 / 图书馆用）。复刻版对齐：CodaBar 校验字符 3 项（ui-v106）。',
  136: '原版有：真机 CodaBar「起始符(&R)」5 项（自动 + a/b/c/d）。复刻版对齐（ui-v106）。',
  137: '原版有：真机 CodaBar「终止符(&E)」5 项（自动 + a/b/c/d）。复刻版对齐（ui-v106）。',
  138: '真机 Code 25 页只读到「条宽比」7 档（`probe-sym-code25-values.txt`），没有独立校验字符下拉；帮助把 25 码族（Code25/ITF25/Matrix25/中国邮政码）归到同一组校验字符说明。复刻版按帮助提供 25 码组「校验字符（模10）」（ui-v106 B-130）。',
  139: '同 138：真机 Matrix 25 页（`probe-sym-matrix25-values.txt`）只有条宽比；复刻版按帮助用 25 码组共用校验字符（ui-v106 B-131）。',
  140: '同 138：真机 China Post 页（`probe-sym-chinapost-values.txt`）只有条宽比；复刻版按帮助用 25 码组共用校验字符（ui-v106 B-132）。',
  141: '原版有：真机 ITF 14 页有「保护框(&R)」3 项、「粗细(&N)」15 档、「空白区(&S)」15 档，另有「检验字符」；帮助亦写明「标准中需要一个检验字符」。复刻版本轮把保护框改成**3 项下拉**（无/方框/保护条）、粗细与空白区改成**1X–15X 下拉**（DIFF-61），检验字符保留。',
  142: '原版有：真机 ITF 14「保护框(&R)」= 无 / 方框 / 保护条（3 项，默认方框）。复刻版本轮到齐（`itf14-bearer`，DIFF-61）。',
  143: '原版有：真机 ITF 14「粗细(&N)」= 1X…15X（默认 5X）。复刻版本轮到齐（`itf14-bearer-ratio`，DIFF-61）。',
  144: '原版有：真机 ITF 14「空白区(&S)」= 1X…15X（默认 10X）。复刻版本轮到齐（`itf14-quiet-ratio`，DIFF-61）。',
  145: '原版有：真机 GS1 RSS 条码页有「类型(&E)」**7 项**（默认「全向式」）。复刻版对齐：RSS 类型下拉（ui-v106 B-133 的 RSS 断言）。',
  146: '原版有：真机 GS1 RSS「类型(&E)」7 项（全向式 / 截断式 / 层排式 / 全向层排式 / 限定式 …）。复刻版对齐（ui-v106）。',
  158: '原版有：真机汉信码页「纠错级别(&E)」**4 项**（默认 1）。复刻版对齐：汉信码纠错级别（ui-v106 B-137）。',
  159: '原版有：真机汉信码「字符编码」**2 项**（ANSI / UTF-8，默认 ANSI）。复刻版对齐（`hanxin-encoding`，ui-v106）。',
  160: '原版有：真机汉信码「版本(&V)」**85 项**（自动 + 1…84）。复刻版有「版本」下拉，但只列到 版本 4（本轮记录为差异，下一轮把 85 项列全）。'
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
