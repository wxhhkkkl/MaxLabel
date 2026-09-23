/*
 * 验收方工装：矩阵「证据四件套」覆盖度普查（Phase 3/4 的记分卡基线）。
 *
 * 背景：矩阵 605 条全部标「已实现」并不等于"像原版"（用户实测反馈证明了这点）。
 * 所以第二阶段换口径：每条（或每个帮助页/界面）最好都同时具备
 *   ① 真机证据（parity/reference/labelshop 下的截图/dump）
 *   ② 复刻版证据（parity/reference/maxlabel）
 *   ③ 并排对照图（parity/review）
 *   ④ 自动断言（app/scripts/ui-v*.cjs 或 npm test:* 的用例名）
 * 本脚本把 `parity/matrix.md` 每一行的「证据」列里**真实存在的**文件名解析出来，
 * 与磁盘上的资产清单做存在性比对，输出覆盖率与缺口清单。
 *
 * 用法：
 *   node tools/parity/survey-evidence-coverage.cjs                # 打印摘要 + 缺口样例
 *   node tools/parity/survey-evidence-coverage.cjs --out <文件>    # 同时写出完整 markdown
 *   node tools/parity/survey-evidence-coverage.cjs --missing-all   # 列出全部缺口行（不截断）
 * 只读：只读 matrix.md 与目录清单，不写仓库文件（--out 由调用者指定路径）。
 */
const fs = require('fs')
const path = require('path')

const REPO = path.resolve(__dirname, '..', '..')
const args = process.argv.slice(2)
const outIdx = args.indexOf('--out')
const outFile = outIdx >= 0 ? args[outIdx + 1] : null
const missingAll = args.includes('--missing-all')

function listFiles(dir) {
  try { return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name) }
  catch { return [] }
}
const lower = (s) => s.toLowerCase()
const sets = {
  real: new Set(listFiles(path.join(REPO, 'parity', 'reference', 'labelshop')).map(lower)),
  clone: new Set(listFiles(path.join(REPO, 'parity', 'reference', 'maxlabel')).map(lower)),
  side: new Set(listFiles(path.join(REPO, 'parity', 'review')).map(lower)),
  ui: new Set(listFiles(path.join(REPO, 'app', 'scripts')).map(lower)),
  scenario: new Set(listFiles(path.join(REPO, 'tools', 'parity', 'scenarios')).map(lower))
}

const matrix = fs.readFileSync(path.join(REPO, 'parity', 'matrix.md'), 'utf8').split(/\r?\n/)
const rows = []
for (const line of matrix) {
  if (!line.startsWith('|')) continue
  const cells = line.split('|').map((c) => c.trim())
  // 正常行：| id | 标题 | 描述 | 出处 | 状态 | 证据 |  → 8 段（首尾空串）
  // 少数行末尾少了最后一个竖线 → 7 段；极少数行证据列里带竖线 → 段数更多，故证据取「第 6 段到倒数第 2 段」的拼接
  if (cells.length < 7) continue
  const id = cells[1]
  if (!/^[A-E]-?\d+/.test(id)) continue
  const evidence = (cells.length === 7 ? cells[6] : cells.slice(6, cells.length - 1).join(' | '))
  rows.push({ id, title: cells[2], source: cells[4] || '', status: cells[5] || '', evidence })
}

