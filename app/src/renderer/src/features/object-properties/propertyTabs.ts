import type { LabelObject } from '../../types'

export type PropertyTabKey = 'datasource' | 'appearance' | 'text' | 'rfid' | 'table' | 'general'
export interface PropertyTab { key: PropertyTabKey; label: string }

export function propertyTabsFor(type: LabelObject['type']): PropertyTab[] {
  const tabs: PropertyTab[] = []
  if (type === 'text' || type === 'barcode' || type === 'rfid' || type === 'image') tabs.push({ key: 'datasource', label: '数据源' })
  if (type === 'text' || type === 'rect' || type === 'ellipse' || type === 'line') tabs.push({ key: 'appearance', label: '外观' })
  if (type === 'image') tabs.push({ key: 'appearance', label: '图片' })
  if (type === 'barcode') tabs.push({ key: 'appearance', label: '条码' })
  if (type === 'table') tabs.push({ key: 'table', label: '表格' })
  if (type === 'rfid') tabs.push({ key: 'rfid', label: 'RFID' })
  if (type === 'text' || type === 'barcode') tabs.push({ key: 'text', label: '文本' })
  tabs.push({ key: 'general', label: '常规' })
  return tabs
}
