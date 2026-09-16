import { useEffect, useId, useRef } from 'react'
import * as fabric from 'fabric'
import { paperPath, type PaperShape } from '../../../shared/domain/paper'
import type { LabelDoc, LabelObject } from '../types'
import { PX_PER_MM } from '../types'
import { makeObject } from '../rendering/fabricObjects'
import { syncFromFabric } from '../features/canvas/syncFromFabric'
import { clientToCanvasPoint, eventClientPoint } from './canvasCoordinates'
import { constrainFabricResize } from '../features/editor/resizeBehavior'

interface Props {
  doc: LabelDoc
  selectedId: string | null
  /** 返回最终生效的选中对象 id：非打印对象在「不选中非打印对象」开启时会被拒绝（返回 null）。 */
  onSelect: (id: string | null) => string | null
  onSync: (objs: LabelObject[]) => void
  zoom?: number
  onMouseMove?: (mmX: number, mmY: number) => void
  onCanvasReady?: (canvas: fabric.Canvas) => void
  showGrid?: boolean
  allowScript?: boolean
  /** 当前在编辑画布中显示的数据库记录。 */
  recordIndex?: number
  datasetName?: string
  keyboardValues?: Record<string, string>
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
  /** 版面显示旋转；输入事件必须反向映射回文档坐标。 */
  labelRotation?: number
  labelShape?: PaperShape
}

const scale = PX_PER_MM
let fabricDefaultsApplied = false

function findFabricObjectById(objects: fabric.Object[], id: string, root?: fabric.Object): { object: fabric.Object; root: fabric.Object } | undefined {
  for (const object of objects) {
    if ((object as fabric.Object & { dataId?: string }).dataId === id) return { object, root: root ?? object }
    if (object.type === 'group') {
      const nested = findFabricObjectById((object as fabric.Group).getObjects(), id, root ?? object)
      if (nested) return nested
    }
  }
  return undefined
}


