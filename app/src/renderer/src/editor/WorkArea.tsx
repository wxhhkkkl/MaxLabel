import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as fabric from 'fabric'
import type { LabelDoc, LabelObject } from '../types'
import LabelEditor from './LabelEditor'
import { clientRectFromPoints, objectClientBounds, rectIntersects } from './frameSelection'
import { objectBounds } from '../features/editor/operations'
import { findObjectById } from '../../../shared/domain/objects'
import { PX_PER_MM } from '../../../shared/domain/units'
import { syncFromFabric } from '../features/canvas/syncFromFabric'
import type { RectShape } from '../../../shared/domain/shapes'

export const ZOOM_LEVELS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 4]
/** 缩放下限：条幅/飘带这类 1000mm 长标签，50% 都看不全。 */
export const MIN_ZOOM = 0.05
/** −/+ 沿等级表走一格：小倍率时步长 5%~10%，不会从 5% 一跳跳到 30%。 */
export function stepZoom(zoom: number, direction: -1 | 1): number {
  if (direction > 0) return ZOOM_LEVELS.find((level) => level > zoom + 1e-6) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
  return [...ZOOM_LEVELS].reverse().find((level) => level < zoom - 1e-6) ?? MIN_ZOOM
}
const FIT_GUTTER_PX = 12

interface SelectionBox {
  left: number
  top: number
  width: number
  height: number
}

interface Props {
  doc: LabelDoc
  selectedId: string | null
  onSelect: (id: string | null) => string | null
  onSync: (objs: LabelObject[]) => void
  zoom: number
  setZoom: (z: number, automatic?: boolean) => void
  zoomMode?: 'manual' | 'win' | 'w' | 'h'
  onMouseMove: (x: number, y: number) => void
  onMouseLeave?: () => void
  showRulers: boolean
  showGrid: boolean
  allowScript?: boolean
  /** 当前激活的数据记录及打印前键盘输入，用于画布实时预览数据源。 */
  recordIndex?: number
  datasetName?: string
  keyboardValues?: Record<string, string>
  onCanvasReady?: (canvas: fabric.Canvas) => void
  tool?: string
  /** 图形工具当前形状（拖拽预览与创建共用）。 */
  createShape?: RectShape
  onCreateAt?: (type: string, mmX: number, mmY: number) => void
  onToolObjClick?: (objId: string) => void
  onCreateRect?: (type: string, mmX: number, mmY: number, mmW: number, mmH: number) => void
  onContextMenu?: (screenX: number, screenY: number, hasSelection: boolean, selectionCount: number) => void
  onDoubleClick?: (objId: string) => void
  /** Ctrl+拖拽：拖动结束后在原位置补一份副本 */
  onCtrlDragDuplicate?: (ids: string[], positions: Record<string, { x: number; y: number }>) => void
  /** 版面旋转（0/90/180/270，纯显示方向） */
  labelRotation?: number
  /** 点击旋转指示图标循环旋转版面 */
  onRotate?: () => void
  /** 标签工作区背景颜色（系统选项可调，默认 #22BDED） */
  workspaceBg?: string
  /** 标尺单位（系统选项可调，默认毫米） */
  unit?: 'mm' | 'inch'
  /** 当前标签页标识：切换标签/打开新文档时触发一次"适应窗口"自动缩放 */
  docKey?: string | number
}

