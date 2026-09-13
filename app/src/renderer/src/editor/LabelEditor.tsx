import { useEffect, useId, useRef } from 'react'
import * as fabric from 'fabric'
import { paperPath, type PaperShape } from '../../../shared/domain/paper'
import type { LabelDoc, LabelObject } from '../types'
import { PX_PER_MM } from '../types'
import { makeObject } from '../rendering/fabricObjects'
import { syncFromFabric } from '../features/canvas/syncFromFabric'
import { clientToCanvasPoint } from './canvasCoordinates'

interface Props {
  doc: LabelDoc
  selectedId: string | null
  onSelect: (id: string | null) => void
  onSync: (objs: LabelObject[]) => void
  zoom?: number
  onMouseMove?: (mmX: number, mmY: number) => void
  onCanvasReady?: (canvas: fabric.Canvas) => void
  showGrid?: boolean
  allowScript?: boolean
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


export default function LabelEditor({ doc, selectedId, onSelect, onSync, zoom, onMouseMove, onCanvasReady, showGrid = false, allowScript = false, tool = 'select', onCreateAt, onCreateRect, onContextMenu, onDoubleClick, onToolObjClick, labelRotation = 0, labelShape = 'rect' }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const clipId = `paper-clip-${useId().replace(/:/g, '')}`
  const canvasRef = useRef<fabric.Canvas | null>(null)
  const docRef = useRef(doc)
  const selectedRef = useRef<string | null>(selectedId)
  const zoomRef = useRef(zoom ?? 1)
  const labelRotationRef = useRef(labelRotation)
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
  labelRotationRef.current = labelRotation
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
    const clientPoint = (event: any): { x: number; y: number } => {
      const touch = event?.changedTouches?.[0] ?? event?.touches?.[0] ?? event
      return { x: Number(touch?.clientX ?? 0), y: Number(touch?.clientY ?? 0) }
    }
    const scenePointer = (event: any, fromViewport = false): fabric.Point => {
      const bounds = canvas.upperCanvasEl.getBoundingClientRect()
      const point = clientPoint(event)
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

    const onModified = () => {
      const fc = canvasRef.current
      if (!fc) return
      suppressRedrawRef.current = true
      const objs = docRef.current.objects.map((o) => {
        const fo = fc.getObjects().find((x) => (x as any).dataId === o.id)
        return fo ? syncFromFabric(o, fo, scale) : o
      })
      onSyncRef.current?.(objs)
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
      const pt = scenePointer(ev as any)
      const allObjs = fc.getObjects()
      for (let i = allObjs.length - 1; i >= 0; i--) {
        const obj = allObjs[i]
        const id = (obj as any).dataId
        if (!id || String(id).startsWith('__')) continue
        if (hitTest(obj, pt)) {
          if (ev.altKey && obj.type === 'group') {
            const nestedHit = (children: fabric.Object[]): string | null => {
              for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
                const child = children[childIndex]
                if (!hitTest(child, pt)) continue
                if (child.type === 'group') {
                  const nested = nestedHit((child as fabric.Group).getObjects())
                  if (nested) return nested
                }
                const childId = (child as any).dataId
                if (childId && !String(childId).startsWith('__')) return String(childId)
              }
              return null
            }
            dblClickRef.current?.(nestedHit((obj as fabric.Group).getObjects()) ?? id)
          } else {
            dblClickRef.current?.(id)
          }
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
      const pt = scenePointer(ev as any)
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

    readyRef.current?.(canvas)

    return () => {
      rootRef.current?.removeEventListener('contextmenu', onContextMenuDom)
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

    fc.clear()
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
           const obj = await makeObject(o, scale, { colorTable: doc.colorIndexTable, ctx: allowScript ? { labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: doc.name, printerName: '', datasets: doc.datasets ?? {}, sharedVars: {}, keyboardValues: {}, allowScript, now: editorNow } : undefined })
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
        const found = findFabricObjectById(fc.getObjects(), sid)
        if (found) {
          // Fabric keeps group children in the group's coordinate system. It
          // cannot always expose a nested child as the active top-level target,
          // but it can still focus it and the model selection remains the child.
          fc.setActiveObject(found.root)
          onSelect(sid)
        }
      }
      fc.requestRenderAll()
    }
    run()
    return () => {
      cancelled = true
    }
  }, [allowScript, doc, showGrid])

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
