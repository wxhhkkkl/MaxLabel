import { useEffect, useRef } from 'react'
import * as fabric from 'fabric'
import type { GroupObj, LabelDoc, LabelObject } from '../types'
import { PX_PER_MM, PRINT_PX_PER_MM, resolveObjectText, round2 } from '../types'
import { tableColXs, tableRowYs, tableSegmentHidden } from '../../../shared/table'
import { barcodeToDataURL } from './barcode'

export interface EditorApi {
  getPreviewDataUrl(): Promise<string>
  getPrintDataUrl(): Promise<string>
  alignSelected(mode: 'left' | 'right' | 'top' | 'bottom' | 'midV' | 'midH'): void
  rotateSelected(deg: number): void
}

interface Props {
  doc: LabelDoc
  selectedId: string | null
  onSelect: (id: string | null) => void
  onSync: (objs: LabelObject[]) => void
  apiRef: { current: EditorApi | null }
  zoom?: number
  onMouseMove?: (mmX: number, mmY: number) => void
  onCanvasReady?: (canvas: fabric.Canvas) => void
  showGrid?: boolean
  /** 当前激活的对象工具：'select' 或对象类型；非 select 时点击画布创建对象 */
  tool?: string
  /** 在画布 mm 坐标处创建对象（单击，默认大小） */
  onCreateAt?: (type: string, mmX: number, mmY: number) => void
  onToolObjClick?: (objId: string) => void
  /** 在画布 mm 坐标处以指定 mm 尺寸创建对象（拖拽绘制） */
  onCreateRect?: (type: string, mmX: number, mmY: number, mmW: number, mmH: number) => void
  /** 画布右键菜单回调：屏幕坐标 + 选中状态 */
  onContextMenu?: (screenX: number, screenY: number, hasSelection: boolean, selectionCount: number) => void
  /** 双击对象回调 */
  onDoubleClick?: (objId: string) => void
}

const scale = PX_PER_MM

