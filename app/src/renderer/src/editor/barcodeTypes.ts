/** 码制 -> bwip-js bcid 对照（不引入生成器，供属性面板轻量加载）。
 *
 *  **清单与顺序照抄真机**「条码属性 → 条码」页的「条码符号类型(码制)(&B)」下拉
 *  （round-57 用 `Probe-ProbeCombos.ps1` 的 CB_GETCOUNT/CB_GETLBTEXT 读回，共 20 项）：
 *  `Code 39 / Code 128 / EAN-13 / Interleaved 25 / Code 93 / UPC-A / EAN-8 / UPC-E / CodaBar /
 *   Code 25 / Matrix 25 / China Post / Pharmacode / ITF 14 / GS1 RSS 条码 / PDF 417 / QR Code /
 *   Data Matrix / 汉信码 / Micro QR`。
 *  复刻版原先只有 18 项、名称无空格、缺 Pharmacode 与 Micro QR（DIFF-55）。 */
export const BARCODE_TYPES: Array<{ label: string; bcid: string; dim: '1d' | '2d' }> = [
  { label: 'Code 39', bcid: 'code39', dim: '1d' },
  { label: 'Code 128', bcid: 'code128', dim: '1d' },
  { label: 'EAN-13', bcid: 'ean13', dim: '1d' },
  { label: 'Interleaved 25', bcid: 'interleaved2of5', dim: '1d' },
  { label: 'Code 93', bcid: 'code93', dim: '1d' },
  { label: 'UPC-A', bcid: 'upca', dim: '1d' },
  { label: 'EAN-8', bcid: 'ean8', dim: '1d' },
  { label: 'UPC-E', bcid: 'upce', dim: '1d' },
  { label: 'CodaBar', bcid: 'codabar', dim: '1d' },
  { label: 'Code 25', bcid: 'industrial2of5', dim: '1d' },
  { label: 'Matrix 25', bcid: 'matrix2of5', dim: '1d' },
  { label: 'China Post', bcid: 'datalogic2of5', dim: '1d' },
  { label: 'Pharmacode', bcid: 'pharmacode', dim: '1d' },
  { label: 'ITF 14', bcid: 'itf14', dim: '1d' },
  { label: 'GS1 RSS 条码', bcid: 'databaromni', dim: '1d' },
  { label: 'PDF 417', bcid: 'pdf417', dim: '2d' },
  { label: 'QR Code', bcid: 'qrcode', dim: '2d' },
  { label: 'Data Matrix', bcid: 'datamatrix', dim: '2d' },
  { label: '汉信码', bcid: 'hanxin', dim: '2d' },
  { label: 'Micro QR', bcid: 'microqrcode', dim: '2d' }
]

/** 二维码（PDF 417 / QR / Data Matrix / 汉信码 / Micro QR）：必须等比缩放，不能拉伸。 */
const TWO_DIMENSIONAL = new Set(BARCODE_TYPES.filter((type) => type.dim === '2d').map((type) => type.bcid))

export function isTwoDimensional(symbology: string): boolean {
  return TWO_DIMENSIONAL.has(symbology)
}

/**
 * 真机「条码属性 → 条码」页上**有**「条宽比(&W):」这一行的码制；其余码制该行整行不出现。
 *
 * 依据：round-58 用 `Read-ProbeDialogValues.ps1` 逐码制读回的控件 dump ——
 * `parity/reference/labelshop/probe-sym-{code39,codabar,code25,matrix25,chinapost,interleaved25,itf14,pharmacode,pdf417}-values.txt`
 * 都含 `label='条宽比(&W):'`（非 PDF 417 为 7 档 2.00…3.00，PDF 417 为 9 档 1 X…9 X）；
 * 而 `code93 / code128 / ean13 / ean8 / upca / upce / rss / qrcode / datamatrix / hanxin / microqr`
 * 的 dump 里**没有**这一行。
 *
 * round-124 由并排图 `parity/review/cmp-propsbarcode-r124.png` 复核发现：复刻版原先对**所有**码制都渲染该项，
 * 与真机 Code 128 页（`verifier-20c-barcode-page.png`）不符 —— 故收敛为按码制条件渲染。
 */