export default function LabelEditor({ doc, selectedId, onSelect, onSync, zoom, onMouseMove, onCanvasReady, showGrid = false, allowScript = false, recordIndex = 0, datasetName = '', keyboardValues = {}, tool = 'select', onCreateAt, onCreateRect, onContextMenu, onDoubleClick, onToolObjClick, labelRotation = 0, labelShape = 'rect' }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const clipId = `paper-clip-${useId().replace(/:/g, '')}`
  const canvasRef = useRef<fabric.Canvas | null>(null)
  const docRef = useRef(doc)
  const selectedRef = useRef<string | null>(selectedId)
  const zoomRef = useRef(zoom ?? 1)
  const labelRotationRef = useRef(labelRotation)
  const mouseRef = useRef(onMouseMove)
  const selectRef = useRef(onSelect)
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
  // 全量重建（fc.clear + 重新 add）窗口：期间 fabric 的 selection:cleared 不代表用户取消选中
  const rebuildingRef = useRef(false)
  // 拖拽绘制状态
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; preview: fabric.Object | null }>({ active: false, startX: 0, startY: 0, preview: null })
  docRef.current = doc
  selectedRef.current = selectedId
  zoomRef.current = zoom ?? 1
  labelRotationRef.current = labelRotation
  mouseRef.current = onMouseMove
  selectRef.current = onSelect
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
    if (!fabricDefaultsApplied) {
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
      fabricDefaultsApplied = true
    }

    const canvas = new fabric.Canvas(el, {
      selection: true,
      // LabelShop's default is free edge scaling and SHIFT enables the
      // constrained mode.  Text corners are further corrected below because
      // their documented font-ratio rule also applies while SHIFT is held.
      uniformScaling: false,
      uniScaleKey: 'shiftKey',
      preserveObjectStacking: true,
      backgroundColor: 'transparent',
      selectionColor: 'rgba(30,144,255,0.1)',
      selectionBorderColor: '#1E90FF',
      selectionLineWidth: 1,
      // LabelShop supports both Ctrl-click and Shift-click for additive /
      // toggle selection. Fabric accepts an array here and treats the keys
      // as alternatives, preserving the old Windows editor habit.
      selectionKey: ['ctrlKey', 'shiftKey'],
      // 空心图形命中由下方 findTarget 覆写处理（点边框线才选中），
      // 关闭 perPixelTargetFind：文字/图片/条码等对象点框内任意处即可选中（对标原版习惯）
      perPixelTargetFind: false,
      targetFindTolerance: 2
    })
    canvasRef.current = canvas

    // Fabric 原生 getPointer 不知道外层 CSS rotate，90/270 度时会把屏幕坐标
    // 当成未旋转画布坐标。统一在画布入口反向旋转，Fabric 的选取、拖动和手工命中
    // 测试都消费同一套 scene 坐标，保留 LabelShop 的“旋转后继续直接编辑”习惯。
    const scenePointer = (event: any, fromViewport = false): fabric.Point => {
      const bounds = canvas.upperCanvasEl.getBoundingClientRect()
      const point = eventClientPoint(event)
      const zoomValue = Math.max(0.01, zoomRef.current)
      const scene = clientToCanvasPoint(
        point,
        bounds,
        docRef.current.widthMm * scale,
        docRef.current.heightMm * scale,
        zoomValue,
        labelRotationRef.current
      )
      return fromViewport
        ? new fabric.Point(scene.x * zoomValue, scene.y * zoomValue)
        : new fabric.Point(scene.x, scene.y)
    }
    // Fabric 7 移除了旧版 getPointer；统一覆盖新的场景坐标入口，保留旋转标签的命中行为。
    canvas.getScenePoint = scenePointer as typeof canvas.getScenePoint

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
    canvas.findTarget = ((e: any) => {
      const target = origFindTarget(e)
      if (target && isHollowFill(target)) {
        const vp = canvas.getScenePoint(e)
        if (!isNearStroke(target, vp.x, vp.y)) return undefined
      }
      return target
    }) as typeof canvas.findTarget

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
        for (const [, refVal] of hRefs) {
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
        for (const [, refVal] of vRefs) {
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

    // Keep a small DOM-readable snapshot of the active Fabric frame. It is
    // useful for CDP parity probes and is derived from the same live object
    // that paints the selection handles; it is not a second geometry source.
    const publishFabricTransform = (target: fabric.Object) => {
      rootRef.current?.setAttribute('data-active-fabric-transform', JSON.stringify({
        left: target.left ?? 0,
        top: target.top ?? 0,
        width: target.width ?? 0,
        height: target.height ?? 0,
        scaleX: target.scaleX ?? 1,
        scaleY: target.scaleY ?? 1,
        zoom: zoomRef.current,
        angle: target.angle ?? 0,
        originX: target.originX,
        originY: target.originY
      }))
    }

    // Fabric exposes the active control and modifier in the same scaling
    // event that drives the visible handles.  Quantize only the object types
    // whose output unit is discrete, and apply LabelShop's SHIFT/text rules
    // before object:modified persists the final millimetre geometry.
    canvas.on('object:scaling', (e: any) => {
      const target = e.target as fabric.Object | undefined
      const id = target ? (target as fabric.Object & { dataId?: string }).dataId : undefined
      if (!target || !id || String(id).startsWith('__')) return
      const model = findModelObjectById(docRef.current.objects, id)
      if (!model) return
      const result = constrainFabricResize({
        object: model,
        baseWidthPx: Number(target.width ?? 0),
        baseHeightPx: Number(target.height ?? 0),
        scaleX: Number(target.scaleX ?? 1),
        scaleY: Number(target.scaleY ?? 1),
        corner: String(e.transform?.corner ?? ''),
        shiftKey: Boolean((e.e as MouseEvent | PointerEvent | undefined)?.shiftKey || e.transform?.shiftKey),
        pixelsPerMm: scale
      })
      const fabricCorner = String(e.transform?.corner ?? '')
      if (model.type === 'text' && !['tl', 'tr', 'bl', 'br'].includes(fabricCorner)) {
        // Fabric's Text recalculates its glyph box while an edge is dragged.
        // Keep the orthogonal scale fixed so the middle handle stretches one
        // axis instead of silently changing the other axis as well.
        if (fabricCorner === 'mr' || fabricCorner === 'ml') {
          result.scaleY = model.h * scale / Math.max(1, Number(target.height ?? 0))
        }
        if (fabricCorner === 'mt' || fabricCorner === 'mb') {
          result.scaleX = model.w * scale / Math.max(1, Number(target.width ?? 0))
        }
      } else if (model.type === 'text') {
        // The glyph box may have changed before Fabric emits the scaling
        // event. Use the document frame ratio, which is the stable LabelShop
        // ratio, instead of the transient glyph-box ratio.
        const ratio = model.h / Math.max(0.1, model.w)
        result.scaleY = result.widthMm * ratio * scale / Math.max(1, Number(target.height ?? 0))
      }
      target.set({ scaleX: result.scaleX, scaleY: result.scaleY })
      target.setCoords()
      publishFabricTransform(target)
      canvas.requestRenderAll()
    })

    const onModified = () => {
      const fc = canvasRef.current
      if (!fc) return
      const active = fc.getActiveObject()
      if (active) publishFabricTransform(active)
      suppressRedrawRef.current = true
      const objs = docRef.current.objects.map((o) => {
        const fo = fc.getObjects().find((x) => (x as any).dataId === o.id)
        return fo ? syncFromFabric(o, fo, scale) : o
      })
      onSyncRef.current?.(objs)
    }

    // ---- 多选参考对象句柄颜色区分：第一个蓝色，其余深色 ----
    // Fabric's selection:updated event only reports the delta in some
    // versions. Always derive the complete active selection so Ctrl/Shift
    // selection cannot accidentally make the newly added object the primary
    // (blue-handle) object.
    const activeSelectionObjects = (event?: any): fabric.Object[] => {
      const active = canvas.getActiveObjects().filter((obj: any) => {
        const id = obj?.dataId
        return id && !String(id).startsWith('__')
      })
      if (active.length) return active
      return ((event?.selected ?? []) as fabric.Object[]).filter((obj: any) => {
        const id = obj?.dataId
        return id && !String(id).startsWith('__')
      })
    }
    const publishSelectionState = (objects: fabric.Object[]) => {
      const ids = objects.map((obj: any) => String(obj.dataId))
      if (!ids.length) {
        rootRef.current?.removeAttribute('data-active-fabric-selection')
        return
      }
      rootRef.current?.setAttribute('data-active-fabric-selection', JSON.stringify({
        ids,
        primaryId: ids[0],
        cornerColors: objects.map((obj: any) => String(obj.cornerColor ?? ''))
      }))
    }
    const applySelectionHandles = (e: any) => {
      const sel = activeSelectionObjects(e)
      if (!sel.length) return
      sel.forEach((obj, i) => {
        if (i === 0) {
          obj.set({ cornerColor: '#1E90FF', cornerStrokeColor: '#1E90FF' })
        } else {
          obj.set({ cornerColor: '#333333', cornerStrokeColor: '#333333' })
        }
      })
      publishSelectionState(sel)
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

    // Fabric toggles a member out of an ActiveSelection on Shift-click, but
    // older Fabric releases keep a lone active object selected. Keep the
    // LabelShop rule (Shift-click the only selected object clears it) stable
    // across both cases.
    let shiftClearTarget: fabric.Object | null = null

    // ---- 拖拽绘制对象 ----
    canvas.on('mouse:down', (e: any) => {
      const t = toolRef.current
      if (t === 'select') {
        const active = canvas.getActiveObjects()
        shiftClearTarget = e.e?.shiftKey && e.target && active.length === 1 && active[0] === e.target
          ? e.target
          : null
        return
      }
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
      const pt = fc.getScenePoint(e.e)
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
          const pt = fc.getScenePoint(e.e)
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
      const pt = fc.getScenePoint(e.e)
      fn(+(pt.x / scale).toFixed(2), +(pt.y / scale).toFixed(2))
    })

    canvas.on('mouse:up', (e: any) => {
      if (shiftClearTarget) {
        shiftClearTarget = null
        canvas.discardActiveObject()
        canvas.requestRenderAll()
      }
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
      const pt = fc.getScenePoint(e.e)
      const mmX = +(Math.min(drag.startX, pt.x) / scale).toFixed(2)
      const mmY = +(Math.min(drag.startY, pt.y) / scale).toFixed(2)
      const mmW = +(Math.abs(pt.x - drag.startX) / scale).toFixed(2)
      const mmH = +(Math.abs(pt.y - drag.startY) / scale).toFixed(2)
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
      const active = activeSelectionObjects(e)
      if (active[0]) publishFabricTransform(active[0])
      const accepted = selectRef.current((active[0] as any)?.dataId ?? null)
      // 非打印对象在「不选中非打印对象」开启时不可选中（帮助 config_general.html）：
      // 立即丢弃 Fabric 的临时选中，保持它只作为背景显示。
      if (accepted === null && (active[0] as any)?.dataId) { canvas.discardActiveObject(); canvas.requestRenderAll() }
    })
    canvas.on('selection:updated', (e: any) => {
      applySelectionHandles(e)
      const active = activeSelectionObjects(e)
      if (active[0]) publishFabricTransform(active[0])
      const accepted = selectRef.current((active[0] as any)?.dataId ?? null)
      // 非打印对象在「不选中非打印对象」开启时不可选中（帮助 config_general.html）：
      // 立即丢弃 Fabric 的临时选中，保持它只作为背景显示。
      if (accepted === null && (active[0] as any)?.dataId) { canvas.discardActiveObject(); canvas.requestRenderAll() }
    })
    canvas.on('selection:cleared', () => {
      // 全量重建内部的 clear() 会触发本事件，不能借此清掉模型选中态（见下方重建 effect）。
      if (rebuildingRef.current) return
      resetSelectionHandles()
      rootRef.current?.removeAttribute('data-active-fabric-transform')
      rootRef.current?.removeAttribute('data-active-fabric-selection')
      selectRef.current(null)
    })

    // Double-clicking should use the logical object frame, not only the
    // rendered glyph bounds. Text objects are intentionally rendered from
    // their content width while the document stores a resizable text frame;
    // LabelShop treats both as the same clickable object. This also makes a
    // double-click at a frame corner reliable after an object is created.
    const pointInModelFrame = (object: LabelObject, pt: { x: number; y: number }) => {
      const width = Math.max(0.1, object.w) * scale
      const height = Math.max(0.1, object.h) * scale
      const centerX = (object.type === 'group' ? object.x : object.x + object.w / 2) * scale
      const centerY = (object.type === 'group' ? object.y : object.y + object.h / 2) * scale
      const angle = ((object.rotation ?? 0) * Math.PI) / 180
      const dx = pt.x - centerX
      const dy = pt.y - centerY
      const localX = Math.cos(angle) * dx + Math.sin(angle) * dy
      const localY = -Math.sin(angle) * dx + Math.cos(angle) * dy
      const tolerance = object.type === 'line' ? Math.max(4, object.strokeWidth * scale + 4) : 0
      return Math.abs(localX) <= width / 2 + tolerance && Math.abs(localY) <= height / 2 + tolerance
    }

    const findModelObjectById = (objects: LabelObject[], id: string): LabelObject | undefined => {
      for (const object of objects) {
        if (object.id === id) return object
        if (object.type === 'group') {
          const nested = findModelObjectById(object.children, id)
          if (nested) return nested
        }
      }
      return undefined
    }

    const fabricObjectAtScenePoint = (obj: any, pt: { x: number; y: number }) => {
      const center = obj.getCenterPoint?.()
      if (!center) return false
      const width = Math.max(0.1, Number(obj.getScaledWidth?.() ?? obj.width ?? 0))
      const height = Math.max(0.1, Number(obj.getScaledHeight?.() ?? obj.height ?? 0))
      const angle = ((Number(obj.angle ?? 0) % 360) * Math.PI) / 180
      const dx = pt.x - center.x
      const dy = pt.y - center.y
      const localX = Math.cos(angle) * dx + Math.sin(angle) * dy
      const localY = -Math.sin(angle) * dx + Math.cos(angle) * dy
      const tolerance = obj.type === 'line' ? Math.max(4, Number(obj.strokeWidth ?? 0) + 4) : 0
      return Math.abs(localX) <= width / 2 + tolerance && Math.abs(localY) <= height / 2 + tolerance
    }

    // All manual hit tests consume scene pixels. Fabric's getBoundingRect()
    // is affected by its viewport transform in some versions, so comparing it
    // with scenePointer() would mix viewport pixels and scene pixels whenever
    // the editor is zoomed or scrolled. Resolve document objects with the
    // model frame first; for transient Fabric objects (for example a test
    // harness object) use Fabric's scene-plane center and scaled dimensions,
    // never its viewport bounding rectangle.
    const hitTest = (obj: any, pt: { x: number; y: number }) => {
      const id = typeof obj?.dataId === 'string' ? obj.dataId : ''
      if (!id || id.startsWith('__')) return false
      const model = findModelObjectById(docRef.current.objects, id)
      return model ? pointInModelFrame(model, pt) : fabricObjectAtScenePoint(obj, pt)
    }

    const modelObjectAt = (pt: { x: number; y: number }, includeChild: boolean): string | null => {
      const visit = (object: LabelObject): string | null => {
        if (object.visible === false || !pointInModelFrame(object, pt)) return null
        if (includeChild && object.type === 'group') {
          for (let index = object.children.length - 1; index >= 0; index -= 1) {
            const child = visit(object.children[index])
            if (child) return child
          }
        }
        return object.id
      }
      for (let index = docRef.current.objects.length - 1; index >= 0; index -= 1) {
        const id = visit(docRef.current.objects[index])
        if (id) return id
      }
      return null
    }

    // ---- 双击对象 → 属性（DOM 级可靠触发）----
    const onDblClickDom = (ev: MouseEvent) => {
      const fc = canvasRef.current
      if (!fc) return
      const pt = scenePointer(ev as any)
      const allObjs = fc.getObjects()
      const modelId = modelObjectAt(pt, ev.altKey)
      let target = modelId
        ? findFabricObjectById(allObjs, modelId)?.root
        : undefined
      if (!target) {
        for (let i = allObjs.length - 1; i >= 0; i -= 1) {
          const obj = allObjs[i]
          const id = (obj as any).dataId
          if (!id || String(id).startsWith('__')) continue
          if (hitTest(obj, pt)) {
            target = obj
            break
          }
        }
      }
      if (!target && modelId) target = findFabricObjectById(allObjs, modelId)?.root
      if (!target) return

      // The dialog is opened from the same selection state as the property
      // command. Keeping Fabric selected prevents the modal close action from
      // visually losing the object that was just edited.
      const active = fc.getActiveObject()
      if (active !== target) {
        fc.discardActiveObject()
        fc.setActiveObject(target)
        fc.requestRenderAll()
      }
      const id = modelId ?? (target as any).dataId
      if (id && !String(id).startsWith('__')) {
        if (!selectRef.current(String(id))) return
        dblClickRef.current?.(String(id))
      }
    }
    rootRef.current?.addEventListener('dblclick', onDblClickDom)

    // ---- 右键菜单（使用 Fabric 原生 contextmenu 事件） ----
    // Fabric 会在这里完成一次对象命中，并把 target / subTargets 传给事件。
    // 直接订阅 Fabric 事件可以覆盖空白画布与对象右键，不依赖 DOM 冒泡顺序，
    // 也不会被 Fabric 默认的 stopContextMenu 提前截断。
    const onContextMenuFabric = (options: any) => {
      const ev = options?.e as MouseEvent | undefined
      const fc = canvasRef.current
      if (!fc || !ev) return
      ev.preventDefault()
      ev.stopPropagation()
      const pt = scenePointer(ev)
      let target: fabric.Object | null = options?.target ?? null
      const targetId = target ? (target as any).dataId : undefined
      if (!targetId || String(targetId).startsWith('__')) target = null
      // Fabric 对空心图形的内部空白会返回对象本身，继续用统一的包围盒/边框规则校正。
      if (target && !hitTest(target, pt)) target = null
      // 兜底命中：保证嵌套对象、Fabric 版本差异以及旋转标签下仍能右键选中。
      if (!target) {
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
    canvas.on('contextmenu', onContextMenuFabric)

    readyRef.current?.(canvas)

    return () => {
      canvas.off('contextmenu', onContextMenuFabric)
      rootRef.current?.removeEventListener('dblclick', onDblClickDom)
      canvas.dispose()
      canvasRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 缩放
  useEffect(() => {
    applyZoom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, doc.widthMm, doc.heightMm])

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
    applyZoom()

    // 全量重建会先 fc.clear()，而 clear() 会触发 fabric 的 selection:cleared。
    // 若让该事件照常执行，它会 selectRef.current(null) 把模型的选中态清掉，
    // 此时本 effect 末尾的恢复逻辑读到的已是 null —— 表现为「用格式栏改一下字体/粗体，
    // 对象就掉选，属性面板与格式栏立刻变空」。这是 B-05 所见即所得编辑闭环的硬伤。
    // 因此：重建窗口内屏蔽该事件，并在 clear() 之前先把选中 id 取出来。
    const keepSelectedId = selectedRef.current
    rebuildingRef.current = true
    try {
      fc.clear()
    } finally {
      rebuildingRef.current = false
    }
    // Fabric 7 defaults to a centre origin. Paper coordinates are top-left based.
    const bg = new fabric.Rect({ left: 0, top: 0, originX: 'left', originY: 'top', width: W, height: H, strokeWidth: 0, fill: '#ffffff', selectable: false, evented: false })
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
    const editorNow = Date.now()
    const run = async () => {
      for (const o of doc.objects) {
        if (cancelled) return
        if (o.visible === false) continue
        try {
           const obj = await makeObject(o, scale, { colorTable: doc.colorIndexTable, ctx: { labelIndex: 1, recordIndex, copy: 1, count: 1, totalLabels: 1, title: doc.name, printerName: '', datasets: doc.datasets ?? {}, sharedVars: {}, keyboardValues, allowScript, activeDataset: datasetName || undefined, now: editorNow } })
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
      // Expose the materialized Fabric kinds for CDP smoke checks. This is
      // derived from the same objects used for the visible canvas, so it also
      // catches shape-model/render mismatches without adding editor UI.
      rootRef.current?.setAttribute('data-rendered-object-types', objects.map((obj) => obj.type).join(','))
      const sid = keepSelectedId
      if (sid) {
        const found = findFabricObjectById(fc.getObjects(), sid)
        if (found) {
          // Fabric keeps group children in the group's coordinate system. It
          // cannot always expose a nested child as the active top-level target,
          // but it can still focus it and the model selection remains the child.
          fc.setActiveObject(found.root)
          selectRef.current(sid)
        }
      }
      fc.requestRenderAll()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [allowScript, datasetName, doc, keyboardValues, recordIndex, showGrid])

  useEffect(() => {
    const fc = canvasRef.current
    if (!fc?.wrapperEl) return
    const wrapper = fc.wrapperEl
    wrapper.style.overflow = 'hidden'
    wrapper.style.clipPath = `url(#${clipId})`
  }, [clipId])

  const renderW = Math.round(doc.widthMm * 10 * (zoom ?? 1))
  const renderH = Math.round(doc.heightMm * 10 * (zoom ?? 1))
  const paperGeometry = {
    shape: labelShape,
    cornerRadiusMm: (doc.layout?.cornerRadiusMm ?? Math.min(doc.widthMm, doc.heightMm) * 0.12) * 10 * (zoom ?? 1),
    innerDiameterMm: (doc.layout?.innerDiameterMm ?? (labelShape === 'disc' ? 15 : 0)) * 10 * (zoom ?? 1)
  } as const
  const outlinePath = paperPath(doc.widthMm, doc.heightMm, { ...doc.layout, shape: labelShape })
  const clipPath = paperPath(renderW, renderH, paperGeometry)

  return (
    <div
      ref={rootRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box'
      }}
    >
      <canvas ref={canvasElRef} />
      {/* Editor-only paper edge: never becomes a Fabric object or print primitive. */}
      <svg data-testid="paper-outline" aria-hidden="true" viewBox={`0 0 ${renderW} ${renderH}`} width={renderW} height={renderH} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
        <defs><clipPath id={clipId} clipPathUnits="userSpaceOnUse"><path d={clipPath} fillRule="evenodd" /></clipPath></defs>
        <path d={outlinePath} transform={`scale(${10 * (zoom ?? 1)})`} fill="none" stroke="#000" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  )
}