async function makeObject(o: LabelObject, sc: number): Promise<fabric.Object | null> {
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
    opacity: (o as { suppressPrint?: boolean }).suppressPrint === true ? 0.55 : 1,
    flipX: (o as { flipX?: boolean }).flipX === true,
    flipY: (o as { flipY?: boolean }).flipY === true,
  }
  switch (o.type) {
    case 'text': {
      const align = (o.align as string) || 'left'
      const vAlign = ((o as { verticalAlign?: string }).verticalAlign) || 'top'
      const originX = align === 'center' ? 'center' as const : align === 'right' ? 'right' as const : 'left' as const
      const originY = vAlign === 'middle' ? 'center' as const : vAlign === 'bottom' ? 'bottom' as const : 'top' as const
      const left = align === 'center' ? (o.x + o.w / 2) * sc : align === 'right' ? (o.x + o.w) * sc : o.x * sc
      const top = vAlign === 'middle' ? (o.y + o.h / 2) * sc : vAlign === 'bottom' ? (o.y + o.h) * sc : o.y * sc
      const t = new fabric.Text(resolveObjectText(o), {
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
        fill: o.reverse ? '#ffffff' : o.color,
        textAlign: o.align
      })
      const bgColor = o.reverse ? '#000000' : o.backgroundColor
      const hasBg = !!(bgColor && bgColor !== 'transparent')
      if (hasBg) {
        // 反白 / 背景色：底色矩形 + 文字（反白为黑底白字）
        const b = t.getBoundingRect()
        const bg = new fabric.Rect({
          left: o.x * sc - 1,
          top: o.y * sc - 1,
          width: b.width + 2,
          height: b.height + 2,
          fill: bgColor,
          selectable: false,
          evented: false
        })
        return Promise.resolve(new fabric.Group([bg, t], { ...common }))
      }
      return Promise.resolve(t)
    }
    case 'rect': {
      return Promise.resolve(
        new fabric.Rect({
          ...common,
          width: o.w * sc,
          height: o.h * sc,
          fill: o.fill,
          stroke: o.stroke,
          strokeWidth: o.strokeWidth * sc
        })
      )
    }
    case 'ellipse': {
      // 椭圆以高圆角矩形近似实现（rx=ry=宽/2），几何与 rect 一致便于同步
      return Promise.resolve(
        new fabric.Rect({
          ...common,
          width: o.w * sc,
          height: o.h * sc,
          rx: (o.w * sc) / 2,
          ry: (o.h * sc) / 2,
          fill: o.fill,
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
      const label = new fabric.Text(`RFID ${o.bank}\n${resolveObjectText(o)}`, {
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
      return barcodeToDataURL(o.symbology, resolveObjectText(o), o.h, { barcodeOptions: (o as { barcodeOptions?: import('../types').BarcodeOptions }).barcodeOptions, moduleWidthMm: (o as { moduleWidthMm?: number }).moduleWidthMm, wideRatio: (o as { wideRatio?: number }).wideRatio, showText: (o as { showText?: boolean }).showText }).then((url) =>
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
      if (!o.src) return Promise.resolve(null)
      return fabric.Image.fromURL(o.src).then((img) => {
        const dw = Math.max(1, o.w * sc)
        const dh = Math.max(1, o.h * sc)
        img.set({ ...common, scaleX: dw / img.width, scaleY: dh / img.height })
        img.setCoords()
        return img as fabric.Object
      })
    }
    case 'group': {
      const items: fabric.Object[] = []
      for (const c of o.children) {
        try {
          const obj = await makeObject(c, sc)
          if (obj) {
            ;(obj as any).dataId = c.id
            items.push(obj)
          }
        } catch (err) {
          console.error('分组子对象渲染失败', c.id, err)
        }
      }
      if (!items.length) return Promise.resolve(null)
      const g = new fabric.Group(items, { left: o.x * sc, top: o.y * sc, angle: o.rotation })
      ;(g as any).dataId = o.id
      return Promise.resolve(g)
    }
  }
}

function syncFromFabric(o: LabelObject, fo: fabric.Object, sc: number): LabelObject {
  const left = (fo.left ?? 0) / sc
  const top = (fo.top ?? 0) / sc
  const w = ((fo.width ?? 0) * (fo.scaleX ?? 1)) / sc
  const h = ((fo.height ?? 0) * (fo.scaleY ?? 1)) / sc
  const rotation = fo.angle ?? 0
  const base = { id: o.id, x: round2(left), y: round2(top), w: round2(Math.max(w, 0.1)), h: round2(Math.max(h, 0.1)), rotation: round2(rotation) }
  switch (o.type) {
    case 'text': {
      const t = fo as fabric.Text
      const align = (t.textAlign as 'left' | 'center' | 'right' | 'justify') || 'left'
      const ox = fo.originX || 'left'
      const oy = fo.originY || 'top'
      let tx = (fo.left ?? 0) / sc
      let ty = (fo.top ?? 0) / sc
      const tw = ((fo.width ?? 0) * (fo.scaleX ?? 1)) / sc
      const th = ((fo.height ?? 0) * (fo.scaleY ?? 1)) / sc
      if (ox === 'center') tx -= tw / 2
      else if (ox === 'right') tx -= tw
      if (oy === 'center') ty -= th / 2
      else if (oy === 'bottom') ty -= th
      return {
        ...base,
        x: round2(tx),
        y: round2(ty),
        type: 'text',
        fontFamily: t.fontFamily || 'Arial',
        fontSize: round2((t.fontSize ?? 10) / sc),
        bold: t.fontWeight === 'bold',
        italic: t.fontStyle === 'italic',
        underline: (t as any).underline === true,
        align,
        color: (t.fill as string) || '#000000',
        source: o.source
      }
    }
    case 'rect': {
      const r = fo as fabric.Rect
      return {
        ...base,
        type: 'rect',
        fill: (r.fill as string) || '#ffffff',
        stroke: (r.stroke as string) || '#000000',
        strokeWidth: round2(((r.strokeWidth ?? 0) * (r.scaleX ?? 1)) / sc)
      }
    }
    case 'ellipse': {
      const r = fo as fabric.Rect
      return {
        ...base,
        type: 'ellipse',
        fill: (r.fill as string) || '#ffffff',
        stroke: (r.stroke as string) || '#000000',
        strokeWidth: round2(((r.strokeWidth ?? 0) * (r.scaleX ?? 1)) / sc)
      }
    }
    case 'table': {
      const t = o as import('../types').TableObj
      return {
        ...base,
        type: 'table',
        rows: t.rows,
        cols: t.cols,
        borderWidth: t.borderWidth,
        borderColor: t.borderColor
      }
    }
    case 'line': {
      const l = fo as fabric.Line
      return {
        ...base,
        type: 'line',
        stroke: (l.stroke as string) || '#000000',
        strokeWidth: round2(((l.strokeWidth ?? 0) * (l.scaleX ?? 1)) / sc)
      }
    }
    case 'barcode': {
      const ox = fo.originX || 'left'
      const oy = fo.originY || 'top'
      let bx = (fo.left ?? 0) / sc
      let by = (fo.top ?? 0) / sc
      const bw = ((fo.width ?? 0) * (fo.scaleX ?? 1)) / sc
      const bh = ((fo.height ?? 0) * (fo.scaleY ?? 1)) / sc
      if (ox === 'center') bx -= bw / 2
      else if (ox === 'right') bx -= bw
      if (oy === 'center') by -= bh / 2
      else if (oy === 'bottom') by -= bh
      return { ...base, x: round2(bx), y: round2(by), w: round2(Math.max(bw, 0.1)), h: round2(Math.max(bh, 0.1)), type: 'barcode', symbology: o.symbology, showText: o.showText, source: o.source }
    }
    case 'rfid':
      return { ...base, type: 'rfid', bank: o.bank, source: o.source, lock: o.lock, accessPwd: o.accessPwd, killPwd: o.killPwd }
    case 'image':
      return { ...base, type: 'image', src: o.src }
    case 'group': {
      const grp = fo as fabric.Group
      const m = grp.calcTransformMatrix()
      const gsx = grp.scaleX ?? 1
      const gsy = grp.scaleY ?? 1
      const children = ((o as GroupObj).children ?? []).map((c) => {
        const cf = grp.getObjects().find((x: any) => x.dataId === c.id)
        if (!cf) return c
        const p = fabric.util.transformPoint({ x: (cf as any).left, y: (cf as any).top }, m)
        const cw = ((cf.width ?? 0) * (cf.scaleX ?? 1) * gsx) / sc
        const ch = ((cf.height ?? 0) * (cf.scaleY ?? 1) * gsy) / sc
        const absAngle = ((grp.angle ?? 0) + (cf.angle ?? 0)) % 360
        return {
          ...c,
          x: round2(p.x / sc),
          y: round2(p.y / sc),
          w: round2(Math.max(cw, 0.1)),
          h: round2(Math.max(ch, 0.1)),
          rotation: round2(absAngle)
        } as LabelObject
      })
      return { ...base, type: 'group', children } as GroupObj
    }
  }
}

export default function LabelEditor({ doc, selectedId, onSelect, onSync, apiRef, zoom, onMouseMove, onCanvasReady, showGrid = true, tool = 'select', onCreateAt, onCreateRect, onContextMenu, onDoubleClick, onToolObjClick }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<fabric.Canvas | null>(null)
  const docRef = useRef(doc)
  const selectedRef = useRef<string | null>(selectedId)
  const zoomRef = useRef(zoom ?? 1)
  const mouseRef = useRef(onMouseMove)
  const readyRef = useRef(onCanvasReady)
  const onSyncRef = useRef(onSync)
  const toolRef = useRef(tool)
  const toolObjClickRef = useRef(onToolObjClick)
  const createRef = useRef(onCreateAt)
  const createRectRef = useRef(onCreateRect)
  const contextMenuRef = useRef(onContextMenu)
  const dblClickRef = useRef(onDoubleClick)
  // 拖动/缩放结束（object:modified）触发的 doc 同步应跳过全量重建，避免闪烁与条码回缩
  const suppressRedrawRef = useRef(false)
  // 拖拽绘制状态
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; preview: fabric.Object | null }>({ active: false, startX: 0, startY: 0, preview: null })
  docRef.current = doc
  selectedRef.current = selectedId
  zoomRef.current = zoom ?? 1
  mouseRef.current = onMouseMove
  readyRef.current = onCanvasReady
  onSyncRef.current = onSync
  toolRef.current = tool
  toolObjClickRef.current = onToolObjClick
  createRef.current = onCreateAt
  createRectRef.current = onCreateRect
  contextMenuRef.current = onContextMenu
  dblClickRef.current = onDoubleClick

  const applyZoom = () => {
    const fc = canvasRef.current
    const el = canvasElRef.current
    if (!fc || !el) return
    const z = zoomRef.current
    const W = Math.round(docRef.current.widthMm * scale)
    const H = Math.round(docRef.current.heightMm * scale)
    const cssW = Math.round(W * z)
    const cssH = Math.round(H * z)
    // setDimensions 同时更新 lower-canvas / upper-canvas / canvas-container 三层尺寸
    fc.setDimensions({ width: cssW, height: cssH })
    fc.setZoom(z)
    fc.requestRenderAll()
  }

  // 初始化 fabric 画布（仅一次）
  useEffect(() => {
    const el = canvasElRef.current
    if (!el) return
    const width = Math.round(docRef.current.widthMm * scale)
    const height = Math.round(docRef.current.heightMm * scale)
    el.width = width
    el.height = height

    // ---- 全局对象默认样式：LabelShop 蓝色实心句柄，无旋转手柄 ----
    fabric.Object.prototype.set({
      transparentCorners: false,
      cornerColor: '#1E90FF',
      cornerStrokeColor: '#1E90FF',
      cornerSize: 8,
      borderColor: '#1E90FF',
      borderScaleFactor: 1,
      hasRotatingPoint: false,
      centeredRotation: true
    })

    const canvas = new fabric.Canvas(el, {
      selection: true,
      preserveObjectStacking: true,
      backgroundColor: 'transparent',
      selectionColor: 'rgba(30,144,255,0.1)',
      selectionBorderColor: '#1E90FF',
      selectionLineWidth: 1,
      multiSelectionKey: 'ctrlKey',
      selectionKey: 'ctrlKey',
      // 空心图形命中由下方 findTarget 覆写处理（点边框线才选中），
      // 关闭 perPixelTargetFind：文字/图片/条码等对象点框内任意处即可选中（对标原版习惯）
      perPixelTargetFind: false,
      targetFindTolerance: 2
    })
    canvasRef.current = canvas
    ;(window as any).__fc = canvas // 调试用，不影响功能

    // ---- 空心图形命中规则（对标原版：矩形等空心图形需点击边框线才能选中，点内部空白不选中）----
    const isHollowFill = (o: any) => {
      const t = o?.type
      if (t !== 'rect' && t !== 'square' && t !== 'ellipse' && t !== 'circle' && t !== 'triangle' && t !== 'polygon') return false
      const fill = o.fill
      if (fill == null || fill === '') return true
      if (typeof fill === 'string') {
        const s = fill.toLowerCase()
        if (s === 'transparent') return true
        const m = s.match(/^rgba?\(([^)]*)\)$/)
        if (m) {
          const parts = m[1].split(',').map((x) => parseFloat(x))
          if (parts.length >= 4 && parts[3] === 0) return true
        }
      }
      return false
    }
    const distToSeg = (p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) => {
      const dx = b.x - a.x
      const dy = b.y - a.y
      const l2 = dx * dx + dy * dy
      if (l2 === 0) return Math.hypot(p.x - a.x, p.y - a.y)
      let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2
      t = Math.max(0, Math.min(1, t))
      return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
    }
    const isNearStroke = (o: any, px: number, py: number) => {
      const tol = Math.max((o.strokeWidth ?? 0) / 2 + 3, 4)
      const inv = fabric.util.invertTransform(o.calcTransformMatrix())
      const pt = fabric.util.transformPoint(new fabric.Point(px, py), inv)
      const t = o.type
      if (t === 'rect' || t === 'square') {
        const w = o.width ?? 0
        const h = o.height ?? 0
        const hw = w / 2
        const hh = h / 2
        if (pt.x < -hw - tol || pt.x > hw + tol || pt.y < -hh - tol || pt.y > hh + tol) return false
        return Math.min(Math.abs(pt.x - -hw), Math.abs(pt.x - hw), Math.abs(pt.y - -hh), Math.abs(pt.y - hh)) <= tol
      }
      if (t === 'ellipse' || t === 'circle') {
        const rx = o.rx ?? (o.width ?? 0) / 2
        const ry = o.ry ?? (o.height ?? 0) / 2
        if (rx <= 0 || ry <= 0) return false
        const nx = pt.x / rx
        const ny = pt.y / ry
        const d = Math.hypot(nx, ny)
        const rel = tol / Math.min(rx, ry)
        if (d > 1 + rel) return false
        return Math.abs(d - 1) <= rel
      }
      if (t === 'triangle') {
        const w = o.width ?? 0
        const h = o.height ?? 0
        const pts = [{ x: -w / 2, y: h / 2 }, { x: 0, y: -h / 2 }, { x: w / 2, y: h / 2 }]
        let minD = Infinity
        for (let i = 0; i < 3; i++) minD = Math.min(minD, distToSeg(pt, pts[i], pts[(i + 1) % 3]))
        return minD <= tol
      }
      if (t === 'polygon') {
        const pts = (o.points ?? []).map((p: any) => ({ x: p.x, y: p.y }))
        if (pts.length < 3) return false
        let minD = Infinity
        for (let i = 0; i < pts.length; i++) minD = Math.min(minD, distToSeg(pt, pts[i], pts[(i + 1) % pts.length]))
        return minD <= tol
      }
      return true
    }
    const origFindTarget = canvas.findTarget.bind(canvas)
    canvas.findTarget = (e: any) => {
      const target = origFindTarget(e)
      if (target && isHollowFill(target)) {
        const vp = canvas.getViewportPoint(e)
        if (!isNearStroke(target, vp.x, vp.y)) return undefined
      }
      return target
    }

    // ---- 智能对齐辅助线（对标原版：拖拽对象时吸附对齐边缘并显示辅助线）----
    let guideLines: fabric.Line[] = []
    const clearGuides = () => {
      if (!guideLines.length) return
      guideLines.forEach((l) => { try { canvas.remove(l) } catch (_e) { /* noop */ } })
      guideLines = []
      canvas.requestRenderAll()
    }
    const showGuides = (items: { x1: number; y1: number; x2: number; y2: number }[]) => {
      clearGuides()
      guideLines = items.map(
        (g) =>
          new fabric.Line([g.x1, g.y1, g.x2, g.y2], {
            stroke: '#1E90FF',
            strokeWidth: 1,
            strokeDashArray: [4, 3],
            selectable: false,
            evented: false,
            exclusive: true
          })
      )
      guideLines.forEach((l) => { (l as any).dataId = '__guide__' })
      canvas.add(...guideLines)
      canvas.requestRenderAll()
    }
    const ALIGN_THRESHOLD = 5 // px
    canvas.on('object:moving', (e: any) => {
      clearGuides()
      const obj = e.target as fabric.Object | undefined
      if (!obj || String((obj as any).dataId ?? '').startsWith('__')) return
      const z = zoomRef.current
      const thr = ALIGN_THRESHOLD / z
      const others = canvas.getObjects().filter(
        (o: any) => o.dataId && !String(o.dataId).startsWith('__') && o !== obj
      )
      if (!others.length) return
      const oL = obj.left ?? 0
      const oT = obj.top ?? 0
      const oW = (obj.width ?? 0) * (obj.scaleX ?? 1)
      const oH = (obj.height ?? 0) * (obj.scaleY ?? 1)
      const oCx = oL + oW / 2
      const oCy = oT + oH / 2
      const oR = oL + oW
      const oB = oT + oH
      const snaps: { x1: number; y1: number; x2: number; y2: number }[] = []
      for (const o of others) {
        const r = o.getBoundingRect()
        // 水平对齐（纵向边缘线）
        const hRefs: [string, number][] = [
          ['top', r.top],
          ['mid', r.top + r.height / 2],
          ['bottom', r.top + r.height]
        ]
        for (const [refName, refVal] of hRefs) {
          const myVals: [string, number][] = [
            ['top', oT],
            ['mid', oCy],
            ['bottom', oB]
          ]
          for (const [myName, myVal] of myVals) {
            if (Math.abs(myVal - refVal) <= thr) {
              if (myName === 'top') obj.top = refVal
              else if (myName === 'mid') obj.top = refVal - oH / 2
              else obj.top = refVal - oH
              const x1 = Math.min(oL, r.left) - 60
              const x2 = Math.max(oR, r.left + r.width) + 60
              snaps.push({ x1, y1: refVal, x2, y2: refVal })
            }
          }
        }
        // 垂直对齐（横向边缘线）
        const vRefs: [string, number][] = [
          ['left', r.left],
          ['center', r.left + r.width / 2],
          ['right', r.left + r.width]
        ]
        for (const [refName, refVal] of vRefs) {
          const myVals: [string, number][] = [
            ['left', oL],
            ['center', oCx],
            ['right', oR]
          ]
          for (const [myName, myVal] of myVals) {
            if (Math.abs(myVal - refVal) <= thr) {
              if (myName === 'left') obj.left = refVal
              else if (myName === 'center') obj.left = refVal - oW / 2
              else obj.left = refVal - oW
              const y1 = Math.min(oT, r.top) - 60
              const y2 = Math.max(oB, r.top + r.height) + 60
              snaps.push({ x1: refVal, y1, x2: refVal, y2 })
            }
          }
        }
      }
      if (snaps.length) showGuides(snaps)
      obj.setCoords()
    })
    canvas.on('object:modified', clearGuides)
    canvas.on('selection:cleared', clearGuides)

    const onModified = () => {
      const fc = canvasRef.current
      if (!fc) return
      suppressRedrawRef.current = true
      const objs = docRef.current.objects.map((o) => {
        const fo = fc.getObjects().find((x) => (x as any).dataId === o.id)
        return fo ? syncFromFabric(o, fo, scale) : o
      })
      onSync(objs)
    }

    // ---- 多选参考对象句柄颜色区分：第一个蓝色，其余深色 ----
    const applySelectionHandles = (e: any) => {
      const sel = e?.selected as fabric.Object[] | undefined
      if (!sel || sel.length < 2) return
      sel.forEach((obj, i) => {
        if (i === 0) {
          obj.set({ cornerColor: '#1E90FF', cornerStrokeColor: '#1E90FF' })
        } else {
          obj.set({ cornerColor: '#333333', cornerStrokeColor: '#333333' })
        }
      })
    }
    const resetSelectionHandles = () => {
      const fc = canvasRef.current
      if (!fc) return
      fc.getObjects().forEach((obj) => {
        const id = (obj as any).dataId
        if (id && !String(id).startsWith('__')) {
          obj.set({ cornerColor: '#1E90FF', cornerStrokeColor: '#1E90FF' })
        }
      })
    }

    // ---- 拖拽绘制对象 ----
    canvas.on('mouse:down', (e: any) => {
      const t = toolRef.current
      if (t === 'select') return
      const fc = canvasRef.current
      if (!fc) return
      // 数据工具：点击对象 → 修改该对象数据
      if (t === 'data') {
        const did = (e.target as any)?.dataId
        if (did && !String(did).startsWith('__')) {
          toolObjClickRef.current?.(String(did))
        }
        return
      }
      // 点击在已有对象上时不启动拖拽绘制
      if (e.target && !String((e.target as any).dataId ?? '').startsWith('__')) return
      const pt = fc.getPointer(e.e)
      const z = zoomRef.current
      const mmX = +(pt.x / z / scale).toFixed(2)
      const mmY = +(pt.y / z / scale).toFixed(2)
      // 创建半透明预览矩形
      const preview = new fabric.Rect({
        left: pt.x,
        top: pt.y,
        width: 1,
        height: 1,
        fill: 'rgba(30,144,255,0.12)',
        stroke: '#1E90FF',
        strokeWidth: 1,
        strokeDashArray: [4, 3],
        selectable: false,
        evented: false
      })
      fc.add(preview)
      dragRef.current = { active: true, startX: pt.x, startY: pt.y, preview }
    })

    canvas.on('mouse:move', (e: any) => {
      // 拖拽绘制预览更新
      const drag = dragRef.current
      if (drag.active && drag.preview) {
        const fc = canvasRef.current
        if (fc) {
          const pt = fc.getPointer(e.e)
          const left = Math.min(drag.startX, pt.x)
          const top = Math.min(drag.startY, pt.y)
          const w = Math.abs(pt.x - drag.startX)
          const h = Math.abs(pt.y - drag.startY)
          drag.preview.set({ left, top, width: Math.max(w, 1), height: Math.max(h, 1) })
          fc.requestRenderAll()
        }
      }
      // 鼠标坐标回调
      const fn = mouseRef.current
      if (!fn) return
      const fc = canvasRef.current
      if (!fc) return
      const pt = fc.getPointer(e.e)
      const z = zoomRef.current
      fn(+(pt.x / z / scale).toFixed(2), +(pt.y / z / scale).toFixed(2))
    })

    canvas.on('mouse:up', (e: any) => {
      const drag = dragRef.current
      if (!drag.active) return
      dragRef.current = { active: false, startX: 0, startY: 0, preview: null }
      const fc = canvasRef.current
      if (drag.preview && fc) fc.remove(drag.preview)
      if (!fc) return
      const fn = createRef.current
      const fnRect = createRectRef.current
      const t = toolRef.current
      if (!t || t === 'select') return
      const pt = fc.getPointer(e.e)
      const z = zoomRef.current
      const mmX = +(Math.min(drag.startX, pt.x) / z / scale).toFixed(2)
      const mmY = +(Math.min(drag.startY, pt.y) / z / scale).toFixed(2)
      const mmW = +(Math.abs(pt.x - drag.startX) / z / scale).toFixed(2)
      const mmH = +(Math.abs(pt.y - drag.startY) / z / scale).toFixed(2)
      // 宽高 < 2mm 视为单击，创建默认大小对象
      if (mmW < 2 && mmH < 2) {
        if (fn) fn(t, mmX, mmY)
      } else {
        if (fnRect) fnRect(t, mmX, mmY, Math.max(mmW, 0.5), Math.max(mmH, 0.5))
        else if (fn) fn(t, mmX, mmY)
      }
    })

    canvas.on('object:modified', onModified)
    canvas.on('selection:created', (e: any) => {
      applySelectionHandles(e)
      onSelect(e?.selected?.[0]?.dataId ?? null)
    })
    canvas.on('selection:updated', (e: any) => {
      applySelectionHandles(e)
      onSelect(e?.selected?.[0]?.dataId ?? null)
    })
    canvas.on('selection:cleared', () => {
      resetSelectionHandles()
      onSelect(null)
    })

    // ---- 命中测试（bbox + 空心图形规则，视口坐标）----
    const hitTest = (obj: any, pt: { x: number; y: number }) => {
      const rect = obj.getBoundingRect()
      if (pt.x < rect.left || pt.x > rect.left + rect.width || pt.y < rect.top || pt.y > rect.top + rect.height) return false
      if (isHollowFill(obj) && !isNearStroke(obj, pt.x, pt.y)) return false
      return true
    }

    // ---- 双击对象 → 属性（DOM 级可靠触发）----
    const onDblClickDom = (ev: MouseEvent) => {
      const fc = canvasRef.current
      if (!fc) return
      const pt = fc.getPointer(ev as any)
      const allObjs = fc.getObjects()
      for (let i = allObjs.length - 1; i >= 0; i--) {
        const obj = allObjs[i]
        const id = (obj as any).dataId
        if (!id || String(id).startsWith('__')) continue
        if (hitTest(obj, pt)) {
          dblClickRef.current?.(id)
          break
        }
      }
    }
    rootRef.current?.addEventListener('dblclick', onDblClickDom)

    // ---- 右键菜单（绑定到容器层，覆盖 upper/lower canvas 与标签周边空白） ----
    const onContextMenuDom = (ev: MouseEvent) => {
      ev.preventDefault()
      ev.stopPropagation()
      const fc = canvasRef.current
      if (!fc) return
      // 命中测试：右键在对象上时先选中该对象（手动包围盒检测）
      const pt = fc.getPointer(ev as any)
      let target: fabric.Object | null = null
      const allObjs = fc.getObjects()
      for (let i = allObjs.length - 1; i >= 0; i--) {
        const obj = allObjs[i]
        const id = (obj as any).dataId
        if (!id || String(id).startsWith('__')) continue
        if (hitTest(obj, pt)) {
          target = obj
          break
        }
      }
      if (target) {
        const id = (target as any).dataId
        const active = fc.getActiveObject()
        const isInSelection = active && active.type === 'activeSelection'
          ? (active as fabric.ActiveSelection).getObjects().some((o: any) => o.dataId === id)
          : (active as any)?.dataId === id
        if (!isInSelection) {
          fc.discardActiveObject()
          fc.setActiveObject(target)
          fc.requestRenderAll()
        }
      }
      // 右键未命中对象 → 画布菜单（无选中，对象项禁用，与原版一致）
      const activeObjs = target ? fc.getActiveObjects().filter((x: any) => !String(x.dataId).startsWith('__')) : []
      contextMenuRef.current?.(ev.clientX, ev.clientY, activeObjs.length > 0, activeObjs.length)
    }
    rootRef.current?.addEventListener('contextmenu', onContextMenuDom)

    apiRef.current = {
      getPreviewDataUrl: async () => {
        const fc = canvasRef.current
        if (!fc) return ''
        return (await fc.toDataURL({ format: 'png', multiplier: 2, enableRetinaScaling: false })) as string
      },
      getPrintDataUrl: async () => {
        const fc = canvasRef.current
        if (!fc) return ''
        const m = PRINT_PX_PER_MM / PX_PER_MM
        return (await fc.toDataURL({ format: 'png', multiplier: m, enableRetinaScaling: false })) as string
      },
      alignSelected: (mode) => {
        const fc = canvasRef.current
        if (!fc) return
        const active = fc.getActiveObjects()
        const ids = active.map((x: any) => x.dataId).filter((id: any) => id && !String(id).startsWith('__'))
        if (ids.length < 2) return
        fc.discardActiveObject()
        const all = fc.getObjects()
        const objs = ids.map((id: string) => all.find((o: any) => o.dataId === id)).filter(Boolean) as fabric.Object[]
        if (objs.length < 2) return
        const rects = objs.map((o) => o.getBoundingRect())
        const minX = Math.min(...rects.map((r) => r.left))
        const maxX = Math.max(...rects.map((r) => r.left + r.width))
        const minY = Math.min(...rects.map((r) => r.top))
        const maxY = Math.max(...rects.map((r) => r.top + r.height))
        const cx = (minX + maxX) / 2
        const cy = (minY + maxY) / 2
        objs.forEach((o, i) => {
          const r = rects[i]
          let dx = 0, dy = 0
          if (mode === 'left') dx = minX - r.left
          else if (mode === 'right') dx = maxX - (r.left + r.width)
          else if (mode === 'top') dy = minY - r.top
          else if (mode === 'bottom') dy = maxY - (r.top + r.height)
          else if (mode === 'midV') dx = cx - (r.left + r.width / 2)
          else if (mode === 'midH') dy = cy - (r.top + r.height / 2)
          if (dx !== 0 || dy !== 0) {
            o.set({ left: (o.left ?? 0) + dx, top: (o.top ?? 0) + dy })
            o.setCoords()
          }
        })
        // 先回写数据模型（此时对象是独立的，left/top 为画布绝对坐标）
        const synced: LabelObject[] = []
        for (const fo of all) {
          const id = (fo as any).dataId
          if (!id || String(id).startsWith('__')) continue
          const orig = doc.objects.find((x) => x.id === id)
          if (orig) synced.push(syncFromFabric(orig, fo, PX_PER_MM * (zoomRef.current ?? 1)))
        }
        if (synced.length) {
          suppressRedrawRef.current = true
          onSyncRef.current?.(synced)
        }
        // 重新选中并只渲染一次，避免中间取消选中的闪烁
        const sel = new fabric.ActiveSelection(objs, { canvas: fc })
        fc.setActiveObject(sel)
        fc.renderAll()
      },
      rotateSelected: (deg) => {
        const fc = canvasRef.current
        if (!fc) return
        const active = fc.getActiveObject()
        if (!active) return
        const normAngle = (a: number) => ((a % 360) + 360) % 360
        if (active.type === 'activeselection') {
          // 多选旋转：绕选中框中心旋转，保持对象间相对位置
          const groupRect = active.getBoundingRect()
          const gcx = groupRect.left + groupRect.width / 2
          const gcy = groupRect.top + groupRect.height / 2
          const objs = (active as any).getObjects() as fabric.Object[]
          fc.discardActiveObject()
          const rad = (deg * Math.PI) / 180
          const cos = Math.cos(rad)
          const sin = Math.sin(rad)
          objs.forEach((o) => {
            const objRect = o.getBoundingRect()
            const ocx = objRect.left + objRect.width / 2
            const ocy = objRect.top + objRect.height / 2
            const dx = ocx - gcx
            const dy = ocy - gcy
            const newCx = gcx + dx * cos - dy * sin
            const newCy = gcy + dx * sin + dy * cos
            o.rotate(normAngle((o.angle ?? 0) + deg))
            o.setPositionByOrigin({ x: newCx, y: newCy } as any, 'center', 'center')
            o.setCoords()
          })
          // 回写数据模型
          const all = fc.getObjects()
          const synced: LabelObject[] = []
          for (const fo of all) {
            const id = (fo as any).dataId
            if (!id || String(id).startsWith('__')) continue
            const orig = doc.objects.find((x) => x.id === id)
            if (orig) synced.push(syncFromFabric(orig, fo, PX_PER_MM * (zoomRef.current ?? 1)))
          }
          if (synced.length) {
            suppressRedrawRef.current = true
            onSyncRef.current?.(synced)
          }
          // 重新选中
          const sel = new fabric.ActiveSelection(objs, { canvas: fc })
          fc.setActiveObject(sel)
          fc.renderAll()
        } else {
          active.rotate(normAngle((active.angle ?? 0) + deg))
          active.setCoords()
          fc.requestRenderAll()
          fc.fire('object:modified', { target: active })
        }
      }
    }
    readyRef.current?.(canvas)

    return () => {
      rootRef.current?.removeEventListener('contextmenu', onContextMenuDom)
      rootRef.current?.removeEventListener('dblclick', onDblClickDom)
      apiRef.current = null
      canvas.dispose()
      canvasRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 缩放
  useEffect(() => {
    applyZoom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  // 工具模式：非选择工具时禁用选中、显示十字光标
  useEffect(() => {
    const fc = canvasRef.current
    if (!fc) return
    const drawing = tool !== 'select'
    fc.selection = !drawing
    fc.defaultCursor = drawing ? 'crosshair' : 'default'
    if (drawing) {
      fc.discardActiveObject()
      fc.requestRenderAll()
    }
  }, [tool])

  // 依据文档重绘
  useEffect(() => {
    const fc = canvasRef.current
    const el = canvasElRef.current
    if (!fc || !el) return
    // 拖动/缩放结束（onModified）产生的 doc 更新：fabric 画布已是最新，跳过全量重建
    if (suppressRedrawRef.current) {
      suppressRedrawRef.current = false
      return
    }
    let cancelled = false
    const W = Math.round(doc.widthMm * scale)
    const H = Math.round(doc.heightMm * scale)
    if (el.width !== W || el.height !== H) {
      el.width = W
      el.height = H
      fc.setDimensions({ width: W, height: H })
    }

    fc.clear()
    const bg = new fabric.Rect({ left: 0, top: 0, width: W, height: H, fill: '#ffffff', selectable: false, evented: false })
    ;(bg as any).dataId = '__bg__'
    fc.add(bg)
    for (let gx = 5; gx <= doc.widthMm; gx += 5) {
      if (showGrid) {
        const l = new fabric.Line([gx * scale, 0, gx * scale, H], { stroke: '#E4E3DD', strokeWidth: 1, selectable: false, evented: false })
        ;(l as any).dataId = '__grid__'
        fc.add(l)
      }
    }
    for (let gy = 5; gy <= doc.heightMm; gy += 5) {
      if (showGrid) {
        const l = new fabric.Line([0, gy * scale, W, gy * scale], { stroke: '#E4E3DD', strokeWidth: 1, selectable: false, evented: false })
        ;(l as any).dataId = '__grid__'
        fc.add(l)
      }
    }

    const objects: fabric.Object[] = []
    const run = async () => {
      for (const o of doc.objects) {
        if (cancelled) return
        if (o.visible === false) continue
        try {
          const obj = await makeObject(o, scale)
          if (obj) {
            ;(obj as any).dataId = o.id
            objects.push(obj)
          }
        } catch (err) {
          console.error('对象渲染失败', o.id, err)
        }
      }
      if (cancelled) return
      for (const obj of objects) fc.add(obj)
      const sid = selectedRef.current
      if (sid) {
        const fo = fc.getObjects().find((x: any) => x.dataId === sid)
        if (fo) fc.setActiveObject(fo)
      }
      fc.requestRenderAll()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [doc])

  return (
    <div
      ref={rootRef}
      style={{
        background: '#22BDED',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        minHeight: '100%',
        boxSizing: 'border-box'
      }}
    >
      <canvas ref={canvasElRef} style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.18)' }} />
    </div>
  )
}
