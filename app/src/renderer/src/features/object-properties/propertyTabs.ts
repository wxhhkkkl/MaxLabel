import type { LabelObject } from '../../types'

export type PropertyTabKey = 'general' | 'text' | 'font' | 'datasource' | 'barcode' | 'barcodeSpecial' | 'rfid' | 'table' | 'shape' | 'image'
export interface PropertyTab { key: PropertyTabKey; label: string }

/**
 * 属性页签顺序与 LabelShop 对象属性窗口一致（真机取证 `parity/reference/labelshop/PROBE-verifier-object-tabs.md`，
 * 截图 `probe-63-06-serial-page.png` / `verifier-10-barcode-props.png` / `verifier-11-rect-props.png` /
 * `verifier-12-table-props.png` / `verifier-31-image-props.png`）：
 * **对象专属页在最前、公共页在后，最后一页叫「常规」**（不是「通用」）。
 * 真机不存在名为「方框和圆形」「直线和斜线」的页签 —— 那只是帮助页标题，UI 上矩形/椭圆/直线统一叫「图形」。
 * 条码对象真机只有 4 个页签，码制下拉与随码制变化的专属字段都在「条码」页内（见 barcodeSpecial 分组）。
 */
export function propertyTabsFor(type: LabelObject['type']): PropertyTab[] {
  if (type === 'text') return [
    { key: 'datasource', label: '数据源' }, { key: 'font', label: '字体' },
    { key: 'text', label: '文本' }, { key: 'general', label: '常规' }
  ]
  if (type === 'barcode') return [
    { key: 'datasource', label: '数据源' }, { key: 'barcode', label: '条码' },
    { key: 'font', label: '字体' }, { key: 'general', label: '常规' }
  ]
  if (type === 'rfid') return [
    { key: 'general', label: '通用' }, { key: 'rfid', label: 'RFID' }, { key: 'datasource', label: '数据' }
  ]
  if (type === 'image') return [
    { key: 'image', label: '图片' }, { key: 'general', label: '常规' }
  ]
  if (type === 'table') return [{ key: 'table', label: '表格' }, { key: 'general', label: '常规' }]
  if (type === 'rect' || type === 'ellipse' || type === 'line') return [
    { key: 'shape', label: '图形' }, { key: 'general', label: '常规' }
  ]
  return [{ key: 'general', label: '常规' }]
}
