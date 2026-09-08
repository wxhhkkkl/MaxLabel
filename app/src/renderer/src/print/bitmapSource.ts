// ---------- 渲染层位图预处理（浏览器 Canvas，指令打印嵌入图片/中文用） ----------
// 将图片 dataURL 或文本渲染为打印机点阵单色位图（1=黑），供 TSPL PUTBMP / ZPL ^GFA 嵌入。
import type { DataCtx, LabelDoc, MonoBitmap, PrinterConfig, TextObj } from '../types'
import { flattenObjects, resolveObjectText } from '../types'

function monoFromImageData(img: ImageData): MonoBitmap {
  const width = img.width
  const height = img.height
  const bytesPerRow = Math.ceil(width / 8)
  const bytes = new Uint8Array(bytesPerRow * height)
  const d = img.data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      if (lum < 128) {
        bytes[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }
  return { width, height, bytesPerRow, bytes }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

/** 图片 dataURL → 单色位图（按对象实际毫米尺寸 × dpi） */
export async function dataUrlToMonoBitmap(src: string, widthMm: number, heightMm: number, dpi: number): Promise<MonoBitmap> {
  const img = await loadImage(src)
  const dpm = dpi / 25.4
  const w = Math.max(1, Math.round(widthMm * dpm))
  const h = Math.max(1, Math.round(heightMm * dpm))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  if (!g) return { width: w, height: h, bytesPerRow: Math.ceil(w / 8), bytes: new Uint8Array(Math.ceil(w / 8) * h) }
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, w, h)
  g.drawImage(img, 0, 0, w, h)
  return monoFromImageData(g.getImageData(0, 0, w, h))
}

/** 文本 → 单色位图（按对象框毫米尺寸 × dpi，支持字体/加粗/对齐） */
export function textToMonoBitmap(
  text: string,
  opts: { fontFamily: string; bold: boolean; italic?: boolean; fontSizeMm: number; widthMm: number; heightMm: number; align: 'left' | 'center' | 'right' | 'justify'; dpi: number; arc?: boolean }
): MonoBitmap {
  const dpm = opts.dpi / 25.4
  const w = Math.max(1, Math.round(opts.widthMm * dpm))
  const h = Math.max(1, Math.round(opts.heightMm * dpm))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d')
  const empty = { width: w, height: h, bytesPerRow: Math.ceil(w / 8), bytes: new Uint8Array(Math.ceil(w / 8) * h) }
  if (!g) return empty
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, w, h)
  const fontSizePx = opts.fontSizeMm * dpm
  g.font = `${opts.bold ? 'bold ' : ''}${opts.italic ? 'italic ' : ''}${fontSizePx}px ${opts.fontFamily}, sans-serif`
  g.fillStyle = '#000000'
  if (opts.arc) {
    // 弧形文字：沿底部（相对对象框）半圆弧排布，方向与预览一致（顶部弧线）
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.save()
    g.translate(w / 2, h)
    const radius = w / 2
    const arcLen = text.length * fontSizePx
    const totalAngle = Math.min(Math.PI, arcLen / Math.max(0.5, radius))
    for (let i = 0; i < text.length; i++) {
      const t = text.length === 1 ? 0.5 : (i + 0.5) / text.length
      const angle = Math.PI - totalAngle / 2 + t * totalAngle
      const x = radius * Math.cos(angle)
      const y = -radius * Math.sin(angle)
      g.save()
      g.translate(x, y)
      g.rotate(angle - Math.PI / 2)
      g.fillText(text[i], 0, 0)
      g.restore()
    }
    g.restore()
  } else {
    g.textBaseline = 'top'
    g.textAlign = opts.align === 'center' ? 'center' : opts.align === 'right' ? 'right' : 'left'
    const tx = opts.align === 'center' ? w / 2 : opts.align === 'right' ? w : 0
    const ty = Math.max(0, (h - fontSizePx) / 2)
    g.fillText(text, tx, ty)
  }
  return monoFromImageData(g.getImageData(0, 0, w, h))
}

/** 按打印数量逐张预渲染位图：图片对象（每张相同）+ 含中文文本对象（每张按可变数据解析后渲染） */
export async function prepareImagesByLabel(
  doc: LabelDoc,
  printer: PrinterConfig,
  count: number,
  copies: number,
  keyboardValues: Record<string, string>
): Promise<Record<string, MonoBitmap>[]> {
  const staticImgs: Record<string, MonoBitmap> = {}
  for (const o of flattenObjects(doc.objects)) {
    const imgType = (o as { imgType?: string }).imgType
    if (o.type === 'image' && o.src && (!imgType || imgType === 'embed')) {
      try {
        staticImgs[o.id] = await dataUrlToMonoBitmap(o.src, o.w, o.h, printer.dpi)
      } catch {
        // 图片解析失败则不嵌入，构建器会告警
      }
    }
  }
  const result: Record<string, MonoBitmap>[] = []
  for (let i = 0; i < count; i++) {
    const map: Record<string, MonoBitmap> = { ...staticImgs }
    const ctx: DataCtx = {
      labelIndex: i + 1,
      recordIndex: i,
      copy: copies,
      count,
      totalLabels: count,
      title: doc.name,
      printerName: '',
      datasets: doc.datasets ?? {},
      sharedVars: {},
      keyboardValues
    }
    for (const o of flattenObjects(doc.objects)) {
      if (o.type === 'image' && ((o as { imgType?: string }).imgType === 'link' || (o as { imgType?: string }).imgType === 'datasource')) {
        const img = o as { id: string; linkPath?: string; source?: import('../types').DataSource; imgType?: string; src: string; w: number; h: number }
        let src = ''
        if (img.imgType === 'link' && img.linkPath) {
          try {
            const r = await window.maxlabel.readImage(img.linkPath)
            src = r.ok && r.dataUrl ? r.dataUrl : ''
          } catch {
            src = ''
          }
        } else if (img.imgType === 'datasource') {
          const name = resolveObjectText(img as never, ctx as never)
          if (name) {
            const dir = img.linkPath ? img.linkPath.replace(/[\\/]+$/, '') : ''
            const full = dir ? dir + '\\' + name : name
            try {
              const r = await window.maxlabel.readImage(full)
              src = r.ok && r.dataUrl ? r.dataUrl : ''
            } catch {
              src = ''
            }
          } else {
            src = ''
          }
        }
        if (src) {
          try {
            map[o.id] = await dataUrlToMonoBitmap(src, o.w, o.h, printer.dpi)
          } catch {
            // 图片解析失败则不嵌入
          }
        }
      }
      if (o.type === 'text') {
        const text = resolveObjectText(o as TextObj, ctx)
        // 含中文 / 弧形文字均走位图嵌入（指令打印机无对应原生能力）
        if (/[^\x00-\x7F]/.test(text) || (o as TextObj).arc) {
          map[o.id] = textToMonoBitmap(text, {
            fontFamily: (o as TextObj).fontFamily,
            bold: (o as TextObj).bold,
            italic: (o as TextObj).italic,
            fontSizeMm: (o as TextObj).fontSize,
            widthMm: o.w,
            heightMm: o.h,
            align: (o as TextObj).align,
            dpi: printer.dpi,
            arc: (o as TextObj).arc
          })
        }
      }
    }
    result.push(map)
  }
  return result
}
