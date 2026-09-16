import * as fabric from 'fabric'
import type { DataCtx, ImageObj, LabelObject } from '../types'
import { resolveObjectText, resolveObjectColor, resolveColorChangePlan } from '../types'
import { tableColXs, tableRowYs, tableSegmentHidden } from '../../../shared/table'
import { barcodeToDataURL } from '../editor/barcode'

export interface ObjectRenderOptions {
  ctx?: DataCtx
  colorTable?: string[]
  /** Output excludes editor-only objects and fails on missing resources. */
  output?: boolean
  /** Resource access is injected by the host instead of being hard-wired into
   * the geometry factory. This keeps rendering deterministic and testable. */
  resolveImage?: (path: string) => Promise<string>
}

/** 逐字符变色：按行写入 fabric 富文本 styles。 */
function applyCharColors(target: fabric.Object, content: string, colors: string[]): void {
  if (!colors.length) return
  const styled = target as unknown as { set: (key: string, value: unknown) => void }
  const styles: Record<number, Record<number, { fill: string }>> = {}
  let index = 0
  content.split('\n').forEach((line, lineIndex) => {
    const row: Record<number, { fill: string }> = {}
    Array.from(line).forEach((_, charIndex) => {
      row[charIndex] = { fill: colors[index % colors.length] }
      index += 1
    })
    styles[lineIndex] = row
  })
  styled.set('styles', styles)
}

/**
 * 单色黑白图片可变颜色：按亮度转成 alpha，再用目标颜色填充。
 * 帮助 color_main.html 限定图片可变颜色仅对单色黑白图有效。
 */
async function tintMonoImage(url: string, color: string): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('图片着色失败'))
    el.src = url
  })
  const width = Math.max(1, image.naturalWidth)
  const height = Math.max(1, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx2d = canvas.getContext('2d')
  if (!ctx2d) return url
  ctx2d.drawImage(image, 0, 0)
  const data = ctx2d.getImageData(0, 0, width, height)
  const rgb = /^#([0-9a-f]{6})$/i.exec(color.trim())
  const [cr, cg, cb] = rgb
    ? [(parseInt(rgb[1], 16) >> 16) & 255, (parseInt(rgb[1], 16) >> 8) & 255, parseInt(rgb[1], 16) & 255]
    : [0, 0, 0]
  for (let i = 0; i < data.data.length; i += 4) {
    const lum = (data.data[i] * 299 + data.data[i + 1] * 587 + data.data[i + 2] * 114) / 1000
    data.data[i] = cr
    data.data[i + 1] = cg
    data.data[i + 2] = cb
    data.data[i + 3] = Math.round((255 - lum) * (data.data[i + 3] / 255))
  }
  ctx2d.putImageData(data, 0, 0)
  return canvas.toDataURL('image/png')
}

/** 条码按区块/渐变变色：以透明底条码位图为蒙版，逐区块着色。 */
async function tintBarcodeBlocks(url: string, colors: string[], rows: number, cols: number): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('条码着色失败'))
    el.src = url
  })
  const width = Math.max(1, image.naturalWidth)
  const height = Math.max(1, image.naturalHeight)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const out = canvas.getContext('2d')
  if (!out) return url
  const region = document.createElement('canvas')
  region.width = width
  region.height = height
  const rc = region.getContext('2d')
  if (!rc) return url
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const color = colors[r * cols + c]
      if (!color) continue
      const x0 = Math.round((width * c) / cols)
      const y0 = Math.round((height * r) / rows)
      const x1 = Math.round((width * (c + 1)) / cols)
      const y1 = Math.round((height * (r + 1)) / rows)
      rc.clearRect(0, 0, width, height)
      rc.globalCompositeOperation = 'source-over'
      rc.drawImage(image, 0, 0)
      rc.globalCompositeOperation = 'source-in'
      rc.fillStyle = color
      rc.fillRect(0, 0, width, height)
      rc.globalCompositeOperation = 'source-over'
      out.drawImage(region, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0)
    }
  }
  return canvas.toDataURL('image/png')
}

export async function resolveImageSource(o: ImageObj, ctx?: DataCtx, resolveImage?: (path: string) => Promise<string>): Promise<string> {
  if (!o.imgType || o.imgType === 'embed') return o.src
  let path = o.linkPath ?? ''
  if (o.imgType === 'datasource') {
    const name = o.source ? resolveObjectText({ ...o, source: o.source }, ctx) : ''
    if (!name) return ''
    path = path ? path.replace(/[\\\\/]+$/, '') + '/' + name : name
  }
  if (!path) return ''
  if (resolveImage) return resolveImage(path)
  const r = await window.maxlabel.readImage(path)
  if (!r.ok || !r.dataUrl) throw new Error('无法读取图片：' + path)
  return r.dataUrl
}

