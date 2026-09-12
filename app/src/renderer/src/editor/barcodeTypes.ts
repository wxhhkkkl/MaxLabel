/** 常用码制 -> bwip-js bcid 对照（不引入生成器，供属性面板轻量加载） */
export const BARCODE_TYPES: Array<{ label: string; bcid: string; dim: '1d' | '2d' }> = [
  { label: 'Code 128', bcid: 'code128', dim: '1d' },
  { label: 'EAN-13', bcid: 'ean13', dim: '1d' },
  { label: 'EAN-8', bcid: 'ean8', dim: '1d' },
  { label: 'UPC-A', bcid: 'upca', dim: '1d' },
  { label: 'UPC-E', bcid: 'upce', dim: '1d' },
  { label: 'Code 39', bcid: 'code39', dim: '1d' },
  { label: 'Code 93', bcid: 'code93', dim: '1d' },
  { label: 'Codabar', bcid: 'codabar', dim: '1d' },
  { label: 'ITF-14', bcid: 'itf14', dim: '1d' },
  { label: 'Interleaved 2 of 5', bcid: 'interleaved2of5', dim: '1d' },
  { label: 'Code 25', bcid: 'industrial2of5', dim: '1d' },
  { label: 'Matrix 25', bcid: 'matrix2of5', dim: '1d' },
  { label: '中国邮政码 China Post', bcid: 'datalogic2of5', dim: '1d' },
  { label: 'GS1 DataBar', bcid: 'databaromni', dim: '1d' },
  { label: 'QR Code', bcid: 'qrcode', dim: '2d' },
  { label: 'Data Matrix', bcid: 'datamatrix', dim: '2d' },
  { label: 'PDF417', bcid: 'pdf417', dim: '2d' },
  { label: '汉信码 HanXin', bcid: 'hanxin', dim: '2d' }
]
