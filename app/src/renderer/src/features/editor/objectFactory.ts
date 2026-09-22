import type { LabelObject, ObjType } from '../../types'
import { uid } from '../../types'

export type CreatableObjectType = ObjType | 'diagonal' | 'data'

/** 新对象默认值里可由「系统设置」覆盖的部分（真机「系统设置 → 编辑 → 表格操作」等）。 */
export interface CreateObjectDefaults {
  /** 「增删行列时，保持表格尺寸」——作为新建表格对象 keepSize 的全局默认。 */
  tableKeepSize?: boolean
}

/** 编辑器中新对象的唯一默认值入口。 */
export function createLabelObject(type: CreatableObjectType, x: number, y: number, defaults: CreateObjectDefaults = {}): LabelObject | null {
  const id = uid()
  const base = { id, type, x, y, w: 40, h: 8, rotation: 0 }
  switch (type) {
    case 'text':
      return { ...base, type: 'text', fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'center', color: '#000000', fontWidthScale: 1, charSpacing: 0, textType: 'single', backgroundTransparent: true, source: { kind: 'constant', value: '文字内容' } }
    case 'data':
      return { ...base, type: 'text', w: 44, h: 8, fontFamily: '微软雅黑', fontSize: 4, bold: false, align: 'center', color: '#000000', fontWidthScale: 1, charSpacing: 0, textType: 'single', backgroundTransparent: true, source: { kind: 'constant', value: '数据字段' } }
    case 'barcode':
      // 真机条码页「背景(&B)」默认是「透明」（Probe-LabelShopCombos：sel=1 / 共 2 项）
      // 高度 10：真机新建条码的 `码  高(&H):` 默认是 `10.00`（毫米）
      // （`parity/reference/labelshop/probe-45-barcode-props-p3.txt`：`Edit label='码  高(&H):' value='10.00'`）；
      // 复刻版此前写 12，与真机默认不符。
      return { ...base, type: 'barcode', w: 44, h: 10, symbology: 'code128', showText: true, color: '#000000', backgroundTransparent: true, barcodeOptions: { xSizeMil: 10, xSizeMm: 0.254, w2n: 2, humanPosition: 'below', humanAlign: 'center', humanOffsetMm: 0 }, source: { kind: 'constant', value: '1234567890' } }
    case 'rfid':
      return { ...base, type: 'rfid', w: 44, h: 10, bank: 'EPC', source: { kind: 'serial', prefix: 'E2', start: 1, step: 1, digits: 8, current: 1 }, lock: false, dataType: 'hex', accessPwd: '00000000', killPwd: '00000000' }
    case 'rect':
      return { ...base, type: 'rect', fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3, shape: 'rect', cornerRadius: 0, fillEnabled: false }
    case 'ellipse':
      return { ...base, type: 'ellipse', fill: '#ffffff', stroke: '#000000', strokeWidth: 0.3 }
    case 'table':
      // 真机「系统设置 → 编辑 → 表格操作 → 增删行列时，保持表格尺寸」是新表格的全局默认（probe-r112-sysset-tab-edit.png）
      return { ...base, type: 'table', w: 44, h: 24, rows: 3, cols: 2, borderWidth: 0.3, borderColor: '#000000', keepSize: defaults.tableKeepSize === true }
    case 'line':
      return { ...base, type: 'line', w: 30, h: 0, stroke: '#000000', strokeWidth: 0.3 }
    case 'diagonal':
      return { ...base, type: 'line', w: 30, h: 8, stroke: '#000000', strokeWidth: 0.3 }
    case 'image':
      // LabelShop creates an image frame when the image tool is dragged.
      // The file can then be selected from the object properties dialog.
      return {
        ...base,
        type: 'image',
        w: 24,
        h: 16,
        src: 'data:image/svg+xml,%3Csvg xmlns=%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 width=%22120%22 height=%2280%22 viewBox=%220 0 120 80%22%3E%3Crect width=%22120%22 height=%2280%22 fill=%22%23eef5f8%22 stroke=%22%23758b99%22%2F%3E%3Cpath d=%22M12 64l27-27 18 18 12-12 39 21%22 fill=%22none%22 stroke=%22%23758b99%22 stroke-width=%224%22%2F%3E%3Ccircle cx=%2238%22 cy=%2225%22 r=%227%22 fill=%22%23758b99%22%2F%3E%3C%2Fsvg%3E',
        imgType: 'embed',
        imageFit: 'fit',
        keepAspect: true,
        imageAlign: 'center',
        widthPercent: 100,
        heightPercent: 100
      }
    default:
      return null
  }
}
