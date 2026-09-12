// ---------- TSPL（TSC 指令集，覆盖佳博/得力/汉印/芯烨/启锐等国产标签机） ----------
import type { BarcodeObj, RfidObj, TextObj } from '../domain/objects'
import type { MonoBitmap } from '../domain/units'
import type { PrinterConfig } from '../domain/printer'
import { fmt, mm2dot } from './geometry'
import type { ResolvedPrintScene } from './scene'
import { pushProtocolWarning, type WarningTarget } from './warnings'
import { tableColXs, tableRowYs, tableSegmentHidden } from '../table'

const TSPL_SYM: Record<string, string> = {
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

/** TSPL 字符串转义（内部双引号替换） */
function q(s: string): string {
  return '"' + s.replace(/[\r\n\t\u0000-\u001f\u007f]/g, ' ').replace(/"/g, "'") + '"'
}

/** 旋转角 → TSPL 旋转码（0/90/180/270） */
function rot(d: number): number {
  return (((Math.round(d / 90) % 4) + 4) % 4) * 90
}

function estTextWidthMm(text: string, xmult: number, dpi: number): number {
  // TSPL 内置字体 Font 0 字符基宽 8 点
  return (text.length * 8 * xmult) / (dpi / 25.4)
}

export function buildTSPL(scene: ResolvedPrintScene, printer: PrinterConfig, warnings: WarningTarget, pageToken = String(Math.max(0, scene.labelIndex - 1))): string {
  const d = printer.dpi
  const L: string[] = []
  L.push(`SIZE ${fmt(scene.widthMm)} mm,${fmt(scene.heightMm)} mm`)
  if (printer.labelType === 'gap') L.push('GAP 2 mm,0 mm')
  else if (printer.labelType === 'mark') L.push('BLINE 2 mm,0 mm')
  // continuous：不输出 GAP
  L.push(`DENSITY ${printer.density}`)
  L.push(`SPEED ${printer.speed}`)
  L.push('DIRECTION 1')
  L.push(`REFERENCE 0,${mm2dot(printer.topOffsetMm, d)}`)
  if (printer.mediaHandle === 'tear') L.push('TEAR ON')
  else if (printer.mediaHandle === 'peel') L.push('PEEL ON')
  else if (printer.mediaHandle === 'cut') L.push('CUT ON')
  if (printer.backfeedMm > 0) L.push(`BACKFEED ${Math.max(1, mm2dot(printer.backfeedMm, d))}`)
  L.push('CLS')
  if (scene.pageBitmap) {
    L.push(`BITMAP 0,0,${scene.pageBitmap.bytesPerRow},${scene.pageBitmap.height},0,@@PAGE_RAW:${pageToken}@@`)
  }
  for (const primitive of scene.primitives) {
    if (scene.pageBitmap && primitive.kind !== 'rfid') continue
    if (primitive.kind === 'text') {
      const t = tsplText(primitive.object, primitive.value, primitive.bitmap, primitive.labelIndex, d, warnings)
      if (t) L.push(t)
    } else if (primitive.kind === 'barcode') {
      const b = tsplBarcode(primitive.object, primitive.value, d, warnings)
      if (b) L.push(b)
    } else if (primitive.kind === 'rfid') {
      const r = tsplRfid(primitive.object, primitive.value, warnings)
      if (r) L.push(r)
    } else if (primitive.kind === 'rect') {
      const obj = primitive.object
      const x1 = mm2dot(obj.x, d)
      const y1 = mm2dot(obj.y, d)
      const x2 = mm2dot(obj.x + obj.w, d)
      const y2 = mm2dot(obj.y + obj.h, d)
      L.push(`BOX ${x1},${y1},${x2},${y2},${mm2dot(Math.max(0.1, obj.strokeWidth), d)},0`)
    } else if (primitive.kind === 'line') {
      const obj = primitive.object
      const x1 = mm2dot(obj.x, d)
      const y1 = mm2dot(obj.y, d)
      const x2 = mm2dot(obj.x + obj.w, d)
      const y2 = mm2dot(obj.y + obj.h, d)
      L.push(`LINE ${x1},${y1},${x2},${y2},${mm2dot(Math.max(0.1, obj.strokeWidth), d)}`)
    } else if (primitive.kind === 'table') {
      tsplTable(primitive.object, d, L)
    } else if (primitive.kind === 'ellipse') {
      pushProtocolWarning(warnings, 'unsupported-ellipse', 'TSPL 无椭圆指令，已跳过（驱动打印模式可输出）', 'error')
    } else if (primitive.kind === 'image') {
      const obj = primitive.object
      const mono = primitive.bitmap
      if (mono) {
        const x = mm2dot(obj.x, d)
        const y = mm2dot(obj.y, d)
        L.push(`BITMAP ${x},${y},${mono.bytesPerRow},${mono.height},0,@@RAW:${primitive.labelIndex}:${obj.id}@@`)
      } else {
        pushProtocolWarning(warnings, 'missing-image-bitmap', '图片对象缺少预渲染位图，TSPL 指令无法完整输出，已跳过', 'error')
      }
    }
  }
  // PRINT m,n：m=套数，n=每套份数。
  L.push(`PRINT 1,${scene.copy}`)
  return L.join('\n')
}

function tsplText(obj: TextObj, text: string, mono: MonoBitmap | undefined, labelIndex: number, d: number, warnings: WarningTarget): string {
  if (!text) return ''
  // 弧形文字：走位图回退（由渲染层预渲染，引擎无法原生弧形）
  if (obj.arc) {
    if (mono) {
      const x = mm2dot(obj.x, d)
      const y = mm2dot(obj.y, d)
      return `BITMAP ${x},${y},${mono.bytesPerRow},${mono.height},0,@@RAW:${labelIndex}:${obj.id}@@`
    }
    pushProtocolWarning(warnings, 'missing-text-bitmap', '弧形文字在 TSPL 需下载位图，已跳过', 'error')
    return ''
  }
  // 含中文（或非内置字体可覆盖）的文本：若已预渲染为位图，则走 PUTBMP 嵌入
  if (/[^\x00-\x7F]/.test(text)) {
    if (mono) {
      const x = mm2dot(obj.x, d)
      const y = mm2dot(obj.y, d)
      return `BITMAP ${x},${y},${mono.bytesPerRow},${mono.height},0,@@RAW:${labelIndex}:${obj.id}@@`
    }
    pushProtocolWarning(warnings, 'native-chinese-fallback', '含中文的文本缺少预渲染位图，当前按 TSPL 内置字体输出，字形可能不一致')
  }
  const h = mm2dot(obj.fontSize, d)
  const ymult = Math.max(1, Math.round(h / 16)) // Font 0 基高 16 点
  const xmult = Math.max(1, Math.round(ymult / 2))
  let x = mm2dot(obj.x, d)
  const estW = estTextWidthMm(text, xmult, d)
  if (obj.align === 'center') x = mm2dot(obj.x, d) + mm2dot(Math.max(0, (obj.w - estW) / 2), d)
  else if (obj.align === 'right') x = mm2dot(obj.x, d) + mm2dot(Math.max(0, obj.w - estW), d)
  const y = mm2dot(obj.y, d)
  // 打印机内建字体（Font0-Font8）：优先使用内建字体（字符基宽 8 点）
  const fontName = obj.printerFont && /^Font[0-8]$/i.test(obj.printerFont) ? obj.printerFont : '0'
  return `TEXT ${x},${y},${q(fontName)},${rot(obj.rotation)},${xmult},${ymult},0,${q(text)}`
}

/** RFID：写入标签（需 RFID 打印头）。数据按数据源解析，支持 EPC/USER/TID 区 */
function tsplRfid(obj: RfidObj, text: string, warnings: WarningTarget): string {
  if (!text) return ''
  pushProtocolWarning(warnings, 'rfid-firmware-dependent', 'RFID 写入指令随固件而异，请在真机验证')
  if (obj.readerType && obj.readerType !== 'auto') pushProtocolWarning(warnings, 'rfid-reader-profile-ignored', `当前 TSPL 适配器未实现读写器类型“${obj.readerType}”，已按打印机默认读写器输出`)
  const L: string[] = []
  // 数据类型：hex=十六进制原样；ascii=按 ASCII 转十六进制；默认自动（纯十六进制原样，否则 ASCII 转码）
  let dataHex: string
  if (obj.dataType === 'hex') {
    dataHex = text.toUpperCase()
  } else if (obj.dataType === 'ascii') {
    dataHex = asciiToHex(text)
  } else {
    dataHex = /^[0-9A-Fa-f]+$/.test(text) ? text.toUpperCase() : asciiToHex(text)
  }
  const block = obj.startBlock && obj.startBlock > 0 ? `,${obj.startBlock}` : ''
  if (obj.bank === 'EPC') {
    L.push(`RFID;EPC,${dataHex}${block}`)
  } else {
    L.push(`RFID;${obj.bank},${dataHex}${block}`)
  }
  // EPC 区 PC 协议控制字（ISO1800-6C）
  if (obj.bank === 'EPC' && obj.pcWord) {
    L.push(`RFID;PC,${obj.pcWord.replace(/^0x/i, '')}`)
  }
  // 国标/军标协议编码码头及编码长度
  if (obj.codeHead || (obj.codeLen && obj.codeLen > 0)) {
    const ch = obj.codeHead || ''
    const cl = obj.codeLen && obj.codeLen > 0 ? obj.codeLen : ''
    L.push(`RFID;HEAD,${ch}${cl !== '' ? ',' + cl : ''}`)
  }
  // 访问控制：锁定 / 解锁 / 永久锁定
  if (obj.lock || obj.lockOp) {
    const op = obj.lockOp === 'unlock' ? 'UNLOCK' : obj.lockOp === 'permanent' ? 'PERMALOCK' : 'LOCK'
    const ap = obj.accessPwd ?? '00000000'
    const kp = obj.killPwd ?? '00000000'
    L.push(`RFID;${op},${ap},${kp},${obj.bank}`)
  }
  return L.join('\n')
}

function asciiToHex(s: string): string {
  let hex = ''
  for (let i = 0; i < s.length; i++) {
    hex += s.charCodeAt(i).toString(16).padStart(2, '0')
  }
  return hex.toUpperCase()
}

function tsplBarcode(obj: BarcodeObj, text: string, d: number, warnings: WarningTarget): string {
  if (!text) return ''
  const x = mm2dot(obj.x, d)
  const y = mm2dot(obj.y, d)
  const h = mm2dot(obj.h, d)
  const r = rot(obj.rotation)
  if (obj.symbology === 'qrcode') {
    const ecc = /^[LMQH]$/.test(obj.barcodeOptions?.eclevel ?? '') ? obj.barcodeOptions!.eclevel : 'M'
    const cell = Math.max(1, Math.min(10, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.5, d))))
    return `QRCODE ${x},${y},${ecc},${cell},A,${r},M2,S7,${q(text)}`
  }
  if (obj.symbology === 'pdf417') {
    const ecc = Math.max(0, Math.min(8, Number(obj.barcodeOptions?.eclevel ?? 2) || 2))
    return `PDF417 ${x},${y},${mm2dot(obj.w, d)},${h},${r},P0,E${ecc},M0,${q(text)}`
  }
  if (obj.symbology === 'datamatrix') {
    const cell = Math.max(2, Math.min(10, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.5, d))))
    return `DMATRIX ${x},${y},${mm2dot(obj.w, d)},${h},x${cell},r${r},${q(text)}`
  }
  const type = TSPL_SYM[obj.symbology]
  if (!type) {
    pushProtocolWarning(warnings, 'unsupported-barcode', `TSPL 不支持原生码制 ${obj.symbology}，已跳过`, 'error')
    return ''
  }
  const narrow = Math.max(1, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.25, d)))
  const wide = Math.max(narrow, Math.round(narrow * (obj.barcodeOptions?.w2n || 2)))
  return `BARCODE ${x},${y},${q(type)},${h},${obj.showText ? 1 : 0},${r},${narrow},${wide},${q(text)}`
}

