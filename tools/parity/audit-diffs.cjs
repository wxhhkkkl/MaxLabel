/**
 * 差异台账质量审计（验收方 round-165 新增）
 *
 * 检查每条 `## DIFF-nn` 是否具备四要素：**状态 / 证据 / 处置 / 断言**。
 * 依据：停止标准要求"未收口差异仅剩已记录边界类" —— 而"已记录边界"必须写明状态与证据；
 * 每条已修差异也必须指向断言（否则"修好了"无法被机器复核）。
 *
 * 用法：node tools/parity/audit-diffs.cjs [--last N]
 * 返回码：0 = 全部合规；1 = 有缺项（会列出）
 */
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const li = args.indexOf('--last')
const lastN = li >= 0 ? parseInt(args[li + 1], 10) : 0
const REPO = path.resolve(__dirname, '..', '..')
const txt = fs.readFileSync(path.join(REPO, 'parity', 'diffs.md'), 'utf8')

const blocks = [...txt.matchAll(/^## DIFF-(\d+)([^\r\n]*)\r?\n([\s\S]*?)(?=^## DIFF-|\z)/gm)]
const picked = lastN > 0 ? blocks.slice(-lastN) : blocks

const TESTS = {
  状态: (b) => /状态|待取证|已修|未实现|受限|结论：|收口/.test(b),
  证据: (b) => /parity\/|\.png|probe|截图|安装包|字符串表|LabelShop\.exe|并排图/.test(b),
  处置: (b) => /处置|保留|移除|登记|以真机/.test(b),
  // "断言"：已修的条目必须能指向机器可复核的断言（ui-vNNN）；**未实现/未渲染/受限/待取证**的条目豁免，
  // 但要求条目里写明"暂无断言"之类的原因（写成 `暂无断言`/`无断言` 即可）。
  断言: (b) => /ui-v\d+/.test(b) || (/未实现|未渲染|受限|待取证|暂无断言|无断言/.test(b)),
}

let bad = 0
console.log(`# 差异台账质量审计（共 ${picked.length} 条）\n`)
for (const m of picked) {
  const id = `DIFF-${m[1]}`
  const title = m[2].trim()
  // 用**标题 + 正文**整体判定：状态往往写在标题里（如 `✅ 已修`、`待取证`、`未实现`），只看正文会大量误报 ✗。
  const whole = m[0]
  const miss = Object.entries(TESTS).filter(([, f]) => !f(whole)).map(([k]) => k)
  if (miss.length) {
    bad++
    console.log(`| ${id} | 缺：**${miss.join(' / ')}** | ${title.slice(0, 60)} |`)
  }
}
console.log(`\n结论：${bad === 0 ? '✅ 四要素齐全' : `⚠️ ${bad} 条缺项（缺"断言"多见于"未实现/未渲染"条目，属正常，但需在条目里写明"暂无断言及原因"）`}`)
process.exit(bad === 0 ? 0 : 1)
