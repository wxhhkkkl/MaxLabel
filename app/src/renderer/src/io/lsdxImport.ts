// 签赋 LabelShop .lsdx 标签文件导入器（XML → MaxLabel LabelDoc）
// 依据：LabelShop V6.39 实测保存的 .lsdx 样例（XML utf-8，坐标单位 1/100mm）。
// 覆盖：页面/标签尺寸、拼版布局、条码（含码制映射）、文本、线/矩形/椭圆、组合、常量/序列号/数据库/键盘变量。
// 未覆盖（样例缺失、结构未知）：图片对象、表格、RFID —— 打开后给出提示并可手动重建。

import { uid, round2 } from '../types'
import type {
  BarcodeObj,
  DataSource,
  EllipseObj,
  GroupObj,
  ImageObj,
  LabelDoc,
  LabelObject,
  LineObj,
  RectObj,
  TextObj
} from '../types'

export interface LsdxImportResult {
  doc: LabelDoc
  warnings: string[]
}

/** LabelShop 码制编号 → bwip-js bcid（btype=2 经样例确认 Code128，其余按原版对话框顺序推断，可修订） */
const BTYPE_MAP: Record<number, string> = {
  0: 'code128', // Code 128（自动）
  1: 'code39', // Code 39
  2: 'code128', // Code 128（样例确认）
  3: 'ean13', // EAN-13
  4: 'ean8', // EAN-8
  5: 'upca', // UPC-A
  6: 'upce', // UPC-E
  7: 'interleaved2of5', // ITF-25
  8: 'code93', // Code 93
  9: 'codabar', // Codabar
  10: 'itf14', // ITF-14
  11: 'industrial2of5', // Code 25
  12: 'matrix2of5', // Matrix 25
  13: 'datalogic2of5', // 中国邮政码
  14: 'databaromni', // GS1 DataBar
  15: 'qrcode', // QR Code
  16: 'datamatrix', // Data Matrix
  17: 'pdf417', // PDF417
  18: 'hanxin' // 汉信码
}

const MM = 100 // lsdx 坐标单位：1/100mm

function rotToDeg(r: string | null): number {
  const v = Number(r ?? '0')
  if (v === 0) return 0
  if (v === 90) return 90
  if (v === 180) return 180
  if (v === 270) return 270
  if (r === 'none' || r === '') return 0
  return Number.isFinite(v) ? v : 0
}

function num(el: Element | null, attr: string, dflt = 0): number {
  if (!el) return dflt
  const v = el.getAttribute(attr)
  if (v === null || v === '') return dflt
  const n = Number(v)
  return Number.isFinite(n) ? n : dflt
}

function rgbToHex(s: string | null | undefined, dflt = '#000000'): string {
  if (!s) return dflt
  const parts = s.split(',').map((x) => parseInt(x.trim(), 10))
  if (parts.length < 3 || parts.some((x) => !Number.isFinite(x))) return dflt
  const c = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return '#' + c(parts[0]) + c(parts[1]) + c(parts[2])
}

function b64ToUtf8(b64: string): string {
  try {
    const bin = atob(b64.replace(/\s+/g, ''))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    return ''
  }
}

/**
 * 解析 objvarlink：以 ":" 分段，每段 "对象id,变量id"（变量可省）。
 * 例：":2,1" → 对象2←变量1；":1:4,3:5" → 对象4←变量3；":2,1:4,3:6,5:8,7:9:16:17" → 2←1、4←3、6←5、8←7、9/16/17 无变量
 */
function parseObjVarLink(link: string | null | undefined): Map<string, string> {
  const m = new Map<string, string>()
  if (!link) return m
  for (const seg of link.split(':').filter(Boolean)) {
    const parts = seg.split(',')
    const objId = parts[0]
    if (!objId) continue
    if (parts.length > 1 && parts[1]) m.set(objId, parts[1])
  }
  return m
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function hasPngHead(b: Uint8Array): boolean {
  return b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
}
function hasJpegHead(b: Uint8Array): boolean {
  return b.length > 3 && b[0] === 0xff && b[1] === 0xd8
}
function hasGifHead(b: Uint8Array): boolean {
  return b.length > 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38
}
function hasBmpHead(b: Uint8Array): boolean {
  return b.length > 2 && b[0] === 0x42 && b[1] === 0x4d
}

function bytesToDataUrl(b: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i])
  const mime = hasPngHead(b) ? 'image/png' : hasJpegHead(b) ? 'image/jpeg' : hasGifHead(b) ? 'image/gif' : hasBmpHead(b) ? 'image/bmp' : 'image/png'
  return 'data:' + mime + ';base64,' + btoa(bin)
}

