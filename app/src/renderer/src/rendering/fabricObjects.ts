import * as fabric from 'fabric'
import type { DataCtx, ImageObj, LabelObject } from '../types'
import { resolveObjectText, resolveObjectColor } from '../types'
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
      if (o.arc || o.textType === 'circle') {
        const chars = Array.from(resolveObjectText(o, ctx))
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
            fill: o.reverse ? '#ffffff' : resolveObjectColor(o, ctx, o.color, options.colorTable),
            backgroundColor: o.reverse ? '#000000' : (o.backgroundColor ?? '')
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
      const t = new fabric.Text(resolveObjectText(o, ctx), {
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
        fill: o.reverse ? '#ffffff' : resolveObjectColor(o, ctx, o.color, options.colorTable),
        textAlign: o.align,
        lineHeight: o.lineSpacing ?? 1.16,
        backgroundColor: o.reverse ? '#000000' : (o.backgroundColor ?? '')
      })
      return Promise.resolve(t)
    }
    case 'rect': {
      return Promise.resolve(
        new fabric.Rect({
          ...common,
          width: o.w * sc,
          height: o.h * sc,
          fill: resolveObjectColor(o, ctx, o.fill, options.colorTable),
          stroke: o.stroke,
          strokeWidth: o.strokeWidth * sc
        })
      )
    }
    case 'ellipse': {
      return Promise.resolve(
        new fabric.Ellipse({
          ...common,
          width: o.w * sc,
          height: o.h * sc,
          rx: (o.w * sc) / 2,
          ry: (o.h * sc) / 2,
          fill: resolveObjectColor(o, ctx, o.fill, options.colorTable),
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
      return barcodeToDataURL(o.symbology, resolveObjectText(o, ctx), o.h, { barcodeOptions: (o as { barcodeOptions?: import('../types').BarcodeOptions }).barcodeOptions, moduleWidthMm: (o as { moduleWidthMm?: number }).moduleWidthMm, wideRatio: (o as { wideRatio?: number }).wideRatio, showText: (o as { showText?: boolean }).showText }).then((url) =>
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
      const src = await resolveImageSource(o, ctx, options.resolveImage)
      if (!src) {
        if (options.output) throw new Error('图片没有可用内容：' + o.id)
        return null
      }
      return fabric.Image.fromURL(src).then((img) => {
        const dw = Math.max(1, o.w * sc)
        const dh = Math.max(1, o.h * sc)
        img.set({ ...common, scaleX: dw / img.width, scaleY: dh / img.height })
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
