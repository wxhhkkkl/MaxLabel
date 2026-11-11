// ---------- TSPL（TSC 指令集，覆盖佳博/得力/汉印/芯烨/启锐等国产标签机） ----------
import { barcodeHumanTextBlockMm, type BarcodeObj, type RfidObj, type TextObj } from '../domain/objects'
import type { MonoBitmap } from '../domain/units'
import type { PrinterConfig } from '../domain/printer'
import { fmt, mm2dot } from './geometry'
import type { ResolvedPrintScene } from './scene'
import { pushProtocolWarning, type WarningTarget } from './warnings'
import { barcodeNativeHumanText, barcodePrinterFontFallbackReason } from './capabilities'
import { tableColXs, tableRowYs, tableSegmentHidden } from '../table'
import { displayBarcodeText } from '../domain/barcodeCharset'

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
  // TSPL 内置点阵字体字符基宽 8 点
  return (text.length * 8 * xmult) / (dpi / 25.4)
}

/** TSPL 字体名是数字 "0"-"8"；内部配置使用 Font0-Font8。 */
function tsplFontName(printerFont: string | undefined): string {
  return /^Font([0-8])$/i.exec(printerFont ?? '')?.[1] ?? '0'
}

/**
 * TSPL 字体名 "0"-"8" 都是内建点阵字体，x/y 参数是**整数放大倍率**，不是磅值。
 * 字体 "0" 的基准是 8×12 点；按目标字号换算出倍率。旧实现把字号当磅值直接写入，
 * 汉印等机型会再按 8×12 放大 → 8pt 文字变成 8mm×12mm 的巨型点阵字并超出标签。
 * 字体 "1"-"8" 沿用历史基准（16 点字高）。
 */
function tsplFontMultipliers(fontName: string, fontSizeMm: number, d: number): { xmult: number; ymult: number } {
  const h = mm2dot(fontSizeMm, d)
  if (fontName === '0') {
    const scale = Math.max(1, Math.round(h / 12))
    return { xmult: scale, ymult: scale }
  }
  const ymult = Math.max(1, Math.round(h / 16))
  const xmult = Math.max(1, Math.round(ymult / 2))
  return { xmult, ymult }
}

function tsplTextWidthMm(text: string, _fontName: string, _fontSizeMm: number, xmult: number, d: number): number {
  // 所有内建字体都是 8 点基宽的点阵字，倍率确定，宽度可以精确计算（用于人读文字居中）。
  return estTextWidthMm(text, xmult, d)
}