function isEditableTarget(t: unknown): boolean {
  const el = t as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

/** 标尺上要标色的区间（毫米，相对纸张原点，已换算到屏幕轴方向）。 */
interface RulerRange {
  start: number
  end: number
}

function Ruler({ lengthMm, pxPerMm, horizontal, offset = 0, unit = 'mm', selection }: {
  lengthMm: number
  pxPerMm: number
  horizontal: boolean
  offset?: number
  unit?: 'mm' | 'inch'
  /** 当前选中对象在标尺轴上的范围：画一条浅蓝色色带示意。 */
  selection?: RulerRange | null
}) {
  const size = Math.max(1, Math.round(lengthMm * pxPerMm))
  // `offset` is the screen position of the document origin in the ruler's
  // local coordinate system. Deriving both bounds from it lets the ruler
  // expose the workspace before 0 as negative coordinates.
  const startMm = offset / pxPerMm
  const endMm = (size + offset) / pxPerMm
  const ticks = useMemo(() => {
    const out: Array<{ pos: number; label: string; major: boolean }> = []
    if (unit === 'inch') {
      // 英寸标尺：0.25" 为次刻度，0.5"/1" 为主刻度
      const stepMm = 6.35
      const start = Math.floor(startMm / stepMm)
      const end = Math.ceil(endMm / stepMm)
      for (let i = start; i <= end; i++) {
        const mm = i * 6.35 // 0.25 inch
        const inches = i / 4
        const label = Number.isInteger(inches) ? String(inches) : inches.toFixed(2)
        out.push({ pos: mm, label: `${label}"`, major: i % 2 === 0 })
      }
      return out
    }
    // 毫米：刻度密度随缩放自适应 —— 固定 1mm 次刻度在小倍率下会挤成一片，
    // 放大后又显得太稀。次刻度间距不小于 4px，数字间距不小于 100px。
    const steps = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
    const minor = steps.find((step) => step * pxPerMm >= 4) ?? 2000
    const labelled = steps.find((step) => step >= minor && step * pxPerMm >= 100) ?? minor * 10
    for (let mm = Math.floor(startMm / minor) * minor; mm <= Math.ceil(endMm); mm += minor) {
      const major = Math.abs(mm % labelled) < 1e-6
      out.push({ pos: mm, label: major ? String(mm) : '', major })
    }
    return out
  }, [endMm, startMm, unit, pxPerMm])

  // 选中范围色带：画在刻度下面，刻度与数字仍清晰可读。
  const band = selection && selection.end > selection.start
    ? {
        position: 'absolute' as const,
        background: '#CFE8F7',
        ...(horizontal
          ? {
              left: Math.round(selection.start * pxPerMm) - offset,
              top: 0,
              width: Math.max(1, Math.round((selection.end - selection.start) * pxPerMm)),
              height: '100%'
            }
          : {
              top: Math.round(selection.start * pxPerMm) - offset,
              left: 0,
              height: Math.max(1, Math.round((selection.end - selection.start) * pxPerMm)),
              width: '100%'
            })
      }
    : null

  return (
    <div
      data-testid={horizontal ? 'ruler-x' : 'ruler-y'}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#F7F8F9',
        ...(horizontal ? { width: size, height: 20 } : { width: 20, height: size })
      }}
    >
      {band && <div data-testid={horizontal ? 'ruler-x-selection' : 'ruler-y-selection'} style={band} />}
      {ticks.map((t, idx) =>
        horizontal ? (
          <div
            key={idx}
            data-ruler-zero={Math.abs(t.pos) < 0.000001 ? 'true' : undefined}
            style={{ position: 'absolute', left: Math.round(t.pos * pxPerMm) - offset, top: 0, width: 1, height: '100%' }}
          >
            {/* 数字在上、刻度线贴着画布一侧（下沿），与真机标尺一致 */}
            <span style={{ position: 'absolute', left: 0, bottom: 0, width: 1, height: t.major ? 6 : 3, background: '#555' }} />
            {t.major && (
              <span style={{ position: 'absolute', left: 2, top: 1, fontSize: 9, color: '#333', whiteSpace: 'nowrap' }}>{t.label}</span>
            )}
          </div>
        ) : (
          <div
            key={idx}
            data-ruler-zero={Math.abs(t.pos) < 0.000001 ? 'true' : undefined}
            style={{ position: 'absolute', top: Math.round(t.pos * pxPerMm) - offset, left: 0, width: '100%', height: 1 }}
          >
            {/* 数字在左、刻度线贴着画布一侧（右沿）；数字以刻度线为中心上下居中 */}
            <span style={{ position: 'absolute', right: 0, top: 0, height: 1, width: t.major ? 6 : 3, background: '#555' }} />
            {t.major && (
              <span style={{ position: 'absolute', left: 1, top: 0, transform: 'translateY(-50%)', fontSize: 9, color: '#333', whiteSpace: 'nowrap' }}>{t.label}</span>
            )}
          </div>
        )
      )}
    </div>
  )
}

