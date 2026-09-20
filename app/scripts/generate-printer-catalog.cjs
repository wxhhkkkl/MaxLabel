/*
 * 由真机取证产物生成「可安装的打印机」目录：
 *   - parity/reference/labelshop/probe-08-install-list.txt  （真机「安装 LabelShop 打印机」列表的全部行）
 *   - parity/reference/labelshop/probe-10-install-filter.txt（真机该对话框的品牌过滤下拉全部条目）
 * 输出：app/src/shared/domain/printerCatalog.generated.ts
 *
 * 用法：node app/scripts/generate-printer-catalog.cjs
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const LIST = path.join(ROOT, 'parity', 'reference', 'labelshop', 'probe-08-install-list.txt')
const FILTER = path.join(ROOT, 'parity', 'reference', 'labelshop', 'probe-10-install-filter.txt')
const OUT = path.join(ROOT, 'app', 'src', 'shared', 'domain', 'printerCatalog.generated.ts')

function readLines(file) {
  const buf = fs.readFileSync(file)
  // PowerShell 5.1 的 `*>` 重定向写 UTF-16LE（BOM FF FE），Set-Content -Encoding UTF8 写 UTF-8（BOM EF BB BF）
  let text
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) text = buf.toString('utf16le')
  else text = buf.toString('utf8').replace(/^\uFEFF/, '')
  return text.split(/\r?\n/)
}

// 「全部」+ 38 个品牌过滤项
const filter = readLines(FILTER)
  .filter((line) => /^\s*\| /.test(line))
  .map((line) => line.replace(/^\s*\| /, '').trim())
  .filter(Boolean)

// 125 行可安装打印机
const rows = []
for (const line of readLines(LIST)) {
  const m = /^\s*(\d+) \| (.+?) \|/.exec(line)
  if (!m) continue
  const display = m[2].trim()
  if (!display) continue
  const dm = /^(.*?)\s*\((\d+)\s*dpi\)$/.exec(display)
  rows.push({ name: display, base: dm ? dm[1].trim() : display, dpi: dm ? Number(dm[2]) : 0 })
}

// 品牌英文别名 → 过滤项标签
const brandLabels = filter.filter((x) => x !== '全部')
const ALIAS_OVERRIDE = {
  ZY: '中盈科技 (ZhongYing)',
  Postek: '博思得 (POSTEK)',
  Printronix: '普印力 (PRINTRONIX)',
  'TOSHIBA-TEC': '东芝泰格 (TEC)',
  TSC: 'TSC / Zenpert',
  Zenpert: 'TSC / Zenpert'
}
function aliasesOf(label) {
  const out = []
  const bare = label.trim()
  if (!/[()/（]/.test(bare)) out.push(bare)
  const pushSplit = (s) => { for (const part of s.split('/')) { const p = part.trim(); if (p) out.push(p) } }
  for (const m of bare.matchAll(/[（(]([^)）]+)[)）]/g)) pushSplit(m[1])
  for (const part of bare.split('/')) {
    const p = part.trim()
    if (!p) continue
    if (!/[()/（]/.test(p) && !/^[\u4e00-\u9fa5]+$/.test(p)) out.push(p)
    const inner = /[（(]([^)）]+)[)）]/.exec(p)
    if (inner) pushSplit(inner[1])
  }
  return [...new Set(out.filter(Boolean))]
}

const brandByAlias = new Map()
for (const label of brandLabels) {
  for (const alias of aliasesOf(label)) brandByAlias.set(alias.toLowerCase(), label)
}
for (const [alias, label] of Object.entries(ALIAS_OVERRIDE)) brandByAlias.set(alias.toLowerCase(), label)

const catalog = []
const unmapped = new Set()
for (const row of rows) {
  // 名称形如 "<品牌> <型号-指令集> (dpi)"；品牌可能含空格（TOSHIBA-TEC / XPrinter）
  const parts = row.base.split(/\s+/)
  let brand = parts[0]
  let rest = parts.slice(1).join(' ')
  const twoWord = parts.length > 2 ? parts.slice(0, 2).join(' ') : ''
  if (twoWord && brandByAlias.has(twoWord.toLowerCase())) { brand = twoWord; rest = parts.slice(2).join(' ') }
  let label = brandByAlias.get(brand.toLowerCase())
  if (!label) {
    // 再试「品牌」取整段前缀（逐词增长）
    for (let n = parts.length - 1; n >= 1; n--) {
      const cand = parts.slice(0, n).join(' ')
      if (brandByAlias.has(cand.toLowerCase())) { label = brandByAlias.get(cand.toLowerCase()); brand = cand; rest = parts.slice(n).join(' '); break }
    }
  }
  if (!label) unmapped.add(brand)
  const mm = /^(.+?)-([A-Za-z0-9]+)$/.exec(rest)
  catalog.push({
    id: `ls-${String(catalog.length + 1).padStart(3, '0')}`,
    name: row.name,
    brand,
    brandLabel: label ?? '',
    model: mm ? mm[1] : rest,
    commandSet: mm ? mm[2] : '',
    dpi: row.dpi
  })
}

const body = catalog.map((r) => `  { id: ${JSON.stringify(r.id)}, name: ${JSON.stringify(r.name)}, brand: ${JSON.stringify(r.brand)}, brandLabel: ${JSON.stringify(r.brandLabel)}, model: ${JSON.stringify(r.model)}, commandSet: ${JSON.stringify(r.commandSet)}, dpi: ${r.dpi} }`).join(',\n')

const out = `// Generated from parity/reference/labelshop/probe-08-install-list.txt + probe-10-install-filter.txt
// （真机「安装 LabelShop 打印机」对话框的取证产物）。请勿手改；改动取证后重跑：
//   node app/scripts/generate-printer-catalog.cjs

export interface PrinterCatalogEntry {
  id: string
  /** 真机列表里显示的名称，例如 "Gprinter GPL-N (203 dpi)" */
  name: string
  /** 名称里的品牌英文段，例如 "Gprinter" */
  brand: string
  /** 真机品牌过滤下拉里的标签，例如 "佳博 (Gprinter)" */
  brandLabel: string
  /** 型号/指令集段，例如 "GPL" */
  model: string
  /** "-N" 后的后缀，例如 "N" */
  commandSet: string
  dpi: number
}

/** 真机品牌过滤下拉：全部 + ${brandLabels.length} 个品牌 */
export const PRINTER_BRAND_FILTER: readonly string[] = ${JSON.stringify(['全部', ...brandLabels], null, 0)}

/** 真机「可安装的打印机」列表的 ${catalog.length} 行 */
export const PRINTER_CATALOG: readonly PrinterCatalogEntry[] = [
${body}
]
`

fs.writeFileSync(OUT, out, 'utf8')
console.log(`已生成 ${path.relative(ROOT, OUT)}：${catalog.length} 行打印机、${brandLabels.length + 1} 个品牌过滤项`)
if (unmapped.size) console.warn('未映射到品牌标签的英文品牌：' + [...unmapped].join(', '))
const byBrand = new Map()
for (const r of catalog) byBrand.set(r.brandLabel || '(未映射)', (byBrand.get(r.brandLabel || '(未映射)') ?? 0) + 1)
console.log([...byBrand.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '))
