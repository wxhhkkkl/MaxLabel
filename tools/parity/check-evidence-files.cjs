/**
 * 证据文件存在性审计（验收方 round-114 新增）
 *
 * 动机：矩阵/工单里引用的证据文件名如果**不存在**，普查会把它算成"有证据"，
 * 于是覆盖率是假的。这个脚本把 matrix.md 里所有 `parity/...` 形式的引用抽出来逐个 existence 检查。
 *
 * 用法：node tools/parity/check-evidence-files.cjs [--show-ok]
 *   退出码：0 = 全部存在；1 = 有引用指向不存在的文件
 */
const fs = require('fs')
const path = require('path')

const repo = path.resolve(__dirname, '..', '..')
const matrixPath = path.join(repo, 'parity', 'matrix.md')
const showOk = process.argv.includes('--show-ok')

const text = fs.readFileSync(matrixPath, 'utf8')
// 抓 (tools/)parity/... 直到空白或中文标点/括号/引号结束（文件名里可能含 - _ . 数字）
// 注意：**必须连 `tools/` 前缀一起抓** —— 只抓 `parity/...` 会把 `tools/parity/scenarios/x.json` 截成
// `parity/scenarios/x.json`（不存在的路径），于是报一堆假缺失（round-114 我自己踩过）。
const RE = /(?:tools\/)?parity\/[A-Za-z0-9._\-\u4e00-\u9fa5/]+\.(?:png|txt|md|json|cjs|ps1|log|pdf)/g

const refs = new Map() // 文件 → 出现在哪些行号
const lines = text.split(/\r?\n/)
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(RE)
  if (!m) continue
  for (const raw of m) {
    const clean = raw.replace(/[.,;:）)】」”"']+$/, '')
    if (!refs.has(clean)) refs.set(clean, [])
    refs.get(clean).push(i + 1)
  }
}

const missing = []
const ok = []
for (const [f, where] of refs) {
  const p = path.join(repo, f.replace(/\//g, path.sep))
  if (fs.existsSync(p)) ok.push([f, where])
  else missing.push([f, where])
}

console.log(`[evidence-audit] matrix.md 里引用到的文件：${refs.size} 个（存在 ${ok.length} / 缺失 ${missing.length}）`)
if (missing.length) {
  console.log('\n缺失的文件引用（这些引用会让覆盖率虚高，请修）：')
  for (const [f, where] of missing.sort()) console.log(`  ✗ ${f}   ← 行 ${where.slice(0, 8).join(', ')}${where.length > 8 ? ' …' : ''}`)
}
if (showOk && ok.length) {
  console.log('\n存在的引用：')
  for (const [f, where] of ok.sort()) console.log(`  ✓ ${f}   ← 行 ${where.slice(0, 4).join(', ')}${where.length > 4 ? ' …' : ''}`)
}
process.exit(missing.length ? 1 : 0)
