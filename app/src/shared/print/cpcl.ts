// ---------- CPCL（面单/便携式打印机指令集，初版适配） ----------
// 说明：CPCL 语法在不同品牌固件间差异较大，本实现为初版最佳努力，
// 需在真机上验证；Zebra ZP 系列 / 汉印等按此基准校准。
import type { BarcodeObj, TableObj, TextObj } from '../domain/objects'
import type { MonoBitmap } from '../domain/units'
import type { PrinterConfig } from '../domain/printer'
import { mm2dot } from './geometry'
import type { ResolvedPrintScene } from './scene'
import { printerCapabilities } from './capabilities'
import { pushProtocolWarning, type WarningTarget } from './warnings'
import { tableColXs, tableRowYs, tableSegmentHidden } from '../table'

const CPCL_SYM: Record<string, string> = {
  code128: '128',
  ean13: 'EAN13',
  ean8: 'EAN8',
  upca: 'UPCA',
  upce: 'UPCE',
  code39: '39',
  code93: '93',
  itf14: 'I2OF5',
  interleaved2of5: 'I2OF5',
  codabar: 'CODABAR',
  qrcode: 'QR',
  datamatrix: 'DATAMATRIX',
  pdf417: 'PDF-417'
}

function data(s: string): string {
  return s.replace(/[\u0000-\u001f\u007f]/g, ' ')
}

function rot(d: number): 0 | 90 | 180 | 270 {
  return ((((Math.round(d / 90) % 4) + 4) % 4) * 90) as 0 | 90 | 180 | 270
}

export function buildCPCL(scene: ResolvedPrintScene, printer: PrinterConfig, warnings: WarningTarget): string {
  // CPCL 的坐标会话固定使用 200 units/inch；203 dpi 机型也应声明 200。
  const d = printerCapabilities(printer).coordinateDpi
  if (printer.dpi !== 203 && printer.dpi !== 200) {
    pushProtocolWarning(warnings, 'cpcl-fixed-coordinate-dpi', `CPCL 会话固定按 200 units/inch 输出；当前 ${printer.dpi} dpi 配置需真机校准`)
  }
  const L: string[] = []
  L.push(`! 0 200 200 ${mm2dot(scene.heightMm, d)} ${scene.copy}`)
  L.push(`PAGE-WIDTH ${mm2dot(scene.widthMm, d)}`)
  if (printer.labelType === 'gap') L.push('GAP-SENSE')
  else if (printer.labelType === 'mark') L.push('BAR-SENSE')
  if (scene.pageBitmap) L.push(cpclBitmap(0, 0, scene.pageBitmap))
  for (const primitive of scene.primitives) {
    if (scene.pageBitmap && primitive.kind !== 'rfid') continue
    if (primitive.kind === 'text') {
      const t = cpclText(primitive.object, primitive.value, primitive.bitmap, d, warnings)
      if (t) L.push(t)
    } else if (primitive.kind === 'barcode') {
      const b = cpclBarcode(primitive.object, primitive.value, d, warnings)
      if (b) L.push(b)
    } else if (primitive.kind === 'rect') {
      const obj = primitive.object
      const x1 = mm2dot(obj.x, d)
      const y1 = mm2dot(obj.y, d)
      const x2 = mm2dot(obj.x + obj.w, d)
      const y2 = mm2dot(obj.y + obj.h, d)
      L.push(`BOX ${x1} ${y1} ${x2} ${y2} ${mm2dot(Math.max(0.1, obj.strokeWidth), d)}`)
    } else if (primitive.kind === 'line') {
      const obj = primitive.object
      const x1 = mm2dot(obj.x, d)
      const y1 = mm2dot(obj.y, d)
      const x2 = mm2dot(obj.x + obj.w, d)
      const y2 = mm2dot(obj.y + obj.h, d)
      L.push(`LINE ${x1} ${y1} ${x2} ${y2} ${mm2dot(Math.max(0.1, obj.strokeWidth), d)}`)
    } else if (primitive.kind === 'table') {
      cpclTable(primitive.object, d, L)
    } else if (primitive.kind === 'rfid') {
      pushProtocolWarning(warnings, 'unsupported-rfid', 'CPCL 打印机通常不支持 RFID 编程，已跳过', 'error')
    } else if (primitive.kind === 'ellipse') {
      pushProtocolWarning(warnings, 'unsupported-ellipse', '标准 CPCL 无椭圆指令，已跳过（驱动打印模式可输出）', 'error')
    } else if (primitive.kind === 'image') {
      const obj = primitive.object
      const mono = primitive.bitmap
      if (mono) L.push(cpclBitmap(mm2dot(obj.x, d), mm2dot(obj.y, d), mono))
      else pushProtocolWarning(warnings, 'missing-image-bitmap', '图片对象缺少预渲染位图，已跳过', 'error')
    }
  }
  L.push('FORM')
  L.push('PRINT')
  return L.join('\n')
}