/** TSPL 没有 LINE 命令；水平/垂直线用 BAR 绘制，斜线交由整页位图回退。 */
function pushTsplLine(L: string[], x1: number, y1: number, x2: number, y2: number, thickness: number, warnings: WarningTarget): void {
  const t = Math.max(1, thickness)
  if (x1 === x2 && y1 === y2) {
    L.push(`BAR ${x1},${y1},${t},${t}`)
    return
  }
  if (y1 === y2) {
    L.push(`BAR ${Math.min(x1, x2)},${Math.max(0, y1 - Math.floor(t / 2))},${Math.abs(x2 - x1)},${t}`)
    return
  }
  if (x1 === x2) {
    L.push(`BAR ${Math.max(0, x1 - Math.floor(t / 2))},${Math.min(y1, y2)},${t},${Math.abs(y2 - y1)}`)
    return
  }
  pushProtocolWarning(warnings, 'unsupported-line-angle', 'TSPL BAR 只能绘制水平/垂直线，斜线需整页位图回退', 'error')
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
    // 对象位图：渲染层已单独裁好（文字/图片），按包围盒左上角落图；其余图元继续走原生指令。
    if (primitive.kind !== 'rfid' && 'bitmap' in primitive && primitive.bitmap) {
      const mono = primitive.bitmap
      const x = mm2dot(mono.originXMm ?? primitive.object.x, d)
      const y = mm2dot(mono.originYMm ?? primitive.object.y, d)
      // 透明位图用 mode=1（OR）只叠加黑点，不会擦掉下面已打印的条码/图形；
      // 带不透明底色的位图（反白文字、实心矩形）必须 mode=0 覆盖下层。
      const mode = mono.opaque ? 0 : 1
      L.push(`BITMAP ${x},${y},${mono.bytesPerRow},${mono.height},${mode},@@RAW:${primitive.labelIndex}:${primitive.object.id}@@`)
      continue
    }
    if (primitive.kind === 'text') {
      const t = tsplText(primitive.object, primitive.value, primitive.bitmap, primitive.labelIndex, d, warnings)
      if (t) L.push(t)
    } else if (primitive.kind === 'barcode') {
      const b = tsplBarcode(primitive.object, primitive.value, d, warnings, primitive)
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
      pushTsplLine(L, x1, y1, x2, y2, mm2dot(Math.max(0.1, obj.strokeWidth), d), warnings)
    } else if (primitive.kind === 'table') {
      tsplTable(primitive.object, d, L, warnings)
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
  const fontName = tsplFontName(obj.printerFont)
  const { xmult, ymult } = tsplFontMultipliers(fontName, obj.fontSize, d)
  let x = mm2dot(obj.x, d)
  const estW = tsplTextWidthMm(text, fontName, obj.fontSize, xmult, d)
  if (obj.align === 'center') x = mm2dot(obj.x, d) + mm2dot(Math.max(0, (obj.w - estW) / 2), d)
  else if (obj.align === 'right') x = mm2dot(obj.x, d) + mm2dot(Math.max(0, obj.w - estW), d)
  const y = mm2dot(obj.y, d)
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

function tsplBarcode(
  obj: BarcodeObj,
  text: string,
  d: number,
  warnings: WarningTarget,
  primitive?: { labelIndex: number; humanTextBitmap?: MonoBitmap }
): string {
  if (!text) return ''
  const x = mm2dot(obj.x, d)
  const fullY = mm2dot(obj.y, d)
  const fullH = mm2dot(obj.h, d)
  const r = rot(obj.rotation)
  if (obj.symbology === 'qrcode') {
    const ecc = /^[LMQH]$/.test(obj.barcodeOptions?.eclevel ?? '') ? obj.barcodeOptions!.eclevel : 'M'
    const cell = Math.max(1, Math.min(10, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.5, d))))
    return `QRCODE ${x},${fullY},${ecc},${cell},A,${r},M2,S7,${q(text)}`
  }
  if (obj.symbology === 'pdf417') {
    const ecc = Math.max(0, Math.min(8, Number(obj.barcodeOptions?.eclevel ?? 2) || 2))
    return `PDF417 ${x},${fullY},${mm2dot(obj.w, d)},${fullH},${r},P0,E${ecc},M0,${q(text)}`
  }
  if (obj.symbology === 'datamatrix') {
    const cell = Math.max(2, Math.min(10, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.5, d))))
    return `DMATRIX ${x},${fullY},${mm2dot(obj.w, d)},${fullH},x${cell},r${r},${q(text)}`
  }
  const type = TSPL_SYM[obj.symbology]
  if (!type) {
    pushProtocolWarning(warnings, 'unsupported-barcode', `TSPL 不支持原生码制 ${obj.symbology}，已跳过`, 'error')
    return ''
  }
  // 对象框高度含供人识读文字：柱体只占「框高 − 文字块」，文字在剩余部分排版。
  // 不这样处理时，固件按整框高画柱体、文字再另起一行，整条会比画布向下多出一个文字高。
  const upright = Math.abs(obj.rotation % 360) < 0.001
  const showHuman = obj.showText === true && obj.barcodeOptions?.humanPosition !== 'none'
  const above = obj.barcodeOptions?.humanPosition === 'above'
  const textBlockMm = showHuman && upright ? barcodeHumanTextBlockMm(obj, obj.barcodeOptions) : 0
  const barHeightMm = upright ? Math.max(1, obj.h - textBlockMm) : obj.h
  const barY = above && upright ? obj.y + textBlockMm : obj.y
  const y = mm2dot(barY, d)
  const h = mm2dot(barHeightMm, d)
  const narrow = Math.max(1, Math.round(mm2dot(obj.barcodeOptions?.xSizeMm || 0.25, d)))
  const wide = Math.max(narrow, Math.round(narrow * (obj.barcodeOptions?.w2n || 2)))
  // 固件画的人读文字在多数 TSPL 机型上从条码左端开始排（左对齐），与画布的居中/对齐不一致。
  // 因此 ASCII 内容一律改用独立的 TEXT 指令，位置按对象框 + humanAlign 计算，与画布同口径。
  // 旋转/中文仍交给固件（独立 TEXT 无法跟着条码旋转，中文字库也不一定存在）。
  const ownHuman = obj.showText === true
    && obj.barcodeOptions?.humanPosition !== 'none'
    && Math.abs(obj.rotation % 360) < 0.001
    && /^[\x00-\x7F]*$/.test(text)
  const nativeHuman = barcodeNativeHumanText(obj, 'tspl', text)
  const fallbackReason = nativeHuman ? null : barcodePrinterFontFallbackReason(obj, 'tspl', text)
  if (fallbackReason) pushProtocolWarning(warnings, 'printer-font-fallback', fallbackReason)
  const humanTextBitmap = primitive?.humanTextBitmap
  const command = `BARCODE ${x},${y},${q(type)},${h},${(humanTextBitmap || ownHuman) ? 0 : obj.showText ? 1 : 0},${r},${narrow},${wide},${q(text)}`
  // 渲染层已按画布字体/字宽生成人读文字位图：固件不画文字，改为叠加位图。
  if (humanTextBitmap && primitive) {
    const hx = mm2dot(humanTextBitmap.originXMm ?? obj.x, d)
    const hy = mm2dot(humanTextBitmap.originYMm ?? obj.y, d)
    return `${command}\nBITMAP ${hx},${hy},${humanTextBitmap.bytesPerRow},${humanTextBitmap.height},1,@@RAW:${primitive.labelIndex}:${obj.id}-humantext@@`
  }
  return ownHuman ? `${command}\n${tsplBarcodeHumanText(obj, text, d, barHeightMm)}` : command
}