const tokenRe = /[A-Za-z0-9_\-.\u4e00-\u9fff]+\.(?:png|jpg|jpeg|txt|json|md)\b|ui-v\d+\.cjs|test:[a-z\-]+/gi
function classify(row) {
  const blob = `${row.evidence} ${row.source}`
  const tokens = (blob.match(tokenRe) || []).map((t) => t.trim())
  const hit = { real: [], clone: [], side: [], assert: [] }
  for (const t of tokens) {
    const b = lower(path.basename(t))
    if (sets.real.has(b)) hit.real.push(b)
    if (sets.clone.has(b)) hit.clone.push(b)
    if (sets.side.has(b)) hit.side.push(b)
    if (sets.ui.has(b) || lower(t).startsWith('test:')) hit.assert.push(t)
  }
  // round-166 新增：**部分覆盖**标记 —— 引用文本里写了"（部分"（或"部分："）时，
  // 说明该条只主张图里可见的那一部分（例如"子菜单未展开"、"其它码制此图未呈现"）✗
  // → 这种引用**不计入"完整四件套"** ✓，另立一列 partial 以便如实展示（避免覆盖率虚高）。
  const partial = /（部分|\(部分|部分：/.test(blob)
  return {
    ...row,
    partial,
    has: {
      real: hit.real.length > 0 && !partial,
      clone: hit.clone.length > 0 && !partial,
      side: hit.side.length > 0 && !partial,
      assert: hit.assert.length > 0 && !partial
    },
    hasPartial: {
      real: hit.real.length > 0 && partial,
      clone: hit.clone.length > 0 && partial,
      side: hit.side.length > 0 && partial,
      assert: hit.assert.length > 0 && partial
    },
    hits: hit
  }
}
const results = rows.map(classify)

const counts = { total: results.length, real: 0, clone: 0, side: 0, assert: 0, all4: 0, partialOnly: 0 }
for (const r of results) {
  if (r.has.real) counts.real++
  if (r.has.clone) counts.clone++
  if (r.has.side) counts.side++
  if (r.has.assert) counts.assert++
  if (r.has.real && r.has.clone && r.has.side && r.has.assert) counts.all4++
  else if (r.partial && (r.hasPartial.real || r.hasPartial.clone || r.hasPartial.side)) counts.partialOnly++
}
const modules = {}
for (const r of results) {
  const m = r.id[0]
  modules[m] = modules[m] || { total: 0, real: 0, clone: 0, side: 0, assert: 0, all4: 0 }
  const a = modules[m]
  a.total++
  if (r.has.real) a.real++
  if (r.has.clone) a.clone++
  if (r.has.side) a.side++
  if (r.has.assert) a.assert++
  if (r.has.real && r.has.clone && r.has.side && r.has.assert) a.all4++
}

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) + '%' : '—')
const lines = []
lines.push('# 矩阵证据四件套覆盖度（验收方普查）')
lines.push('')
lines.push(`- 生成时间：${new Date().toLocaleString('zh-CN')}`)
lines.push(`- 资产：真机 ${sets.real.size} / 复刻 ${sets.clone.size} / 并排 ${sets.side.size} / UI 脚本 ${sets.ui.size} / 场景 ${sets.scenario.size}`)
lines.push('')
lines.push(`- **口径说明（round-166 加严）**：引用文本里标了"（部分…"的行（例如"子菜单未展开"、"其它码制此图未呈现"）**不计入"四件套齐"** ✓ ——`)
lines.push(`  这类"部分覆盖"共 **${counts.partialOnly}** 行，单列在下方缺口清单里，避免覆盖率虚高。`)
lines.push('')
lines.push('| 范围 | 条目数 | 有真机证据 | 有复刻版证据 | 有并排图 | 有自动断言 | 四件套齐 |')
lines.push('| --- | --- | --- | --- | --- | --- | --- |')
lines.push(`| 全矩阵 | ${counts.total} | ${counts.real}（${pct(counts.real, counts.total)}） | ${counts.clone}（${pct(counts.clone, counts.total)}） | ${counts.side}（${pct(counts.side, counts.total)}） | ${counts.assert}（${pct(counts.assert, counts.total)}） | ${counts.all4}（${pct(counts.all4, counts.total)}） |`)
for (const m of Object.keys(modules).sort()) {
  const a = modules[m]
  lines.push(`| ${m} 模块 | ${a.total} | ${a.real}（${pct(a.real, a.total)}） | ${a.clone}（${pct(a.clone, a.total)}） | ${a.side}（${pct(a.side, a.total)}） | ${a.assert}（${pct(a.assert, a.total)}） | ${a.all4}（${pct(a.all4, a.total)}） |`)
}
lines.push('')
const gaps = results.filter((r) => !(r.has.real && r.has.clone && r.has.side && r.has.assert))
lines.push(`## 缺口清单（${gaps.length} 条未凑齐四件套）`)
lines.push('')
lines.push('| 条目 | 标题 | 缺 | 出处 |')
lines.push('| --- | --- | --- | --- |')
const show = missingAll ? gaps : gaps.slice(0, 40)
for (const g of show) {
  const miss = []
  if (!g.has.real) miss.push('真机证据')
  if (!g.has.clone) miss.push('复刻版证据')
  if (!g.has.side) miss.push('并排图')
  if (!g.has.assert) miss.push('自动断言')
  lines.push(`| ${g.id} | ${g.title.slice(0, 28)} | ${miss.join('、')} | ${g.source.slice(0, 60)} |`)
}
if (!missingAll && gaps.length > show.length) lines.push(`| … | 还有 ${gaps.length - show.length} 条（用 --missing-all 看全） | | |`)

const text = lines.join('\n')
console.log(text)
if (outFile) {
  fs.writeFileSync(outFile, text, 'utf8')
  console.log(`\n[已写出] ${outFile}`)
}