/** 表格：外框 BOX + 内部网格 LINE（TSPL 原生支持） */
function tsplTable(obj: import('../domain/objects').TableObj, d: number, L: string[]): void {
  const x1 = mm2dot(obj.x, d)
  const y1 = mm2dot(obj.y, d)
  const x2 = mm2dot(obj.x + obj.w, d)
  const y2 = mm2dot(obj.y + obj.h, d)
  const t = mm2dot(Math.max(0.1, obj.borderWidth), d)
  L.push(`BOX ${x1},${y1},${x2},${y2},${t},0`)
  const xs = tableColXs(obj)
  const ys = tableRowYs(obj)
  for (let i = 1; i < obj.cols; i++) {
    for (let j = 0; j < obj.rows; j++) {
      if (!tableSegmentHidden(obj, j, i, 'v')) L.push(`LINE ${mm2dot(obj.x + xs[i], d)},${mm2dot(obj.y + ys[j], d)},${mm2dot(obj.x + xs[i], d)},${mm2dot(obj.y + ys[j + 1], d)},${t}`)
    }
  }
  for (let j = 1; j < obj.rows; j++) {
    for (let i = 0; i < obj.cols; i++) {
      if (!tableSegmentHidden(obj, j, i, 'h')) L.push(`LINE ${mm2dot(obj.x + xs[i], d)},${mm2dot(obj.y + ys[j], d)},${mm2dot(obj.x + xs[i + 1], d)},${mm2dot(obj.y + ys[j], d)},${t}`)
    }
  }
}
