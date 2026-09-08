import type { LabelDoc } from '../types'
import { defaultPrinterConfig, uid } from '../types'

/** 新建空标签（60×40mm） */
export function blankTemplate(): LabelDoc {
  return {
    version: 1,
    name: '未命名标签',
    widthMm: 60,
    heightMm: 40,
    objects: [],
    printer: defaultPrinterConfig()
  }
}

/** 内置示例：一张含条码的商品标签 */
export function demoTemplate(): LabelDoc {
  return {
    version: 1,
    name: '示例商品标签',
    widthMm: 60,
    heightMm: 40,
    objects: [
      {
        id: uid(),
        type: 'rect',
        x: 0,
        y: 0,
        w: 60,
        h: 40,
        rotation: 0,
        fill: '#ffffff',
        stroke: '#999999',
        strokeWidth: 0.3
      },
      {
        id: uid(),
        type: 'text',
        x: 4,
        y: 4,
        w: 52,
        h: 6,
        rotation: 0,
        fontFamily: '微软雅黑',
        fontSize: 5,
        bold: true,
        align: 'center',
        color: '#1A1B1C',
        source: { kind: 'constant', value: '示例商品标签' }
      },
      {
        id: uid(),
        type: 'barcode',
        x: 8,
        y: 13,
        w: 44,
        h: 14,
        rotation: 0,
        symbology: 'code128',
        showText: true,
        source: { kind: 'serial', prefix: 'SN-', start: 1001, step: 1, digits: 4, current: 1001 }
      },
      {
        id: uid(),
        type: 'text',
        x: 4,
        y: 32,
        w: 52,
        h: 5,
        rotation: 0,
        fontFamily: '微软雅黑',
        fontSize: 4,
        bold: false,
        align: 'center',
        color: '#CC0000',
        source: { kind: 'constant', value: '¥ 19.90' }
      }
    ],
    printer: defaultPrinterConfig()
  }
}