/** 条码供人识读文字：位置按「条码框下方/上方 + 偏移 + 对齐」估算，与文字对象的 TEXT 指令同口径。 */
function tsplBarcodeHumanText(obj: BarcodeObj, text: string, d: number, barHeightMm: number): string {
  const fontSize = obj.fontSize ?? (8 * 25.4) / 72
  const fontName = tsplFontName(obj.printerFont)
  const { xmult, ymult } = tsplFontMultipliers(fontName, fontSize, d)
  // 显示文字与画布一致：EAN/UPC 补校验位、CodaBar 可隐藏起止符。
  const humanText = displayBarcodeText(obj.symbology, text, obj.barcodeOptions)
  const estW = tsplTextWidthMm(humanText, fontName, fontSize, xmult, d)
  const align = obj.barcodeOptions?.humanAlign ?? 'center'
  const xMm = align === 'left' ? obj.x : align === 'right' ? obj.x + Math.max(0, obj.w - estW) : obj.x + Math.max(0, (obj.w - estW) / 2)
  const gap = Math.max(0, obj.barcodeOptions?.humanOffsetMm ?? 0)
  // 文字块在对象框内部：上方文字贴着框顶，下方文字接在柱体下方（柱体已让出文字块）。
  const yMm = obj.barcodeOptions?.humanPosition === 'above'
    ? Math.max(0, obj.y)
    : Math.max(0, obj.y + barHeightMm + gap)
  return `TEXT ${mm2dot(xMm, d)},${mm2dot(yMm, d)},${q(fontName)},0,${xmult},${ymult},0,${q(humanText)}`
}

/** 表格：外框 BOX + 内部网格 BAR（TSPL 原生支持） */
function tsplTable(obj: import('../domain/objects').TableObj, d: number, L: string[], warnings: WarningTarget): void {
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
      if (!tableSegmentHidden(obj, j, i, 'v')) {
        pushTsplLine(L, mm2dot(obj.x + xs[i], d), mm2dot(obj.y + ys[j], d), mm2dot(obj.x + xs[i], d), mm2dot(obj.y + ys[j + 1], d), t, warnings)
      }
    }
  }
  for (let j = 1; j < obj.rows; j++) {
    for (let i = 0; i < obj.cols; i++) {
      if (!tableSegmentHidden(obj, j, i, 'h')) {
        pushTsplLine(L, mm2dot(obj.x + xs[i], d), mm2dot(obj.y + ys[j], d), mm2dot(obj.x + xs[i + 1], d), mm2dot(obj.y + ys[j], d), t, warnings)
      }
    }
  }
}
