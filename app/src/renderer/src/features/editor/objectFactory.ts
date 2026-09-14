import type { LabelObject, ObjType } from '../../types'
import { uid } from '../../types'

export type CreatableObjectType = ObjType | 'diagonal' | 'data'

/** 编辑器中新对象的唯一默认值入口。 */
export function createLabelObject(type: CreatableObjectType, x: number, y: number): LabelObject | null {
  const id = uid()
  const base = { id, type, x, y, w: 40, h: 8, rotation: 0 }
  switch (type) {
    case 'text':
      return { ...base, type: 'text', fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'center', color: '#000000', fontWidthScale: 1, charSpacing: 0, textType: 'single', source: { kind: 'constant', value: '文字内容' } }
    case 'data':
      return { ...base, type: 'text', w: 44, h: 8, fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'center', color: '#000000', fontWidthScale: 1, charSpacing: 0, textType: 'single', source: { kind: 'constant', value: '数据字段' } }
    case 'barcode':
      return { ...base, type: 'barcode', w: 44, h: 12, symbology: 'code128', showText: true, color: '#000000', barcodeOptions: { xSizeMil: 10, xSizeMm: 0.254, w2n: 2, humanPosition: 'below', humanAlign: 'center', humanOffsetMm: 0 }, source: { kind: 'constant', value: '1234567890' } }
    case 'rfid':
      return { ...base, type: 'rfid', w: 44, h: 10, bank: 'EPC', source: { kind: 'serial', prefix: 'E2', start: 1, step: 1, digits: 8, current: 1 }, lock: false, accessPwd: '00000000', killPwd: '00000000' }
    case 'rect':
      return { ...base, type: 'rect', fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3 }
    case 'ellipse':
      return { ...base, type: 'ellipse', fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3 }
    case 'table':
      return { ...base, type: 'table', w: 44, h: 24, rows: 3, cols: 2, borderWidth: 0.3, borderColor: '#000000' }
    case 'line':
      return { ...base, type: 'line', w: 30, h: 0, stroke: '#000000', strokeWidth: 0.3 }
    case 'diagonal':
      return { ...base, type: 'line', w: 30, h: 8, stroke: '#000000', strokeWidth: 0.3 }
    case 'image':
      return null
    default:
      return null
  }
}