function cpclText(obj: TextObj, text: string, mono: MonoBitmap | undefined, d: number, warnings: WarningTarget): string {
  if (!text) return ''
  if (obj.arc) {
    if (mono) return cpclBitmap(mm2dot(obj.x, d), mm2dot(obj.y, d), mono)
    pushProtocolWarning(warnings, 'missing-text-bitmap', '弧形文字在 CPCL 需预渲染位图，已跳过', 'error')
    return ''
  }
  if (/[^\x00-\x7F]/.test(text)) {
    if (mono) return cpclBitmap(mm2dot(obj.x, d), mm2dot(obj.y, d), mono)
    pushProtocolWarning(warnings, 'native-chinese-fallback', '含中文的文本在 CPCL 缺少预渲染位图，已按内置字体输出，字库兼容性未知')
  }
  const ymult = Math.max(1, Math.min(16, Math.round(mm2dot(obj.fontSize, d) / 16)))
  const xmult = Math.max(1, Math.min(16, Math.round(ymult * 0.6)))
  const x = mm2dot(obj.x, d)
  const y = mm2dot(obj.y, d)
  const command = rot(obj.rotation) === 0 ? 'TEXT' : `TEXT${rot(obj.rotation)}`
  return `SETMAG ${xmult} ${ymult}\n${command} 7 0 ${x} ${y} ${data(text)}\nSETMAG 1 1`
}

function cpclBarcode(obj: BarcodeObj, text: string, d: number, warnings: WarningTarget): string {
  if (!text) return ''
  const type = CPCL_SYM[obj.symbology]
  const x = mm2dot(obj.x, d)
  const y = mm2dot(obj.y, d)
  const h = mm2dot(obj.h, d)
  const rotation = rot(obj.rotation)
  const command = rotation === 90 ? 'VBARCODE' : 'BARCODE'
  if (rotation === 180 || rotation === 270) pushProtocolWarning(warnings, 'unsupported-barcode-rotation', `CPCL 条码不支持 ${rotation}° 原生旋转，已按 0° 输出`)
  if (obj.symbology === 'qrcode') {
    const ecc = /^[LMQH]$/.test(obj.barcodeOptions?.eclevel ?? '') ? obj.barcodeOptions!.eclevel : 'M'
    const cell = Math.max(1, Math.min(32, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.5, d))))
    return `${command} QR ${x} ${y} M 2 U ${cell}\n${ecc}A,${data(text)}\nENDQR`
  }
  if (obj.symbology === 'pdf417') {
    const ecc = Math.max(0, Math.min(8, Number(obj.barcodeOptions?.eclevel ?? 2) || 2))
    return `${command} PDF-417 ${x} ${y} XD 2 YD 6 C 3 S ${ecc}\n${data(text)}\nENDPDF`
  }
  if (obj.symbology === 'datamatrix') {
    const scale = Math.max(1, Math.min(32, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.5, d))))
    return `${command} DATAMATRIX ${x} ${y} H ${scale} S 200\n${data(text)}\nENDDATAMATRIX`
  }
  if (!type) {
    pushProtocolWarning(warnings, 'unsupported-barcode', `CPCL 不支持原生码制 ${obj.symbology}，已跳过`, 'error')
    return ''
  }
  const narrow = Math.max(1, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.25, d)))
  const ratio = Math.max(1, Math.min(4, Math.round(obj.barcodeOptions?.w2n || 2)))
  const human = obj.showText ? 'BARCODE-TEXT 7 0 5' : 'BARCODE-TEXT OFF'
  return `${human}\n${command} ${type} ${narrow} ${ratio} ${h} ${x} ${y} ${data(text)}`
}

function cpclBitmap(x: number, y: number, mono: import('../domain/units').MonoBitmap): string {
  let hex = ''
  for (const byte of mono.bytes) hex += byte.toString(16).padStart(2, '0')
  return `EG ${mono.bytesPerRow} ${mono.height} ${x} ${y} ${hex.toUpperCase()}`
}

/** 表格：外框 BOX + 内部网格 LINE */
function cpclTable(obj: TableObj, d: number, L: string[]): void {
  const x1 = mm2dot(obj.x, d)
  const y1 = mm2dot(obj.y, d)
  const x2 = mm2dot(obj.x + obj.w, d)
  const y2 = mm2dot(obj.y + obj.h, d)
  const t = mm2dot(Math.max(0.1, obj.borderWidth), d)
  L.push(`BOX ${x1} ${y1} ${x2} ${y2} ${t}`)
  const xs = tableColXs(obj)
  const ys = tableRowYs(obj)
  for (let i = 1; i < obj.cols; i++) {
    for (let j = 0; j < obj.rows; j++) {
      if (!tableSegmentHidden(obj, j, i, 'v')) L.push(`LINE ${mm2dot(obj.x + xs[i], d)} ${mm2dot(obj.y + ys[j], d)} ${mm2dot(obj.x + xs[i], d)} ${mm2dot(obj.y + ys[j + 1], d)} ${t}`)
    }
  }
  for (let j = 1; j < obj.rows; j++) {
    for (let i = 0; i < obj.cols; i++) {
      if (!tableSegmentHidden(obj, j, i, 'h')) L.push(`LINE ${mm2dot(obj.x + xs[i], d)} ${mm2dot(obj.y + ys[j], d)} ${mm2dot(obj.x + xs[i + 1], d)} ${mm2dot(obj.y + ys[j], d)} ${t}`)
    }
  }
}
