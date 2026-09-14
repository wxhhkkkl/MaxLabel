import type { LabelObject } from '../../types'

export type PropertyTabKey = 'general' | 'text' | 'font' | 'datasource' | 'barcode' | 'barcodeSpecial' | 'rfid' | 'table' | 'shape' | 'image'
export interface PropertyTab { key: PropertyTabKey; label: string }

const BARCODE_LABELS: Record<string, string> = {
  code39: 'Code39', code128: 'Code128', ean13: 'EAN-13', interleaved2of5: 'Interleaved25',
  code93: 'Code93', upca: 'UPC-A', upce: 'UPC-E', ean8: 'EAN-8', codabar: 'CodaBar',
  industrial2of5: 'Code25', matrix2of5: 'Matrix25', datalogic2of5: 'China Post', itf14: 'ITF14',
  databaromni: 'RSS GS1 DataBar', pdf417: 'PDF417', qrcode: 'QR Code', datamatrix: 'DataMatrix', hanxin: '汉信码'
}

/** 属性页签顺序与 LabelShop 对象属性窗口一致：通用页永远置于首位。 */
export function propertyTabsFor(type: LabelObject['type'], symbology?: string): PropertyTab[] {
  if (type === 'text') return [
    { key: 'general', label: '通用' }, { key: 'text', label: '文字' },
    { key: 'font', label: '字体' }, { key: 'datasource', label: '数据' }
  ]
  if (type === 'barcode') return [
    { key: 'general', label: '通用' }, { key: 'barcode', label: '条码' },
    { key: 'font', label: '字体' }, { key: 'datasource', label: '数据' },
    { key: 'barcodeSpecial', label: BARCODE_LABELS[symbology ?? ''] ?? '特殊' }
  ]
  if (type === 'rfid') return [
    { key: 'general', label: '通用' }, { key: 'rfid', label: 'RFID' }, { key: 'datasource', label: '数据' }
  ]
  if (type === 'image') return [
    { key: 'general', label: '通用' }, { key: 'image', label: '图片' }, { key: 'datasource', label: '数据' }
  ]
  if (type === 'table') return [{ key: 'general', label: '通用' }, { key: 'table', label: '表格' }]
  if (type === 'rect' || type === 'ellipse' || type === 'line') return [
    { key: 'general', label: '通用' }, { key: 'shape', label: type === 'line' ? '直线' : type === 'rect' ? '矩形' : '圆形' }
  ]
  return [{ key: 'general', label: '通用' }]
}
