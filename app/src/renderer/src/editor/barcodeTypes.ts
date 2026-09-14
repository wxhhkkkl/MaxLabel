/** 常用码制 -> bwip-js bcid 对照（不引入生成器，供属性面板轻量加载） */
export const BARCODE_TYPES: Array<{ label: string; bcid: string; dim: '1d' | '2d' }> = [
  { label: 'Code39', bcid: 'code39', dim: '1d' },
  { label: 'Code128', bcid: 'code128', dim: '1d' },
  { label: 'EAN-13', bcid: 'ean13', dim: '1d' },
  { label: 'Interleaved25', bcid: 'interleaved2of5', dim: '1d' },
  { label: 'Code93', bcid: 'code93', dim: '1d' },
  { label: 'UPC-A', bcid: 'upca', dim: '1d' },
  { label: 'UPC-E', bcid: 'upce', dim: '1d' },
  { label: 'EAN-8', bcid: 'ean8', dim: '1d' },
  { label: 'CodaBar', bcid: 'codabar', dim: '1d' },
  { label: 'Code25', bcid: 'industrial2of5', dim: '1d' },
  { label: 'Matrix25', bcid: 'matrix2of5', dim: '1d' },
  { label: 'China Post', bcid: 'datalogic2of5', dim: '1d' },
  { label: 'ITF14', bcid: 'itf14', dim: '1d' },
  { label: 'RSS GS1 DataBar', bcid: 'databaromni', dim: '1d' },
  { label: 'PDF417', bcid: 'pdf417', dim: '2d' },
  { label: 'QR Code', bcid: 'qrcode', dim: '2d' },
  { label: 'DataMatrix', bcid: 'datamatrix', dim: '2d' },
  { label: '汉信码', bcid: 'hanxin', dim: '2d' }
]
