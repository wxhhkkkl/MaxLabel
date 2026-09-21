/* 把普查出的「四件套缺口清单」变成**可执行工单**：
 *   - 按"缺哪几件"分组统计（缺 1 件的是最便宜的胜利）
 *   - 输出「只缺并排图」的行 → 验收方出图流水线可直接补
 *   - 输出「只缺真机证据」的行 → 需要上真机（按界面聚类）
 * 只读 cov-all.md，写一份 markdown 工单；不碰仓库其它文件。
 * 用法：node tools/parity/build-four-piece-worklist.cjs [--in tools/loop/cov-all.md] [--out parity/P4-四件套工单.md]
 */
const fs = require('fs')
const path = require('path')
const REPO = path.resolve(__dirname, '..', '..')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d }
const inFile = path.resolve(REPO, arg('in', 'tools/loop/cov-all.md'))
const outFile = path.resolve(REPO, arg('out', 'parity/P4-四件套工单.md'))

const lines = fs.readFileSync(inFile, 'utf8').split(/\r?\n/)
const rows = []
for (const line of lines) {
  if (!line.startsWith('|')) continue
  const cells = line.split('|').map((c) => c.trim())
  if (cells.length < 6) continue
  const id = cells[1]
  if (!/^[A-E]-?\d+$/.test(id)) continue
  const missing = cells[3]
  const parts = missing.split('、').map((s) => s.trim()).filter(Boolean)
  rows.push({ id, title: cells[2], missing: parts, source: cells[4] })
}

const bySet = new Map()
for (const r of rows) {
  const key = r.missing.join('+') || '(齐)'
  bySet.set(key, (bySet.get(key) || 0) + 1)
}
const onlyMissing = (name) => rows.filter((r) => r.missing.length === 1 && r.missing[0] === name)
const noRealOnly = onlyMissing('真机证据')
const noSideOnly = onlyMissing('并排图')
const noCloneOnly = onlyMissing('复刻版证据')
const noAssertOnly = onlyMissing('自动断言')

const fmt = (list, limit = 40) => list.slice(0, limit).map((r) => `| ${r.id} | ${r.title.slice(0, 46)} | ${r.source.slice(0, 40)} |`).join('\n')

const md = `# P4「四件套」工单（由普查结果自动生成）

- 数据来源：\`${path.relative(REPO, inFile).replace(/\\/g, '/')}\`（\`node tools/parity/survey-evidence-coverage.cjs --missing-all --out …\`）
- 生成时间：${new Date().toLocaleString('zh-CN')}
- 条目总数：**${rows.length}**（全部未凑齐四件套）

## 一、缺口分布（按"缺哪几件"）

| 缺的件 | 条目数 |
| --- | --- |
${[...bySet.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## 二、最便宜的胜利：只缺**一件**的条目

| 只缺 | 条目数 | 谁来做 |
| --- | --- | --- |
| 并排图 | **${noSideOnly.length}** | 验收方：\`New-ParityShot.ps1\` 出复刻图并拼并排图，再把文件名写进对应矩阵行 |
| 真机证据 | **${noRealOnly.length}** | 需上真机（按界面聚类后一轮拍一批） |
| 复刻版证据 | ${noCloneOnly.length} | 验收方：\`Capture-CloneShot.cjs\`（choose/custom/editor 三场景） |
| 自动断言 | ${noAssertOnly.length} | 循环：补 \`ui-vNNN.cjs\` 断言（照现有加严先例，别只断"存在"） |

## 三、只缺「并排图」的条目（可直接补）

| id | 标题 | 出处 |
| --- | --- | --- |
${fmt(noSideOnly)}

## 四、只缺「真机证据」的条目（需要真机）

| id | 标题 | 出处 |
| --- | --- | --- |
${fmt(noRealOnly)}

## 五、只缺「复刻版证据」的条目

| id | 标题 | 出处 |
| --- | --- | --- |
${fmt(noCloneOnly)}

## 六、只缺「自动断言」的条目

| id | 标题 | 出处 |
| --- | --- | --- |
${fmt(noAssertOnly)}

---

## 使用说明

1. **并排图那条最容易推进**：先用 \`New-ParityShot.ps1 -Round <当前轮次>\` 把已有真机图的界面出成并排图，
   再让循环把文件名写进 \`parity/matrix.md\` 对应行的证据列（**只放文件不算，必须被引用**——普查就是按引用判定的）。
2. 真机证据那条要**按界面聚类**批量拍，避免一轮只拍一个控件。
3. 本工单是"派生文件"，会随普查重跑而更新；**不要**把结论只写在这里，最终的证据引用仍以 \`parity/matrix.md\` 为准。
`
fs.writeFileSync(outFile, md, 'utf8')
console.log(`[worklist] ${path.relative(REPO, outFile)} 已写出`)
console.log(`  只缺并排图 ${noSideOnly.length}｜只缺真机 ${noRealOnly.length}｜只缺复刻图 ${noCloneOnly.length}｜只缺断言 ${noAssertOnly.length}`)
for (const [k, v] of [...bySet.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`  缺「${k}」： ${v}`)
