/**
 * 加速键接线进度审计（验收方 round-213 新增）
 *
 * 背景（P3）：真机上 MFC 的 `(&X)` 是**能用的加速键** ✓（我实测 Alt+C 在「选择标签格式」里触发了取消 ✓，
 * 见 parity/reference/labelshop/r189-before/after-alt-c.png）。复刻版目前**只显示不响应** ✗ ——
 * `acceleratorOf()` 在 `app/src/shared/mfcCaption.ts` 里备好了但**零调用** ✗；
 * 而仓库里已有正确范式 ✓：`NewLabelDialog.tsx` 用 `accessKey="o" data-access-suffix="o"` ✓。
 *
 * 本脚本给 P3 一个**可量化的进度指标** ✓：逐个文件统计
 *   ① 含 `(&X)` 的**标题字面量**数量（= 应该接加速键的地方 ✓）
 *   ② `accessKey=` 出现次数（= 已经接上的 ✓）
 *   ③ `data-access-suffix=` 出现次数（= 接上且便于断言的 ✓）
 * 输出按"缺口 = ① − ②"排序，便于一轮轮消 ✗。
 *
 * 用法：node tools/parity/audit-accelerators.cjs [--top 20]
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..')
const ROOT = path.join(REPO, 'app', 'src', 'renderer', 'src')
const args = process.argv.slice(2)
const ti = args.indexOf('--top')
const top = ti >= 0 ? parseInt(args[ti + 1], 10) : 20

function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

const rows = []
for (const f of walk(ROOT)) {
  const src = fs.readFileSync(f, 'utf8')
  const captions = (src.match(/'[^'\n]*\(&[A-Za-z]\)[^'\n]*'/g) || []).length + (src.match(/`[^`\n]*\(&[A-Za-z]\)[^`\n]*`/g) || []).length
  const accessKey = (src.match(/accessKey=/g) || []).length
  const suffix = (src.match(/data-access-suffix=/g) || []).length
  if (captions === 0 && accessKey === 0) continue
  rows.push({ file: path.relative(ROOT, f).replace(/\\/g, '/'), captions, accessKey, suffix, gap: Math.max(0, captions - accessKey) })
}

rows.sort((a, b) => (b.gap - a.gap) || (b.captions - a.captions))
const sum = rows.reduce((a, r) => ({ captions: a.captions + r.captions, accessKey: a.accessKey + r.accessKey, suffix: a.suffix + r.suffix, gap: a.gap + r.gap }), { captions: 0, accessKey: 0, suffix: 0, gap: 0 })

console.log('# 加速键（accessKey）接线进度审计\n')
console.log(`- 全部渲染层文件：标题里含 \`(&X)\` 的字面量 **${sum.captions}** 处 ✓`)
console.log(`- 已接 \`accessKey=\` **${sum.accessKey}** 处 ✓、其中带 \`data-access-suffix=\` 的 **${sum.suffix}** 处 ✓`)
console.log(`- **估算缺口 ${sum.gap} 处** ✗（口径：含加速键的字面量数 − accessKey 数；一个标题也可能对应多个 accessKey，故为估算 ✓）\n`)
console.log('| 文件 | 含 (&X) 的标题 | accessKey | data-access-suffix | 估算缺口 |')
console.log('| --- | --- | --- | --- | --- |')
for (const r of rows.slice(0, top)) console.log(`| \`${r.file}\` | ${r.captions} | ${r.accessKey} | ${r.suffix} | ${r.gap} |`)
console.log(`\n（只列缺口最大的前 ${top} 个文件；共 ${rows.length} 个相关文件）`)
console.log('提示：接法照 `NewLabelDialog.tsx` 的范式 —— `accessKey={acceleratorOf(原文)}` + `data-access-suffix={...}` ✓')
