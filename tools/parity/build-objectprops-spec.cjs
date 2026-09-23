/**
 * 从真机控件树 dump 生成「对象属性」四页对照表（验收方 round-201 新增）
 *
 * 为什么要它：P1 要按真机对齐对象属性四页，而**最可靠的依据是控件树 dump**（控件类/精确文案/坐标/可见性），
 * 不是截图判读 ✗（我已经因为看截图误判过两次 ✗）。
 * 本脚本把 dump 里的**每个抓取块**整理成一张表：块内**可见**（`[V]`）的控件 → class + 精确 text + 坐标大小，
 * 并按"块里出现了哪些页特征控件"自动标出这一块是哪一页 ✓。
 *
 * 用法：node tools/parity/build-objectprops-spec.cjs
 *   → 写出 parity/P1-对象属性对照表.md
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..')
const DUMPS = [
  'probe-60-barcode-props-tree.txt',   // 条码属性（数据源/条码/字体/常规 多块 ✓）
  'probe-37-text-props-tree.txt',      // 文字属性·数据源页（含底排四按钮 ✓）
  'probe-44-two-objects-tree.txt',     // 常规页那一组 ✓
  'probe-48-serial-tree.txt',          // 序列号/字符模板相关 ✓
  // round-201 验收方**新补**的两份（补上原先缺的 字体页 / 文本页 ✓）
  'probe-r201-textprops-font-tree.txt',// 文字属性·**字体页**（字体名称/样式/大小/特殊效果/示例/底排四按钮 ✓）
  'probe-r201-textprops-text-tree.txt',// 文字属性·**文本页**（单行/多行/圆形 单选、水平对齐、行宽度、字符模板… ✓）
]
const OUT = path.join(REPO, 'parity', 'P1-对象属性对照表.md')

/** 页特征：某页独有的控件文案（用来判断这一块是哪一页） */
const PAGE_MARKS = [
  ['数据源页', ['子串列表', '子串选项', '变量共享名称']],
  ['字体页', ['字体名称', '字体样式', '字体宽度方向缩放倍数', '特殊效果']],
  ['常规页', ['对象名称标识', '图层：', '旋转(&R)', '位置锁定', '不打印输出']],
  ['文本页', ['单行', '多行', '圆形', '水平对齐', '行宽度']],
  ['条码页', ['条码符号类型', '条码特殊选项', '供人识读字符', 'X 尺寸']],
]

const blocks = []
for (const name of DUMPS) {
  const p = path.join(REPO, 'parity', 'reference', 'labelshop', name)
  if (!fs.existsSync(p)) { console.log('[spec] 缺文件，跳过：' + name); continue }
  const raw = fs.readFileSync(p, 'utf8').split(/\r?\n/)
  let cur = null
  for (const line of raw) {
    // 宽松匹配（文件可能带 BOM，或标记行前后有空格的差异 ✗）
    if (/WINDOW\s+'/.test(line)) { cur = { header: `${name} :: ${line.trim()}`, lines: [] }; blocks.push(cur); continue }
    if (cur) cur.lines.push(line)
  }
}

const parse = (line) => {
  const m = /^\[(.)\]\s+class=(\S+)\s+(\S+)\s+text='([^']*)'\s+xy=\((-?\d+),(-?\d+)\)\s+wh=\((\d+)x(\d+)\)/.exec(line.trim())
  if (!m) return null
  return { visible: m[1] === 'V', cls: m[2], state: m[3], text: m[4], x: +m[5], y: +m[6], w: +m[7], h: +m[8] }
}

const lines = []
lines.push('# P1「对象属性」四页对照表（由真机控件树 dump 自动生成）')
lines.push('')
lines.push(`- 生成时间：${new Date().toLocaleString('zh-CN')}`)
lines.push(`- **权威来源**：\`parity/reference/labelshop/probe-60-barcode-props-tree.txt\`（真机「条码属性」对话框的控件树 dump ✓）`)
lines.push('- 口径：只列每块里 **`[V]` = 可见** 的控件 ✓（`[ ]` 表示该状态下不显示 ✓ —— 这正好能回答"某个模式下该不该出现某控件"）')
lines.push('- 用途：P1 按它对齐 —— **控件类名**决定用什么控件 ✓、**text** 是逐字文案（含 `(&X)` 加速键）✓、坐标顺序决定排布 ✓')
lines.push('')

blocks.forEach((b, i) => {
  const items = b.lines.map(parse).filter(Boolean)
  const vis = items.filter((it) => it.visible)
  const all = items.map((it) => it.text).join(' ')
  const page = PAGE_MARKS.find(([, marks]) => marks.some((m) => all.includes(m)))
  lines.push(`## 块 ${i + 1}：${page ? page[0] : '（未能判定页名）'}`)
  lines.push('')
  lines.push(`> 该块共 ${items.length} 个控件，其中可见 ${vis.length} 个 ✓`)
  lines.push('')
  lines.push('| 控件类 | 文案（逐字） | 坐标 | 大小 |')
  lines.push('| --- | --- | --- | --- |')
  for (const it of vis.sort((a, z) => (a.y - z.y) || (a.x - z.x))) {
    lines.push(`| \`${it.cls}\` | ${it.text ? '`' + it.text + '`' : '—'} | (${it.x},${it.y}) | ${it.w}×${it.h} |`)
  }
  lines.push('')
})

fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8')
console.log(`[spec] 共 ${blocks.length} 个抓取块 → ${path.relative(REPO, OUT)}`)
for (const [i, b] of blocks.entries()) {
  const items = b.lines.map(parse).filter(Boolean)
  const vis = items.filter((it) => it.visible)
  const all = items.map((it) => it.text).join(' ')
  const page = PAGE_MARKS.find(([, marks]) => marks.some((m) => all.includes(m)))
  console.log(`  块 ${i + 1} → ${page ? page[0] : '未知'}（可见 ${vis.length}/${items.length}）`)
}
