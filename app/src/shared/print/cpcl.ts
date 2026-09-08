// ---------- CPCL（面单/便携式打印机指令集，初版适配） ----------
// 说明：CPCL 语法在不同品牌固件间差异较大，本实现为初版最佳努力，
// 需在真机上验证；Zebra ZP 系列 / 汉印等按此基准校准。
import type { BarcodeObj, DataCtx, LabelDoc, PrinterConfig, TableObj, TextObj } from '../model'
import { resolveObjectText } from '../model'
import { mm2dot } from './geometry'

const CPCL_SYM: Record<string, string> = {
  code128: '128',
  ean13: 'EAN13',
  ean8: 'EAN8',
  upca: 'UPCA',
  upce: 'UPCE',
  code39: '39',
  code93: '93',
  itf14: 'ITF14',
  interleaved2of5: '25',
  codabar: 'CODABAR',
  qrcode: 'QRCODE',
  datamatrix: 'DATAMATRIX',
  pdf417: 'PDF417'
}

function q(s: string): string {
  return '"' + s.replace(/"/g, "'") + '"'
}

export function buildCPCL(doc: LabelDoc, printer: PrinterConfig, ctx: DataCtx, warnings: string[]): string {
  const d = printer.dpi
  const L: string[] = []
  // 初始化行：! 0 200 200 <dpi> 1
  L.push(`! 0 200 200 ${d} 1`)
  L.push(`PAGE-WIDTH ${mm2dot(doc.widthMm, d)}`)
  L.push(`SETFF ${mm2dot(3, d)}`)
  for (const obj of doc.objects) {
    if (obj.visible === false) continue
    if (obj.type === 'text') {
      const t = cpclText(obj, d, ctx, warnings)
      if (t) L.push(t)
    } else if (obj.type === 'barcode') {
      const b = cpclBarcode(obj, d, ctx, warnings)
      if (b) L.push(b)
    } else if (obj.type === 'rect') {
      const x1 = mm2dot(obj.x, d)
      const y1 = mm2dot(obj.y, d)
      const x2 = mm2dot(obj.x + obj.w, d)
      const y2 = mm2dot(obj.y + obj.h, d)
      L.push(`BOX ${x1} ${y1} ${x2} ${y2} ${mm2dot(Math.max(0.1, obj.strokeWidth), d)}`)
    } else if (obj.type === 'line') {
      const x1 = mm2dot(obj.x, d)
      const y1 = mm2dot(obj.y, d)
      const x2 = mm2dot(obj.x + obj.w, d)
      const y2 = mm2dot(obj.y + obj.h, d)
      L.push(`LINE ${x1} ${y1} ${x2} ${y2} ${mm2dot(Math.max(0.1, obj.strokeWidth), d)}`)
    } else if (obj.type === 'table') {
      cpclTable(obj, d, L)
    } else if (obj.type === 'rfid') {
      warnings.push('CPCL 打印机通常不支持 RFID 编程，已跳过')
    } else if (obj.type === 'ellipse') {
      const x1 = mm2dot(obj.x, d)
      const y1 = mm2dot(obj.y, d)
      const x2 = mm2dot(obj.x + obj.w, d)
      const y2 = mm2dot(obj.y + obj.h, d)
      L.push(`ELLIPSE ${x1} ${y1} ${x2} ${y2} ${mm2dot(Math.max(0.1, obj.strokeWidth), d)}`)
    } else if (obj.type === 'image') {
      warnings.push('图片对象在 CPCL 指令打印中暂不支持（P1.2），已跳过')
    }
  }
  L.push('FORM')
  L.push('PRINT')
  return L.join('\n')
}

function cpclText(obj: TextObj, d: number, ctx: DataCtx, warnings: string[]): string {
  const text = resolveObjectText(obj, ctx)
  if (!text) return ''
  if (obj.arc) {
    warnings.push('弧形文字在 CPCL 暂不支持，已跳过')
    return ''
  }
  if (/[^\x00-\x7F]/.test(text)) {
    warnings.push('含中文的文本在 CPCL 需下载中文字体（P1.2），当前按内置字体输出')
  }
  const ymult = Math.max(1, Math.round(mm2dot(obj.fontSize, d) / 8))
  const xmult = Math.max(1, Math.round(ymult / 2))
  const x = mm2dot(obj.x, d)
  const y = mm2dot(obj.y, d)
  if (obj.rotation !== 0) warnings.push('CPCL 文本旋转暂不支持，已忽略旋转角度')
  return `TEXT ${xmult} ${ymult} ${x} ${y} ${q(text)}`
}

function cpclBarcode(obj: BarcodeObj, d: number, ctx: DataCtx, warnings: string[]): string {
  const text = resolveObjectText(obj, ctx)
  if (!text) return ''
  const type = CPCL_SYM[obj.symbology] ?? '128'
  const x = mm2dot(obj.x, d)
  const y = mm2dot(obj.y, d)
  const h = mm2dot(obj.h, d)
  if (obj.rotation !== 0) warnings.push('CPCL 条码旋转暂不支持，已忽略旋转角度')
  if (obj.symbology === 'qrcode') {
    warnings.push('CPCL 二维码语法请在真机验证')
    return `BARCODE QRCODE ${x} ${y} 4 ${q(text)}`
  }
  return `BARCODE ${type} ${x} ${y} ${h} ${obj.showText ? 1 : 0} 1 2 ${q(text)}`
}

/** 表格：外框 BOX + 内部网格 LINE */
function cpclTable(obj: TableObj, d: number, L: string[]): void {
  const x1 = mm2dot(obj.x, d)
  const y1 = mm2dot(obj.y, d)
  const x2 = mm2dot(obj.x + obj.w, d)
  const y2 = mm2dot(obj.y + obj.h, d)
  const t = mm2dot(Math.max(0.1, obj.borderWidth), d)
  L.push(`BOX ${x1} ${y1} ${x2} ${y2} ${t}`)
  for (let i = 1; i < obj.cols; i++) {
    const cx = mm2dot(obj.x + (obj.w * i) / obj.cols, d)
    L.push(`LINE ${cx} ${y1} ${cx} ${y2} ${t}`)
  }
  for (let j = 1; j < obj.rows; j++) {
    const cy = mm2dot(obj.y + (obj.h * j) / obj.rows, d)
    L.push(`LINE ${x1} ${cy} ${x2} ${cy} ${t}`)
  }
}
