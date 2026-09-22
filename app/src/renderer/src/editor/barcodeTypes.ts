/** 码制 -> bwip-js bcid 对照（不引入生成器，供属性面板轻量加载）。
 *
 *  **清单与顺序照抄真机**「条码属性 → 条码」页的「条码符号类型(码制)(&B)」下拉
 *  （round-57 用 `Probe-LabelShopCombos.ps1` 的 CB_GETCOUNT/CB_GETLBTEXT 读回，共 20 项）：
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

/**
 * 真机「条码属性 → 条码」页上**有**「条宽比(&W):」这一行的码制；其余码制该行整行不出现。
 *
 * 依据：round-58 用 `Read-LabelShopDialogValues.ps1` 逐码制读回的控件 dump ——
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