import { useI18n } from '../features/i18n/useI18n'
import { localizeToolbarLabel } from '../../../shared/i18n/toolbar.en-US'
import { computeFitZoom } from './fitZoom'

export default function WorkArea(props: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizeToolbarLabel(text, language)
  const { doc, zoom, setZoom, zoomMode = 'win', showRulers, showGrid, labelRotation = 0, onRotate, workspaceBg = '#22BDED', unit = 'mm', docKey } = props
  const pxPerMm = 10 * zoom
  const scrollRef = useRef<HTMLDivElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const spaceRef = useRef(false)
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null)
  const panCleanupRef = useRef<(() => void) | null>(null)
  const zoomAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null)
  const selectionDragRef = useRef<{ startX: number; startY: number } | null>(null)
  const selectionCleanupRef = useRef<(() => void) | null>(null)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const [scroll, setScroll] = useState({ x: 0, y: 0 })
  /** 画布实例就绪计数：LabelEditor 建好 canvas 后加一，用来挂拖拽期间的实时标尺色带监听。 */
  const [canvasEpoch, setCanvasEpoch] = useState(0)
  /** 拖动/缩放/旋转过程中的实时包围盒（文档毫米）：模型要到松手才同步，色带得先跟手。 */
  const [liveBounds, setLiveBounds] = useState<{ left: number; top: number; right: number; bottom: number } | null>(null)
  // 画布事件回调里读最新的文档/选中对象（监听只挂一次，不能闭包旧值）。
  const docRef = useRef(doc)
  docRef.current = doc
  const selectedIdRef = useRef(props.selectedId)
  selectedIdRef.current = props.selectedId

  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas) return
    // 拖动期间的实时包围盒。单个对象走与松手同步完全相同的换算（syncFromFabric），
    // 条码/文字的渲染框与模型框不同（内容居中放进对象框），直接用渲染框会在松手时跳一下。
    // 多选（ActiveSelection）没有单一模型对象，退回渲染框的并集。
    const syncLive = () => {
      const active = canvas.getActiveObject()
      if (!active) return
      const model = selectedIdRef.current ? findObjectById(docRef.current.objects, selectedIdRef.current) : undefined
      if (model && active.type !== 'activeSelection' && (active as { dataId?: string }).dataId === model.id) {
        setLiveBounds(objectBounds(syncFromFabric(model, active, PX_PER_MM)))
        return
      }
      const rect = active.getBoundingRect()
      setLiveBounds({
        left: rect.left / PX_PER_MM,
        top: rect.top / PX_PER_MM,
        right: (rect.left + rect.width) / PX_PER_MM,
        bottom: (rect.top + rect.height) / PX_PER_MM
      })
    }
    canvas.on('object:moving', syncLive)
    canvas.on('object:scaling', syncLive)
    canvas.on('object:rotating', syncLive)
    canvas.on('object:modified', syncLive)
    return () => {
      canvas.off('object:moving', syncLive)
      canvas.off('object:scaling', syncLive)
      canvas.off('object:rotating', syncLive)
      canvas.off('object:modified', syncLive)
    }
  }, [canvasEpoch])

  // 松手后模型完成同步（doc 变了）再撤掉实时包围盒，避免色带闪回旧位置。
  useEffect(() => { setLiveBounds(null) }, [doc])

  // 工作区（视口）尺寸：标尺固定在左上角，按视口宽度/高度铺满
  const [vpSize, setVpSize] = useState<{ w: number; h: number; cw: number; ch: number }>({ w: 0, h: 0, cw: 0, ch: 0 })
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Measure the stable viewport box, not clientWidth while stale oversized
    // paper temporarily introduces scrollbars during a native-window resize.
    const update = () => {
      const next = { w: el.offsetWidth, h: el.offsetHeight, cw: el.clientWidth, ch: el.clientHeight }
      setVpSize((current) => current.w === next.w && current.h === next.h && current.cw === next.cw && current.ch === next.ch ? current : next)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el, { box: 'border-box' })
    return () => ro.disconnect()
  }, [showRulers])

  // Fit is an explicit per-document mode, not inferred from asynchronous zoom updates.
  useEffect(() => {
    if (vpSize.w === 0 || vpSize.h === 0) return
    if (zoomMode === 'manual') return
    const el = scrollRef.current
    const nextZoom = computeFitZoom({
      mode: zoomMode,
      widthMm: doc.widthMm,
      heightMm: doc.heightMm,
      rotation: labelRotation,
      availableWidthPx: el?.clientWidth || vpSize.cw || vpSize.w,
      availableHeightPx: el?.clientHeight || vpSize.ch || vpSize.h,
      gutterPx: FIT_GUTTER_PX
    })
    if (Math.abs(nextZoom - zoom) > 0.000001) setZoom(nextZoom, true)
  }, [doc.widthMm, doc.heightMm, labelRotation, zoomMode, vpSize.ch, vpSize.cw, vpSize.h, vpSize.w, setZoom, zoom])

  // 空格 + 左键拖动画布平移
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditableTarget(e.target)) {
        spaceRef.current = true
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceRef.current = false
        panRef.current = null
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  const updatePan = (clientX: number, clientY: number) => {
    const pan = panRef.current
    const el = scrollRef.current
    if (!pan || !el) return
    el.scrollLeft = pan.sl - (clientX - pan.x)
    el.scrollTop = pan.st - (clientY - pan.y)
  }

  const onPanDown = (e: React.MouseEvent) => {
    if (!spaceRef.current || e.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    panCleanupRef.current?.()
    panRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
    el.style.cursor = 'grabbing'
    const onWindowMove = (event: MouseEvent) => {
      updatePan(event.clientX, event.clientY)
    }
    const onWindowUp = () => {
      window.removeEventListener('mousemove', onWindowMove)
      window.removeEventListener('mouseup', onWindowUp)
      panCleanupRef.current = null
      onPanUp()
    }
    panCleanupRef.current = () => {
      window.removeEventListener('mousemove', onWindowMove)
      window.removeEventListener('mouseup', onWindowUp)
    }
    window.addEventListener('mousemove', onWindowMove)
    window.addEventListener('mouseup', onWindowUp)
  }
  const onPanMove = (e: React.MouseEvent) => {
    updatePan(e.clientX, e.clientY)
  }
  const onPanUp = () => {
    const el = scrollRef.current
    if (el) el.style.cursor = ''
    panRef.current = null
  }

  const contentPoint = (clientX: number, clientY: number) => {
    const el = scrollRef.current
    if (!el) return { x: clientX, y: clientY }
    const rect = el.getBoundingClientRect()
    return { x: clientX - rect.left + el.scrollLeft, y: clientY - rect.top + el.scrollTop }
  }

  const updateSelectionBox = (startX: number, startY: number, endX: number, endY: number) => {
    const start = contentPoint(startX, startY)
    const end = contentPoint(endX, endY)
    setSelectionBox({ left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) })
  }

  const setManualZoom = (nextZoom: number) => {
    setZoom(nextZoom)
  }

  const selectObjectsInBlueDrag = (startX: number, startY: number, endX: number, endY: number) => {
    const canvas = fabricCanvasRef.current
    if (!canvas || props.tool && props.tool !== 'select') return
    const canvasRect = canvas.upperCanvasEl.getBoundingClientRect()
    const selection = clientRectFromPoints(startX, startY, endX, endY)
    if (selection.right - selection.left < 3 && selection.bottom - selection.top < 3) {
      canvas.discardActiveObject()
      canvas.requestRenderAll()
      return
    }

    const targets = doc.objects
      .filter((object) => object.visible !== false && object.locked !== true)
      .filter((object) => rectIntersects(selection, objectClientBounds(object, doc, canvasRect, zoom, labelRotation)))
      .map((object) => canvas.getObjects().find((item) => (item as fabric.Object & { dataId?: string }).dataId === object.id))
      .filter((object): object is fabric.Object => Boolean(object && object.selectable !== false))

    canvas.discardActiveObject()
    if (targets.length === 1) canvas.setActiveObject(targets[0])
    else if (targets.length > 1) canvas.setActiveObject(new fabric.ActiveSelection(targets, { canvas }))
    canvas.requestRenderAll()
  }

  const endSelectionDrag = (endX: number, endY: number) => {
    const start = selectionDragRef.current
    selectionDragRef.current = null
    selectionCleanupRef.current?.()
    selectionCleanupRef.current = null
    setSelectionBox(null)
    if (start) selectObjectsInBlueDrag(start.startX, start.startY, endX, endY)
  }

  const onWorkspaceMouseDown = (e: React.MouseEvent) => {
    onPanDown(e)
    if (e.button !== 0 || spaceRef.current || (props.tool && props.tool !== 'select')) return
    const target = e.target as HTMLElement | null
    if (target?.closest('canvas,button,select,input,textarea')) return
    if (!scrollRef.current) return
    e.preventDefault()
    selectionDragRef.current = { startX: e.clientX, startY: e.clientY }
    updateSelectionBox(e.clientX, e.clientY, e.clientX, e.clientY)
    const onMove = (event: MouseEvent) => {
      updateSelectionBox(selectionDragRef.current?.startX ?? event.clientX, selectionDragRef.current?.startY ?? event.clientY, event.clientX, event.clientY)
    }
    const onUp = (event: MouseEvent) => {
      endSelectionDrag(event.clientX, event.clientY)
    }
    const cleanup = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    selectionCleanupRef.current = cleanup
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp, { once: true })
  }

  useEffect(() => () => {
    panCleanupRef.current?.()
    selectionCleanupRef.current?.()
    panCleanupRef.current = null
    selectionCleanupRef.current = null
  }, [])

  const isSide = labelRotation === 90 || labelRotation === 270
  const innerW = Math.round(doc.widthMm * pxPerMm)
  const innerH = Math.round(doc.heightMm * pxPerMm)
  // 旋转后占用的逻辑尺寸（旋转容器 width/height 交换）
  const stageW = isSide ? innerH : innerW
  const stageH = isSide ? innerW : innerH
  const visibleW = scrollRef.current?.clientWidth || vpSize.cw || vpSize.w
  const visibleH = scrollRef.current?.clientHeight || vpSize.ch || vpSize.h
  // Fit modes center the short axis while keeping a small breathing room on
  // the long axis. Manual zoom keeps that same gutter when the paper overflows.
  const contentW = Math.max(visibleW, stageW + FIT_GUTTER_PX * 2)
  const contentH = Math.max(visibleH, stageH + FIT_GUTTER_PX * 2)
  // 对象工具激活时的标签编辑区光标（帮助 label_object_create.html：鼠标指针变为对应图标）。
  const drawingCursor: 'crosshair' | 'default' = props.tool && props.tool !== 'select' && props.tool !== 'data' ? 'crosshair' : 'default'
  // 取整不是洁癖：视口宽度与标签宽度之差是奇数时，/2 会落在 xxx.5 上，
  // 整个画布就会停在半个像素上，浏览器合成时对整张位图做一次重采样——
  // 条码和文字一起发虚（打印不受影响，所以一直没被发现）。
  const paperOffsetX = Math.round(Math.max(FIT_GUTTER_PX, (visibleW - stageW) / 2))
  const paperOffsetY = Math.round(Math.max(FIT_GUTTER_PX, (visibleH - stageH) / 2))

  /**
   * 选中对象在标尺上的范围示意：把对象的毫米包围盒（含旋转）按版面旋转映射到屏幕轴，
   * 标尺据此画一条浅蓝色色带。标尺坐标以「纸张左上角」为 0，与版面旋转后的 stage 一致。
   */
  const selectionRange = useMemo<{ x: RulerRange; y: RulerRange } | null>(() => {
    // 没有选中对象就没有色带（拖动期间模型还没同步到新坐标时，selectedId 仍指向原对象）。
    const object = props.selectedId ? findObjectById(doc.objects, props.selectedId) : undefined
    if (!object) return null
    const bounds = liveBounds ?? objectBounds(object)
    const cx = doc.widthMm / 2
    const cy = doc.heightMm / 2
    const rotate = (x: number, y: number): [number, number] => {
      const dx = x - cx
      const dy = y - cy
      if (labelRotation === 90) return [cy - dy, cx + dx]
      if (labelRotation === 180) return [cx - dx, cy - dy]
      if (labelRotation === 270) return [cy + dy, cx - dx]
      return [x, y]
    }
    const corners = [
      [bounds.left, bounds.top],
      [bounds.right, bounds.top],
      [bounds.right, bounds.bottom],
      [bounds.left, bounds.bottom]
    ].map(([x, y]) => rotate(x, y))
    const xs = corners.map(([x]) => x)
    const ys = corners.map(([, y]) => y)
    return {
      x: { start: Math.min(...xs), end: Math.max(...xs) },
      y: { start: Math.min(...ys), end: Math.max(...ys) }
    }
  }, [doc.objects, doc.widthMm, doc.heightMm, labelRotation, liveBounds, props.selectedId])

  // Scrollbars can change clientWidth/clientHeight after the paper is laid
  // out. Capture that second measurement before paint so paper and rulers
  // use one stable viewport size and keep the origin aligned.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const sync = () => {
      const next = { w: el.offsetWidth, h: el.offsetHeight, cw: el.clientWidth, ch: el.clientHeight }
      setVpSize((current) => current.w === next.w && current.h === next.h && current.cw === next.cw && current.ch === next.ch ? current : next)
    }
    sync()
    const frame = window.requestAnimationFrame(sync)
    return () => window.cancelAnimationFrame(frame)
  }, [contentH, contentW, stageH, stageW, vpSize.ch, vpSize.cw, vpSize.h, vpSize.w])

  // Preserve the viewport centre in document coordinates while Ctrl+wheel
  // changes the scale. The anchor is consumed after the new stage is laid
  // out, so both centered and scrollable papers zoom around the screen centre.
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current
    const el = scrollRef.current
    if (!anchor || !el || zoomMode !== 'manual') return
    const nextLeft = paperOffsetX + anchor.xMm * pxPerMm - el.clientWidth / 2
    const nextTop = paperOffsetY + anchor.yMm * pxPerMm - el.clientHeight / 2
    el.scrollLeft = Math.max(0, Math.min(nextLeft, el.scrollWidth - el.clientWidth))
    el.scrollTop = Math.max(0, Math.min(nextTop, el.scrollHeight - el.clientHeight))
    zoomAnchorRef.current = null
  }, [paperOffsetX, paperOffsetY, pxPerMm, stageH, stageW, zoom, zoomMode])

  // 普通滚轮交给滚动容器上下滚动；Ctrl + 滚轮或空格 + 滚轮进行缩放。
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !spaceRef.current) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? 1 : -1
      const next = delta > 0
        ? ZOOM_LEVELS.find((z) => z > zoom + 0.001) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
        : [...ZOOM_LEVELS].reverse().find((z) => z < zoom - 0.001) ?? MIN_ZOOM
      if (Math.abs(next - zoom) < 0.000001) return
      zoomAnchorRef.current = {
        xMm: (el.scrollLeft + el.clientWidth / 2 - paperOffsetX) / pxPerMm,
        yMm: (el.scrollTop + el.clientHeight / 2 - paperOffsetY) / pxPerMm
      }
      setZoom(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [paperOffsetX, paperOffsetY, pxPerMm, setZoom, zoom])

  // Fit modes center the paper on an axis when that axis has spare space.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (zoomMode !== 'manual') { el.scrollLeft = 0; el.scrollTop = 0 }
  }, [docKey, zoomMode, zoom])

  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: workspaceBg }}>
      {/* 标尺固定在蓝色工作区（窗口/视口）左上角，不随画布移动 */}
      {showRulers && vpSize.w > 0 && vpSize.h > 0 && (
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 30, pointerEvents: 'none' }}>
          <div
            data-testid="label-rotation-indicator"
            data-rotation={labelRotation}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 20,
              height: 20,
              background: '#fff',
              borderBottom: '1px solid rgba(255,255,255,0.5)',
              borderRight: '1px solid rgba(255,255,255,0.5)',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              pointerEvents: 'auto'
            }}
            onClick={onRotate}
            title={L('版面旋转方向指示（当前 {deg}°）· 单击旋转').replace('{deg}', String(labelRotation))}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" style={{ display: 'block' }}>
              <g
                transform={`rotate(${labelRotation} 12 12)`}
                fill="none"
                stroke="#333"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </g>
            </svg>
          </div>
          {/* 标尺长度取「内容尺寸」与「视口外框」的较大者：`contentW/H` 来自
              `clientWidth/Height`，一旦对面方向出现滚动条就会少掉一条滚动条的厚度，
              标尺便铺不满画面（015 现场反馈）。`vpSize.w/h` 是 offsetWidth/Height，含滚动条。 */}
          <div style={{ position: 'absolute', top: 0, left: 20 }}>
            <Ruler lengthMm={(Math.max(contentW, vpSize.w) + scroll.x) / pxPerMm} pxPerMm={pxPerMm} horizontal offset={scroll.x - paperOffsetX} unit={unit} selection={selectionRange?.x} />
          </div>
          <div style={{ position: 'absolute', top: 20, left: 0 }}>
            <Ruler lengthMm={(Math.max(contentH, vpSize.h) + scroll.y) / pxPerMm} pxPerMm={pxPerMm} horizontal={false} offset={scroll.y - paperOffsetY} unit={unit} selection={selectionRange?.y} />
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        data-testid="workspace-viewport"
        onScroll={(e) => setScroll({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop })}
        onMouseDownCapture={onWorkspaceMouseDown}
        onMouseMove={onPanMove}
        onMouseUp={onPanUp}
         onMouseLeave={() => {
           onPanUp()
           props.onMouseLeave?.()
         }}
        onContextMenu={(ev) => {
          // 画布（标签）内右键由 LabelEditor 精确命中处理后弹出；此处负责标签外工作区/标尺/空白区域
          const t = ev.target as HTMLElement | null
          ev.preventDefault()
          // upperCanvasEl 自己负责画布菜单。这里仍阻止默认浏览器菜单，避免
          // Fabric 事件链或命中到 canvas-container 时弹出系统菜单。
          if (t?.closest('canvas')) return
          props.onContextMenu?.(ev.clientX, ev.clientY, false, 0)
        }}
        style={{ position: 'relative', flex: 1, marginLeft: showRulers ? 20 : 0, marginTop: showRulers ? 20 : 0, minWidth: 0, minHeight: 0, overflow: 'scroll', boxSizing: 'border-box', cursor: spaceRef.current ? 'grab' : 'default' }}
      >
        <div style={{ width: contentW, height: contentH, position: 'relative', boxSizing: 'border-box' }}>
          {/* 模板编辑区（帮助 interface_interface.html 元素 10）：在此区域内完成模板对象的编辑，此区域也是标签被打印出来的区域。
              尺寸即单个标签尺寸，故同时把毫米尺寸带到 DOM 上供回归断言核对。 */}
          <div
            data-testid="template-edit-area"
            data-width-mm={doc.widthMm}
            data-height-mm={doc.heightMm}
            data-draw-cursor={drawingCursor}
            // 帮助 label_object_create.html：「点击工具栏条码或文字等对象工具后鼠标变为对应图标」——
            // 选中绘制类工具时标签编辑区显示十字光标，选取/数据工具回到默认指针。
            style={{ width: stageW, height: stageH, position: 'absolute', left: paperOffsetX, top: paperOffsetY, boxSizing: 'border-box', flexShrink: 0, cursor: drawingCursor }}
          >
            <div
              data-testid="label-board-rotator"
              style={{
                position: 'absolute',
                // 这里的 50% / -50% 相抵后正好是 0（90°/270° 时 stageW/H 与画布宽高互换，
                // 两边的半宽同样相抵），所以旋转容器的落点始终跟着 paperOffset 走。
                // 真正的半像素来自 paperOffsetX/Y，见上方取整。
                left: '50%',
                top: '50%',
                transform: `translate(-50%,-50%) rotate(${labelRotation}deg)`,
                transformOrigin: 'center',
                boxSizing: 'border-box'
              }}
            >
              <div style={{ position: 'relative', boxSizing: 'border-box' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                  <LabelEditor
                    doc={doc}
                    selectedId={props.selectedId}
                    onSelect={props.onSelect}
                    onSync={props.onSync}
                    zoom={zoom}
                    onMouseMove={props.onMouseMove}
                    onCanvasReady={(canvas) => {
                      fabricCanvasRef.current = canvas
                      setCanvasEpoch((epoch) => epoch + 1)
                      props.onCanvasReady?.(canvas)
                    }}
                    showGrid={showGrid}
                    allowScript={props.allowScript}
                    recordIndex={props.recordIndex}
                    datasetName={props.datasetName}
                    keyboardValues={props.keyboardValues}
                    tool={props.tool}
                    createShape={props.createShape}
                    onCreateAt={props.onCreateAt}
                    onToolObjClick={props.onToolObjClick}
                    onCreateRect={props.onCreateRect}
                    onContextMenu={props.onContextMenu}
                    onDoubleClick={props.onDoubleClick}
                    onCtrlDragDuplicate={props.onCtrlDragDuplicate}
                    labelRotation={labelRotation}
                    labelShape={doc.layout?.shape ?? 'rect'}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {selectionBox && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: selectionBox.left - scroll.x + (showRulers ? 20 : 0),
            top: selectionBox.top - scroll.y + (showRulers ? 20 : 0),
            width: selectionBox.width,
            height: selectionBox.height,
            background: 'rgba(30,144,255,0.12)',
            border: '1px solid #1E90FF',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            zIndex: 15
          }}
        />
      )}
      <div
        data-testid="zoom-control"
        data-zoom-mode={zoomMode}
        style={{
          position: 'absolute',
          right: 14,
          bottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid #D8D6CF',
          borderRadius: 20,
          padding: '3px 6px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          zIndex: 20
        }}
      >
        <button type="button" onClick={() => setManualZoom(stepZoom(zoom, -1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#1A1B1C' }} title={L('缩小')}>
          −
        </button>
        <select
          data-testid="zoom-level"
          value={zoom}
          onChange={(e) => setManualZoom(parseFloat(e.target.value))}
          style={{ border: '1px solid #D8D6CF', borderRadius: 6, fontSize: 12, padding: '2px 4px', background: '#fff', color: '#1A1B1C' }}
        >
          {!ZOOM_LEVELS.includes(zoom) && (
            <option value={zoom}>{Math.round(zoom * 100)}%</option>
          )}
          {ZOOM_LEVELS.map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setManualZoom(stepZoom(zoom, 1))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#1A1B1C' }} title={L('放大')}>
          +
        </button>
      </div>
    </div>
  )
}
