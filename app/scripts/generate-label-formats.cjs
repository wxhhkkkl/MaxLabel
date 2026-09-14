const fs = require('fs')
const path = require('path')

const source = path.resolve(__dirname, '../../parity/reference/labelshop/_labelformat_all.txt')
const output = path.resolve(__dirname, '../src/shared/domain/labelFormats.generated.ts')
const lines = fs.readFileSync(source, 'utf8').split(/\r?\n/)
const rows = lines.filter((line) => line.startsWith('[') && line.includes('] rowid='))

function parseRow(line) {
  const marker = line.indexOf('] rowid=')
  const body = line.slice(line.indexOf(' ', marker + 8) + 1)
  const fields = {}
  const fieldPattern = /([A-Za-z_]+)=([\s\S]*?)(?= \w+=| \| |$)/g
  for (const match of body.matchAll(fieldPattern)) fields[match[1]] = match[2]

  const brand = fields.Brand.match(/^(.*)\(id=(\d+)\)$/)
  const category = fields.Cate.match(/^(.*)\(id=(\d+),parent=(.*)\)$/)
  if (!brand || !category) throw new Error(`无法解析标签格式行：${line.slice(0, 100)}`)
  const number = (key) => {
    const value = Number(fields[key])
    return Number.isFinite(value) ? value : 0
  }
  return {
    code: fields.Label_Code,
    brandId: Number(brand[2]),
    brandName: brand[1],
    categoryId: Number(category[2]),
    categoryName: category[1],
    categoryParentName: category[3],
    type: number('Type'),
    name: fields.Name,
    page: number('Page'),
    pageWidthMm: number('PageW') / 100,
    pageHeightMm: number('PageH') / 100,
    pageLeftMm: number('PageLeft') / 100,
    pageTopMm: number('PageTop') / 100,
    labelWidthMm: number('LabelW') / 100,
    labelHeightMm: number('LabelH') / 100,
    cols: number('Cols'),
    rows: number('Rows'),
    colGapMm: number('ColGap') / 100,
    rowGapMm: number('RowGap') / 100,
    corner: number('Corner'),
    orientation: number('Orient'),
    totalLabels: number('TotalLabels'),
    coreMm: number('Core') / 100,
    productName: fields.Product_Name,
    productNote: fields.Product_Note
  }
}

const records = rows.map(parseRow)
if (records.length !== 275) throw new Error(`标签格式数量应为 275，实际为 ${records.length}`)

const header = `// Generated from parity/reference/labelshop/_labelformat_all.txt.\n// Do not hand-edit; run node app/scripts/generate-label-formats.cjs after changing the source snapshot.\n\n`
const body = `export interface LabelFormatRecord {\n  code: string\n  brandId: number\n  brandName: string\n  categoryId: number\n  categoryName: string\n  categoryParentName: string\n  type: number\n  name: string\n  page: number\n  pageWidthMm: number\n  pageHeightMm: number\n  pageLeftMm: number\n  pageTopMm: number\n  labelWidthMm: number\n  labelHeightMm: number\n  cols: number\n  rows: number\n  colGapMm: number\n  rowGapMm: number\n  corner: number\n  orientation: number\n  totalLabels: number\n  coreMm: number\n  productName: string\n  productNote: string\n}\n\nexport const LABEL_FORMATS: readonly LabelFormatRecord[] = ${JSON.stringify(records, null, 2)}\n`
fs.writeFileSync(output, header + body, 'utf8')
console.log(`generated ${records.length} label formats -> ${output}`)