/** zlib deflate 解压（LabelShop 内嵌图片 compress=2） */
async function inflateDeflate(bin: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate')
  const stream = new Blob([bin.buffer as ArrayBuffer]).stream().pipeThrough(ds)
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

export async function importLsdx(xml: string, suggestedName?: string): Promise<LsdxImportResult> {
  const warnings: string[] = []
  const parser = new DOMParser()
  const docXml = parser.parseFromString(xml, 'text/xml')
  const root = docXml.documentElement
  if (!root || root.tagName !== 'labelshopdocument') {
    throw new Error('不是有效的 LabelShop 标签文件（labelshopdocument 根节点缺失）')
  }

  const labelForm = root.querySelector('labelform')
  const labelEl = labelForm?.querySelector('label')
  const labelNameEl = labelForm?.querySelector('paper[name]')

  const wMm = labelEl ? num(labelEl, 'width', 0) / MM : 0
  const hMm = labelEl ? num(labelEl, 'height', 0) / MM : 0
  if (!wMm || !hMm) throw new Error('标签文件中未找到有效的标签尺寸')

  // 拼版布局
  const layout: LabelDoc['layout'] = {
    rows: labelEl ? Math.max(1, num(labelEl, 'rows', 1)) : 1,
    cols: labelEl ? Math.max(1, num(labelEl, 'cols', 1)) : 1,
    rowGapMm: labelEl ? num(labelEl, 'rowgap', 0) / MM : 0,
    colGapMm: labelEl ? num(labelEl, 'colgap', 0) / MM : 0,
    shape: 'rect'
  }

  // 变量表
  const variables = new Map<string, { type: string; source: DataSource }>()
  labelForm?.querySelectorAll('variable').forEach((v) => {
    const id = v.getAttribute('id')
    if (!id) return
    const type = v.getAttribute('type') || 'constant'
    let source: DataSource = { kind: 'constant', value: '' }
    if (type === 'constant') {
      source = { kind: 'constant', value: b64ToUtf8(v.getAttribute('data') || '') }
    } else if (type === 'serial') {
      const chars = v.getAttribute('serealchars') || ''
      const startNum = parseInt(chars, 10)
      source = {
        kind: 'serial',
        prefix: '',
        start: Number.isFinite(startNum) ? startNum : 1,
        step: Math.max(1, num(v, 'serialstep', 1)),
        digits: 0,
        current: Number.isFinite(startNum) ? startNum : 1
      }
    } else if (type === 'database') {
      source = { kind: 'database', dataset: '', field: v.getAttribute('databasefield') || '' }
    } else if (type === 'keyboard') {
      source = { kind: 'keyboard', label: v.getAttribute('keyboardprompt') || '' }
    } else {
      warnings.push('变量 ' + id + ' 的类型（' + type + '）暂不支持，已按固定文本处理')
    }
    variables.set(id, { type, source })
  })

  // 对象-变量关联
  const objVarLink = parseObjVarLink(labelForm?.querySelector('objvarlink')?.getAttribute('link'))

  const objects: LabelObject[] = []
  const walkObjs = async (container: Element | null | undefined, list: LabelObject[]) => {
    if (!container) return
    for (const drawEl of Array.from(container.querySelectorAll(':scope > drawobj'))) {
      const obj = await convertDrawObj(drawEl, objVarLink, variables, warnings)
      if (obj) list.push(obj)
    }
  }

  await walkObjs(labelForm?.querySelector('labelobjects'), objects)

  const doc: LabelDoc = {
    version: 1,
    name: suggestedName ? suggestedName.replace(/\.lsdx$/i, '') : '导入标签',
    widthMm: wMm,
    heightMm: hMm,
    objects,
    layout
  }

  return { doc, warnings }
}

async function convertDrawObj(
  drawEl: Element,
  objVarLink: Map<string, string>,
  variables: Map<string, { type: string; source: DataSource }>,
  warnings: string[]
): Promise<LabelObject | null> {
  const type = drawEl.getAttribute('type') || ''
  const id = drawEl.getAttribute('id') || ''
  const left = num(drawEl, 'left') / MM
  const top = num(drawEl, 'top') / MM
  const right = num(drawEl, 'right') / MM
  const bottom = num(drawEl, 'bottom') / MM
  const x = left
  const y = top
  const w = Math.max(0.01, right - left)
  const h = Math.max(0.01, bottom - top)
  const rotation = rotToDeg(drawEl.getAttribute('rotation'))
  const base = { id: uid(), x: round2(x), y: round2(y), w: round2(w), h: round2(h), rotation }

  // 数据源：优先对象-变量关联，其次对象内联文本
  const varId = objVarLink.get(id)
  const varSource = varId ? variables.get(varId)?.source : undefined

  const fontEl = drawEl.querySelector('font')
  const colorEl = drawEl.querySelector('color')

  switch (type) {
    case 'drawbarcode': {
      const barcodeEl = drawEl.querySelector('barcode')
      const btype = num(barcodeEl, 'btype', 2)
      const symbology = BTYPE_MAP[btype] || 'code128'
      if (!BTYPE_MAP[btype]) warnings.push('条码对象 ' + id + ' 码制编号 ' + btype + ' 未确认，按 Code128 打开')
      const barwidth = num(barcodeEl, 'barwidth', 0)
      const radio = num(barcodeEl, 'radio', 0)
      const wide = num(barcodeEl, 'wide', 0)
      const readable = num(barcodeEl, 'readable', 0)
      const template = barcodeEl?.getAttribute('templtestr') || ''
      const obj: BarcodeObj = {
        ...base,
        type: 'barcode',
        symbology,
        showText: readable !== 0,
        source: varSource ?? { kind: 'constant', value: '' },
        barcodeOptions: {
          xSizeMm: barwidth > 0 ? round2(barwidth / 1000) : undefined,
          w2n: radio > 0 && wide > 0 && Math.abs(wide - radio) > 1 ? round2(wide / radio) : undefined
        }
      }
      if (template) obj.charTemplate = template
      return obj
    }
    case 'drawtext': {
      // 文本内容：子元素 <text> 的 str 属性 / 文本节点 / drawobj text 属性，多路兼容
      const textEl = drawEl.querySelector('text')
      let value = ''
      if (textEl) {
        value =
          textEl.getAttribute('str') ??
          textEl.getAttribute('text') ??
          textEl.getAttribute('value') ??
          textEl.textContent ??
          ''
      } else {
        value = drawEl.getAttribute('text') || drawEl.getAttribute('str') || ''
      }
      const halign = num(drawEl, 'halign', 0)
      const fontStyle = num(fontEl, 'style', 0)
      const italic = num(fontEl, 'italic', 0)
      const underline = num(fontEl, 'underline', 0)
      const strike = num(fontEl, 'steikeout', 0)
      const obj: TextObj = {
        ...base,
        type: 'text',
        fontFamily: fontEl?.getAttribute('facename') || 'Arial',
        fontSize: fontEl ? Math.max(0.5, num(fontEl, 'height', 400) / MM) : Math.max(0.5, h * 0.8),
        bold: (fontStyle & 1) !== 0,
        italic: italic !== 0,
        underline: underline !== 0,
        strikeout: strike !== 0,
        align: halign === 1 ? 'center' : halign === 2 ? 'right' : 'left',
        color: rgbToHex(fontEl?.getAttribute('color'), '#000000'),
        source: varSource ?? { kind: 'constant', value }
      }
      return obj
    }
    case 'drawline': {
      const lineEl = drawEl.querySelector('line')
      const obj: LineObj = {
        ...base,
        type: 'line',
        stroke: rgbToHex(lineEl?.getAttribute('linecolor'), '#000000'),
        strokeWidth: lineEl ? Math.max(0.05, num(lineEl, 'linewidth', 30) / MM) : 0.3
      }
      return obj
    }
    case 'drawrect': {
      const rectEl = drawEl.querySelector('rect')
      const stroke = rgbToHex(rectEl?.getAttribute('linecolor') || rectEl?.getAttribute('color') || colorEl?.getAttribute('colors')?.split(',')[0], '#000000')
      const fillAttr = rectEl?.getAttribute('fill') || rectEl?.getAttribute('filled')
      const obj: RectObj = {
        ...base,
        type: 'rect',
        fill: fillAttr !== null && fillAttr !== undefined ? rgbToHex(fillAttr, '#ffffff') : 'transparent',
        stroke,
        strokeWidth: rectEl ? Math.max(0.05, num(rectEl, 'linewidth', 30) / MM) : 0.3
      }
      return obj
    }
    case 'drawellipse': {
      const el = drawEl.querySelector('ellipse')
      const stroke = rgbToHex(el?.getAttribute('linecolor') || el?.getAttribute('color'), '#000000')
      const obj: EllipseObj = {
        ...base,
        type: 'ellipse',
        fill: 'transparent',
        stroke,
        strokeWidth: el ? Math.max(0.05, num(el, 'linewidth', 30) / MM) : 0.3
      }
      return obj
    }
    case 'drawgroup': {
      const children: LabelObject[] = []
      const objectsEl = drawEl.querySelector('objects')
      for (const child of Array.from(objectsEl?.querySelectorAll(':scope > drawobj') ?? [])) {
        const c = await convertDrawObj(child, objVarLink, variables, warnings)
        if (c) children.push(c)
      }
      const obj: GroupObj = {
        ...base,
        type: 'group',
        children
      }
      return obj
    }
    case 'drawpicture': {
      const picEl = drawEl.querySelector('picture')
      const ptype = num(picEl, 'type', 0)
      const file = picEl?.getAttribute('file') || ''
      const dataB64 = (picEl?.textContent || '').trim()
      try {
        if (ptype === 0 && dataB64) {
          // 内嵌图片：可能为原始图片 base64（PNG/JPEG/GIF/BMP）或 zlib 压缩数据（compress=2）
          const raw = b64ToBytes(dataB64)
          let imgBytes: Uint8Array | null = null
          if (hasPngHead(raw) || hasJpegHead(raw) || hasGifHead(raw) || hasBmpHead(raw)) imgBytes = raw
          else imgBytes = await inflateDeflate(raw)
          if (imgBytes && imgBytes.length > 0) {
            const obj: ImageObj = { ...base, type: 'image', src: bytesToDataUrl(imgBytes), imgType: 'embed' }
            return obj
          }
        }
        if (ptype === 1 && file) {
          // 外链图片：读取本地文件并嵌入
          const r = (await window.maxlabel.readImage(file)) as { ok: boolean; dataUrl?: string; message?: string }
          if (r.ok && r.dataUrl) {
            const obj: ImageObj = { ...base, type: 'image', src: r.dataUrl, imgType: 'embed' }
            return obj
          }
          warnings.push('图片对象 ' + id + ' 引用的文件不存在或无法读取：' + file + '（请重新插入图片）')
          return null
        }
      } catch (e) {
        warnings.push('图片对象 ' + id + ' 图像数据解码失败：' + String((e as { message?: string }).message ?? e))
        return null
      }
      warnings.push('图片对象 ' + id + ' 无可用图像数据，请打开后重新插入图片')
      return null
    }
    case 'drawtable':
      warnings.push('表格对象 ' + id + ' 暂不支持导入，请打开后重建表格')
      return null
    case 'drawrfid':
      warnings.push('RFID 对象 ' + id + ' 暂不支持导入，请打开后重建')
      return null
    default:
      warnings.push('未知对象类型「' + type + '」已跳过')
      return null
  }
}
