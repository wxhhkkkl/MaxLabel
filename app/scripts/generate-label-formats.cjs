const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const source = path.resolve(__dirname, '../../parity/reference/labelshop/sources/LabelFormat360.fmt')
const output = path.resolve(__dirname, '../src/shared/domain/labelFormats.generated.ts')
const columns = [
  'Label_Code', 'Label_BrandID', 'Label_CateID', 'Label_Type', 'Label_Name', 'Label_Page',
  'Label_PageWidth', 'Label_PageHeight', 'Label_PageLeft', 'Label_PageTop', 'Label_LabelWidth',
  'Label_LabelHeight', 'Label_Cols', 'Label_Rows', 'Label_ColGap', 'Label_RowGap', 'Label_Corner',
  'Label_Orientation', 'Label_Layout', 'Label_TotalLabels', 'Label_Core', 'CateName',
  'CateParentName', 'BrandName', 'Product_Name', 'Product_Note'
]

// The source is the original UTF-16 SQLite database. Python's stdlib sqlite3 is
// used only by this developer-time generator, so no runtime dependency is added.
const pythonQuery = [
  'import json, sqlite3, sys',
  'columns = ' + JSON.stringify(columns),
  'connection = sqlite3.connect(sys.argv[1])',
  'rows = connection.execute("SELECT " + ",".join(columns) + " FROM LabelFormat ORDER BY rowid").fetchall()',
  // ASCII JSON keeps the generator stable even when Windows Python uses a GBK console encoding.
  'print(json.dumps([dict(zip(columns, row)) for row in rows]))'
].join('; ')

let rawRows
let queryError
for (const executable of process.platform === 'win32' ? ['python', 'py'] : ['python3', 'python']) {
  try {
    const args = executable === 'py' ? ['-3', '-c', pythonQuery, source] : ['-c', pythonQuery, source]
    rawRows = JSON.parse(execFileSync(executable, args, { encoding: 'utf8' }))
    break
  } catch (error) {
    queryError = error
  }
}
if (!rawRows) throw new Error(`Unable to read LabelFormat SQLite source: ${queryError?.message || 'Python not found'}`)

const number = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
const records = rawRows.map((fields) => ({
  code: String(fields.Label_Code ?? ''),
  brandId: number(fields.Label_BrandID),
  brandName: String(fields.BrandName ?? ''),
  categoryId: number(fields.Label_CateID),
  categoryName: String(fields.CateName ?? ''),
  categoryParentName: String(fields.CateParentName ?? ''),
  type: number(fields.Label_Type),
  name: String(fields.Label_Name ?? ''),
  page: number(fields.Label_Page),
  pageWidthMm: number(fields.Label_PageWidth) / 100,
  pageHeightMm: number(fields.Label_PageHeight) / 100,
  pageLeftMm: number(fields.Label_PageLeft) / 100,
  pageTopMm: number(fields.Label_PageTop) / 100,
  labelWidthMm: number(fields.Label_LabelWidth) / 100,
  labelHeightMm: number(fields.Label_LabelHeight) / 100,
  cols: number(fields.Label_Cols),
  rows: number(fields.Label_Rows),
  colGapMm: number(fields.Label_ColGap) / 100,
  rowGapMm: number(fields.Label_RowGap) / 100,
  corner: number(fields.Label_Corner),
  orientation: number(fields.Label_Orientation),
  layout: String(fields.Label_Layout ?? ''),
  totalLabels: number(fields.Label_TotalLabels),
  coreMm: number(fields.Label_Core) / 100,
  productName: String(fields.Product_Name ?? ''),
  productNote: String(fields.Product_Note ?? '')
}))
if (records.length !== 275) throw new Error(`Expected 275 label formats, got ${records.length}`)

const header = `// Generated from parity/reference/labelshop/sources/LabelFormat360.fmt (SQLite).\n// Do not hand-edit; run node app/scripts/generate-label-formats.cjs after changing the source snapshot.\n\n`
const body = `export interface LabelFormatRecord {
  code: string
  brandId: number
  brandName: string
  categoryId: number
  categoryName: string
  categoryParentName: string
  type: number
  name: string
  page: number
  pageWidthMm: number
  pageHeightMm: number
  pageLeftMm: number
  pageTopMm: number
  labelWidthMm: number
  labelHeightMm: number
  cols: number
  rows: number
  colGapMm: number
  rowGapMm: number
  corner: number
  orientation: number
  layout: string
  totalLabels: number
  coreMm: number
  productName: string
  productNote: string
}

export const LABEL_FORMATS: readonly LabelFormatRecord[] = ${JSON.stringify(records, null, 2)}
`
fs.writeFileSync(output, header + body, 'utf8')
console.log(`generated ${records.length} label formats -> ${output}`)