export async function makeObject(o: LabelObject, sc: number, options: ObjectRenderOptions = {}): Promise<fabric.Object | null> {
  if (o.visible === false || (options.output && o.type === 'rfid')) return null
  const ctx = options.ctx
  const locked = (o as { locked?: boolean }).locked === true
  const common = {
    left: o.x * sc,
    top: o.y * sc,
    angle: o.rotation,
    originX: 'left' as const,
    originY: 'top' as const,
    evented: !locked,
    hasControls: !locked,
    lockMovementX: locked,
    lockMovementY: locked,
    lockScalingX: locked,
    lockScalingY: locked,
    lockRotation: locked,
    opacity: !options.output && o.suppressPrint ? 0.55 : 1,
    flipX: (o as { flipX?: boolean }).flipX === true,
    flipY: (o as { flipY?: boolean }).flipY === true,
  }
  switch (o.type) {
    case 'text': {
      const textContent = resolveObjectText(o, ctx)
      // 逐字符变色：文字对象使用 fabric 富文本 styles 着色（帮助 color_main.html）
      const colorPlan = resolveColorChangePlan(o, ctx, o.color, options.colorTable, textContent)
      const charColors = !o.reverse && colorPlan.kind === 'chars' ? colorPlan.colors : null
      if (o.arc || o.textType === 'circle') {
        const chars = Array.from(textContent)
        const radius = (o.arcRadius && o.arcRadius > 0 ? o.arcRadius : o.w / 2) * sc
        const extent = Math.min(360, Math.max(1, o.arcExtent ?? 180))
        const items = chars.map((char, i) => {
          const fraction = chars.length <= 1 ? 0.5 : i / (chars.length - 1)
          const angle = (o.arcAngle ?? 0) - 90 + (fraction - 0.5) * extent * (o.arcDir === 'ccw' ? -1 : 1)
          const radians = angle * Math.PI / 180
          return new fabric.Text(char, {
            left: radius * Math.cos(radians), top: radius * Math.sin(radians),
            originX: 'center', originY: 'center', angle: angle + 90 + (o.arcTextDir === 'in' ? 180 : 0),
            fontSize: o.fontSize * sc, fontFamily: o.fontFamily, fontWeight: o.bold ? 'bold' : 'normal',
            fontStyle: o.italic ? 'italic' : 'normal', underline: o.underline, linethrough: o.strikeout,
            scaleX: o.fontWidthScale ?? 1, charSpacing: o.charSpacing ?? 0,
            fill: o.reverse ? '#ffffff' : (charColors?.[i] ?? colorPlan.colors[0]),
            backgroundColor: o.reverse ? '#000000' : (o.backgroundTransparent ? '' : (o.backgroundColor ?? ''))
          })
        })
        if (!items.length) return null
        return new fabric.Group(items, common)
      }
      const align = (o.align as string) || 'left'
      const vAlign = ((o as { verticalAlign?: string }).verticalAlign) || 'top'
      const originX = align === 'center' ? 'center' as const : align === 'right' ? 'right' as const : 'left' as const
      const originY = vAlign === 'middle' ? 'center' as const : vAlign === 'bottom' ? 'bottom' as const : 'top' as const
      const left = align === 'center' ? (o.x + o.w / 2) * sc : align === 'right' ? (o.x + o.w) * sc : o.x * sc
      const top = vAlign === 'middle' ? (o.y + o.h / 2) * sc : vAlign === 'bottom' ? (o.y + o.h) * sc : o.y * sc
      const textOptions = {
        ...common,
        left,
        top,
        originX,
        originY,
        fontSize: o.fontSize * sc,
        fontFamily: o.fontFamily,
        fontWeight: o.bold ? 'bold' : 'normal',
        fontStyle: o.italic ? 'italic' : 'normal',
        underline: o.underline ?? false,
        linethrough: (o as { strikeout?: boolean }).strikeout ?? false,
        scaleX: o.fontWidthScale ?? 1,
        charSpacing: o.charSpacing ?? 0,
        fill: o.reverse ? '#ffffff' : colorPlan.colors[0],
        textAlign: o.align === 'justify' && o.textDock && o.textDock !== 'both' ? o.textDock : o.align,
        lineHeight: o.lineSpacingMm !== undefined ? (o.fontSize + Math.max(0, o.lineSpacingMm)) / Math.max(0.1, o.fontSize) : (o.lineSpacing ?? 1.16),
        backgroundColor: o.reverse ? '#000000' : (o.backgroundTransparent ? '' : (o.backgroundColor ?? ''))
      }
      const t = o.textType === 'multi' || o.lineWidth !== undefined
        ? new fabric.Textbox(textContent, { ...textOptions, width: (o.lineWidth ?? o.w) * sc } as never)
        : new fabric.Text(textContent, textOptions as never)
      if (charColors) applyCharColors(t, textContent, charColors)
      return Promise.resolve(t)
    }
    case 'rect': {
      const shape = o.shape ?? 'rect'
      const fill = o.fillEnabled === false ? 'transparent' : resolveObjectColor(o, ctx, o.fill, options.colorTable)
      if (shape === 'ellipse') {
        return Promise.resolve(new fabric.Ellipse({ ...common, width: o.w * sc, height: o.h * sc, rx: (o.w * sc) / 2, ry: (o.h * sc) / 2, fill, stroke: o.stroke, strokeWidth: o.strokeWidth * sc }))
      }
      const radius = shape === 'roundRect' ? Math.min(Math.max(0, o.cornerRadius ?? 0), Math.min(o.w, o.h) / 2) * sc : 0
      return Promise.resolve(new fabric.Rect({ ...common, width: o.w * sc, height: o.h * sc, rx: radius, ry: radius, fill, stroke: o.stroke, strokeWidth: o.strokeWidth * sc }))
    }
    case 'ellipse': {
      return Promise.resolve(
        new fabric.Ellipse({
          ...common,
          width: o.w * sc,
          height: o.h * sc,
          rx: (o.w * sc) / 2,
          ry: (o.h * sc) / 2,
          fill: o.fillEnabled === false ? 'transparent' : resolveObjectColor(o, ctx, o.fill, options.colorTable),
          stroke: o.stroke,
          strokeWidth: o.strokeWidth * sc
        })
      )
    }
    case 'table': {
      const colXs = tableColXs(o).map((v) => v * sc)
      const rowYs = tableRowYs(o).map((v) => v * sc)
      const items: fabric.Object[] = [
        new fabric.Rect({
          left: 0,
          top: 0,
          width: colXs[colXs.length - 1],
          height: rowYs[rowYs.length - 1],
          fill: 'transparent',
          stroke: o.borderColor,
          strokeWidth: o.borderWidth * sc,
          selectable: false,
          evented: false
        })
      ]
      for (let i = 1; i < o.cols; i++) {
        for (let j = 0; j < o.rows; j++) {
          if (tableSegmentHidden(o, j, i, 'v')) continue
          items.push(
            new fabric.Line([colXs[i], rowYs[j], colXs[i], rowYs[j + 1]], {
              stroke: o.borderColor,
              strokeWidth: o.borderWidth * sc,
              selectable: false,
              evented: false
            })
          )
        }
      }
      for (let j = 1; j < o.rows; j++) {
        for (let i = 0; i < o.cols; i++) {
          if (tableSegmentHidden(o, j, i, 'h')) continue
          items.push(
            new fabric.Line([colXs[i], rowYs[j], colXs[i + 1], rowYs[j]], {
              stroke: o.borderColor,
              strokeWidth: o.borderWidth * sc,
              selectable: false,
              evented: false
            })
          )
        }
      }
      return Promise.resolve(new fabric.Group(items, { ...common }))
    }
    case 'line': {
      return Promise.resolve(
        new fabric.Line(
          [o.x * sc, o.y * sc, (o.x + o.w) * sc, (o.y + o.h) * sc],
          { ...common, stroke: o.stroke, strokeWidth: o.strokeWidth * sc }
        )
      )
    }
    case 'rfid': {
      // RFID 不打印可见内容：虚线占位框 + 说明文字
      const frame = new fabric.Rect({
        left: 0,
        top: 0,
        width: o.w * sc,
        height: o.h * sc,
        fill: 'rgba(91,143,249,0.06)',
        stroke: '#5B8FF9',
        strokeWidth: 1,
        strokeDashArray: [5, 4],
        selectable: false,
        evented: false
      })
      const label = new fabric.Text(`RFID ${o.bank}\n${resolveObjectText(o, ctx)}`, {
        left: 2 * sc,
        top: 2 * sc,
        fontSize: Math.max(8, (o.h * sc) / 4),
        fill: '#5B8FF9',
        selectable: false,
        evented: false
      })
      return Promise.resolve(new fabric.Group([frame, label], { ...common }))
    }
    case 'barcode': {
      const barcodeContent = resolveObjectText(o, ctx)
      const barcodePlan = resolveColorChangePlan(o, ctx, (o as { color?: string }).color ?? '#000000', options.colorTable, barcodeContent)
      const blocks = barcodePlan.kind === 'block' || barcodePlan.kind === 'gradient'
      return barcodeToDataURL(o.symbology, barcodeContent, o.h, { barcodeOptions: (o as { barcodeOptions?: import('../types').BarcodeOptions }).barcodeOptions, moduleWidthMm: (o as { moduleWidthMm?: number }).moduleWidthMm, wideRatio: (o as { wideRatio?: number }).wideRatio, showText: (o as { showText?: boolean }).showText, color: blocks ? undefined : barcodePlan.colors[0], backgroundTransparent: blocks ? true : (o as { backgroundTransparent?: boolean }).backgroundTransparent }).then(async (url) => {
        const finalUrl = blocks ? await tintBarcodeBlocks(url, barcodePlan.colors, barcodePlan.rows, barcodePlan.cols) : url
        return finalUrl
      }).then((url) =>
        fabric.Image.fromURL(url).then((img) => {
          const dw = Math.max(1, o.w * sc)
          const dh = Math.max(1, o.h * sc)
          const ratio = Math.min(dw / img.width, dh / img.height)
          img.set({
            ...common,
            left: (o.x + o.w / 2) * sc,
            top: (o.y + o.h / 2) * sc,
            originX: 'center',
            originY: 'center',
            scaleX: ratio,
            scaleY: ratio
          })
          img.setCoords()
          return img as fabric.Object
        })
      )
    }
    case 'image': {
      let src = await resolveImageSource(o, ctx, options.resolveImage)
      if (!src) {
        if (options.output) throw new Error('图片没有可用内容：' + o.id)
        return null
      }
      // 单色黑白图片可变颜色（帮助 color_main.html）
      if (o.colorChange && o.colorChange.mode !== 'fixed') {
        const plan = resolveColorChangePlan(o, ctx, '#000000', options.colorTable)
        src = await tintMonoImage(src, plan.colors[0])
      }
      return fabric.Image.fromURL(src).then((img) => {
        const frameW = Math.max(1, o.w * sc)
        const frameH = Math.max(1, o.h * sc)
        const naturalW = Math.max(1, img.width) * sc / (96 / 25.4)
        const naturalH = Math.max(1, img.height) * sc / (96 / 25.4)
        const fit = o.imageFit ?? 'fit'
        const widthPercent = Math.max(1, o.widthPercent ?? 100) / 100
        const heightPercent = Math.max(1, o.heightPercent ?? o.widthPercent ?? 100) / 100
        let drawW = naturalW
        let drawH = naturalH
        if (fit === 'scale') { drawW *= widthPercent; drawH *= heightPercent }
        else if (fit === 'fit' || fit === 'fitBox') {
          if (o.keepAspect !== false) {
            const ratio = Math.min(frameW / naturalW, frameH / naturalH)
            drawW = naturalW * ratio
            drawH = naturalH * ratio
          } else { drawW = frameW; drawH = frameH }
        }
        const keepAspect = o.keepAspect !== false
        if (keepAspect && fit === 'original') {
          const ratio = Math.min(1, frameW / drawW, frameH / drawH)
          drawW *= ratio; drawH *= ratio
        }
        const align = o.imageAlign ?? 'center'
        const ax = align.includes('Right') || align === 'topRight' || align === 'bottomRight' ? 1 : align.includes('Left') || align === 'topLeft' || align === 'bottomLeft' ? 0 : 0.5
        const ay = align.startsWith('top') ? 0 : align.startsWith('bottom') ? 1 : 0.5
        const left = o.x * sc + (frameW - drawW) * ax
        const top = o.y * sc + (frameH - drawH) * ay
        img.set({ ...common, left, top, scaleX: drawW / img.width, scaleY: drawH / img.height })
        img.setCoords()
        return img as fabric.Object
      })
    }
    case 'group': {
      const items: fabric.Object[] = []
      const localPositions: Array<{ object: fabric.Object; left: number; top: number }> = []
      for (const c of o.children) {
        try {
          // Keep non-printing children's geometry in group bounds, so their removal
          // cannot shift printable siblings relative to the editor.
          const exclude = options.output && c.type === 'rfid'
          const obj = await makeObject(c, sc, exclude ? { ...options, output: false } : options)
          if (obj) {
            if (exclude) obj.visible = false
            // The domain stores group x/y as its center and child x/y as
            // document-space coordinates. Fabric groups use child-local
            // coordinates, so translate each child by the group's center
            // before constructing the group.
            const left = (obj.left ?? 0) - o.x * sc
            const top = (obj.top ?? 0) - o.y * sc
            obj.set({ left, top })
            localPositions.push({ object: obj, left, top })
            ;(obj as any).dataId = c.id
            items.push(obj)
          }
        } catch (err) {
          if (options.output) throw err
          console.error('分组子对象渲染失败', c.id, err)
        }
      }
      if (!items.length) return Promise.resolve(null)
      const g = new fabric.Group(items, { ...common, left: o.x * sc, top: o.y * sc, originX: 'center', originY: 'center' })
      // Group construction normalizes children around its measured bounds.
      // Restore the model-space anchors afterwards; otherwise a rotated child
      // changes the group bounds and silently shifts its siblings.
      for (const position of localPositions) position.object.set({ left: position.left, top: position.top })
      g.setCoords()
      ;(g as any).dataId = o.id
      return Promise.resolve(g)
    }
  }
}