export const W2N_SYMBOLOGIES: ReadonlySet<string> = new Set([
  'code39',
  'codabar',
  'industrial2of5', // Code 25
  'matrix2of5', // Matrix 25
  'datalogic2of5', // China Post
  'interleaved2of5', // Interleaved 25
  'itf14',
  'pharmacode',
  'pdf417'
])

/** Data Matrix「符号版本」的 30 个 ECC200 尺寸（原版下拉 1…30，顺序照抄真机 probe）。 */
export const DM_SYMBOL_SIZES = [
  '10x10', '12x12', '14x14', '16x16', '18x18', '20x20', '22x22', '24x24', '26x26', '32x32',
  '36x36', '40x40', '44x44', '48x48', '52x52', '64x64', '72x72', '80x80', '88x88', '96x96',
  '104x104', '120x120', '132x132', '144x144', '8x18', '8x32', '12x26', '12x36', '16x36', '16x48'
] as const

/** 符号版本下拉：值直接存 bwip-js 需要的 "行x列" 尺寸（历史文档里的数字索引由 dmVersionToSize 兼容）。 */
export const DM_VERSION_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  DM_SYMBOL_SIZES.map((size, index) => ({ value: size, label: `${index + 1} (${size})` }))

/** 把存进文档的符号版本转成 bwip-js 认可的 "行x列"；自动/越界返回 undefined。 */
export function dmVersionToSize(value: string | undefined): string | undefined {
  if (!value || value === 'auto') return undefined
  if (/^\d+x\d+$/.test(value)) return value
  const index = parseInt(value, 10)
  return Number.isFinite(index) && index >= 1 && index <= DM_SYMBOL_SIZES.length ? DM_SYMBOL_SIZES[index - 1] : undefined
}

/** 方形二维码：模块阵列必须保持正方形，不允许横向/纵向单独拉伸。 */
export const SQUARE_MATRIX_SYMBOLOGIES: ReadonlySet<string> = new Set(['qrcode', 'microqrcode', 'hanxin'])

export function isSquareMatrixSymbol(symbology: string): boolean {
  return SQUARE_MATRIX_SYMBOLOGIES.has(symbology)
}

/** Data Matrix 的矩形符号版本（选了它们就不按正方形处理）。 */
const RECTANGULAR_DM_VERSIONS: ReadonlySet<string> = new Set(['8x18', '8x32', '12x26', '12x36', '16x36', '16x48'])

/**
 * 需要按正方形处理的矩阵码：QR / 微型 QR / 汉信码，以及 Data Matrix 的方形版本。
 *
 * bwip 只给 height 时会把这类符号拉成矩形（QR 实测 84×42），所以渲染时必须同时传 width/height；
 * 缩放也只能等比、模型框保持正方形。Data Matrix 选「8x18」这类矩形版本时按普通二维码处理。
 */
export function isSquareMatrixCode(symbology: string, options?: { dmVersion?: string }): boolean {
  if (SQUARE_MATRIX_SYMBOLOGIES.has(symbology)) return true
  if (symbology !== 'datamatrix') return false
  const size = dmVersionToSize(options?.dmVersion)
  return size === undefined || !RECTANGULAR_DM_VERSIONS.has(size)
}

/** 常用码制（标准版/专业版/企业版均可用），其余码制归企业版；见 spec 017 data-model。 */
export const COMMON_BARCODE_BCIDS: ReadonlySet<string> = new Set([
  'code39',
  'code128',
  'ean13',
  'ean8',
  'upca',
  'upce',
  'interleaved2of5',
  'itf14',
  'qrcode',
  'datamatrix',
  'pdf417'
])

export function isCommonBarcode(bcid: string): boolean {
  return COMMON_BARCODE_BCIDS.has(bcid)
}
