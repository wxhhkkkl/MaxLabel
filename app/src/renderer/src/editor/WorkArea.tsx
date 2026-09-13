import { useEffect, useMemo, useRef, useState } from 'react'
import * as fabric from 'fabric'
import type { LabelDoc, LabelObject } from '../types'
import { objectBounds } from '../features/editor/operations'
import LabelEditor from './LabelEditor'

export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4]
const FIT_GUTTER_PX = 12

interface SelectionBox {
  left: number
  top: number
  width: number
  height: number
}

interface ClientRectLike {
  left: number
  top: number
  right: number
  bottom: number
}

function clientRectFromPoints(startX: number, startY: number, endX: number, endY: number): ClientRectLike {
  return {
    left: Math.min(startX, endX),
    top: Math.min(startY, endY),
    right: Math.max(startX, endX),
    bottom: Math.max(startY, endY)
  }
}

function rectIntersects(a: ClientRectLike, b: ClientRectLike): boolean {
  return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top
}

function documentPointToClient(
  xMm: number,
  yMm: number,
  doc: LabelDoc,
  canvasRect: DOMRect,
  zoom: number,
  rotation: number
): { x: number; y: number } {
  const sceneWidth = doc.widthMm * 10 * zoom
  const sceneHeight = doc.heightMm * 10 * zoom
  const dx = xMm * 10 * zoom - sceneWidth / 2
  const dy = yMm * 10 * zoom - sceneHeight / 2
  const radians = (rotation * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return {
    x: canvasRect.left + canvasRect.width / 2 + dx * cos - dy * sin,
    y: canvasRect.top + canvasRect.height / 2 + dx * sin + dy * cos
  }
}

function objectClientBounds(object: LabelObject, doc: LabelDoc, canvasRect: DOMRect, zoom: number, rotation: number): ClientRectLike {
  const bounds = objectBounds(object)
  const points = [
    documentPointToClient(bounds.left, bounds.top, doc, canvasRect, zoom, rotation),
    documentPointToClient(bounds.right, bounds.top, doc, canvasRect, zoom, rotation),
    documentPointToClient(bounds.right, bounds.bottom, doc, canvasRect, zoom, rotation),
    documentPointToClient(bounds.left, bounds.bottom, doc, canvasRect, zoom, rotation)
  ]
  return {
    left: Math.min(...points.map((point) => point.x)),
    top: Math.min(...points.map((point) => point.y)),
    right: Math.max(...points.map((point) => point.x)),
    bottom: Math.max(...points.map((point) => point.y))
  }
}

interface Props {
  doc: LabelDoc
  selectedId: string | null
  onSelect: (id: string | null) => void
  onSync: (objs: LabelObject[]) => void
  zoom: number
  setZoom: (z: number, automatic?: boolean) => void
  zoomMode?: 'manual' | 'win' | 'w' | 'h'
  onMouseMove: (x: number, y: number) => void
  showRulers: boolean
  showGrid: boolean
  allowScript?: boolean
  onCanvasReady?: (canvas: fabric.Canvas) => void
  tool?: string
  onCreateAt?: (type: string, mmX: number, mmY: number) => void
  onToolObjClick?: (objId: string) => void
  onCreateRect?: (type: string, mmX: number, mmY: number, mmW: number, mmH: number) => void
  onContextMenu?: (screenX: number, screenY: number, hasSelection: boolean, selectionCount: number) => void
  onDoubleClick?: (objId: string) => void
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

function Ruler({ lengthMm, pxPerMm, horizontal, offset = 0, unit = 'mm' }: { lengthMm: number; pxPerMm: number; horizontal: boolean; offset?: number; unit?: 'mm' | 'inch' }) {
  const ticks = useMemo(() => {
    const out: Array<{ pos: number; label: string; major: boolean }> = []
    if (unit === 'inch') {
      // 英寸标尺：0.25" 为次刻度，0.5"/1" 为主刻度
      for (let i = 0; i * 6.35 <= lengthMm + 1e-6; i++) {
        const mm = i * 6.35 // 0.25 inch
        out.push({ pos: mm, label: `${i % 4 === 0 ? (i / 4).toFixed(0) : (i / 4).toFixed(2)}"`, major: i % 2 === 0 })
      }
    } else {
      for (let mm = 0; mm <= lengthMm; mm += 1) {
        if (mm % 10 === 0 || mm % 5 === 0) out.push({ pos: mm, label: String(mm), major: mm % 10 === 0 })
      }
    }
    return out
  }, [lengthMm, unit])

  const size = Math.round(lengthMm * pxPerMm)
  return (
    <div
      data-testid={horizontal ? 'ruler-x' : 'ruler-y'}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: '#fff',
        ...(horizontal ? { width: size, height: 20 } : { width: 20, height: size })
      }}
    >
      {ticks.map((t, idx) =>
        horizontal ? (
          <div key={idx} data-ruler-zero={idx === 0 ? 'true' : undefined} style={{ position: 'absolute', left: Math.round(t.pos * pxPerMm) - offset, top: 0, width: 1, height: t.major ? 10 : 5, background: '#555' }}>
            {t.major && (
              <span style={{ position: 'absolute', left: 2, top: 10, fontSize: 9, color: '#333', whiteSpace: 'nowrap' }}>{t.label}</span>
            )}
          </div>
        ) : (
          <div key={idx} data-ruler-zero={idx === 0 ? 'true' : undefined} style={{ position: 'absolute', top: Math.round(t.pos * pxPerMm) - offset, left: 0, height: 1, width: t.major ? 10 : 5, background: '#555' }}>
            {t.major && (
              <span style={{ position: 'absolute', left: 10, top: 1, fontSize: 9, color: '#333' }}>{t.label}</span>
            )}
          </div>
        )
      )}
    </div>
  )
}

export default function WorkArea(props: Props) {
  const { doc, zoom, setZoom, zoomMode = 'win', showRulers, showGrid, labelRotation = 0, onRotate, workspaceBg = '#22BDED', unit = 'mm', docKey } = props
  const pxPerMm = 10 * zoom
  const scrollRef = useRef<HTMLDivElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const spaceRef = useRef(false)
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null)
  const selectionDragRef = useRef<{ startX: number; startY: number } | null>(null)
  const selectionCleanupRef = useRef<(() => void) | null>(null)
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null)
  const [scroll, setScroll] = useState({ x: 0, y: 0 })

  // 工作区（视口）尺寸：标尺固定在左上角，按视口宽度/高度铺满
  const [vpSize, setVpSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Measure the stable viewport box, not clientWidth while stale oversized
    // paper temporarily introduces scrollbars during a native-window resize.
    const update = () => setVpSize({ w: el.offsetWidth, h: el.offsetHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el, { box: 'border-box' })
    return () => ro.disconnect()
  }, [showRulers])

  // Fit is an explicit per-document mode, not inferred from asynchronous zoom updates.
  useEffect(() => {
    if (vpSize.w === 0 || vpSize.h === 0) return
    if (zoomMode === 'manual') return
    const sideways = labelRotation % 180 !== 0
    const el = scrollRef.current
    const availableW = Math.max(1, (el?.clientWidth || vpSize.w) - FIT_GUTTER_PX * 2)
    const availableH = Math.max(1, (el?.clientHeight || vpSize.h) - FIT_GUTTER_PX * 2)
    const fitW = availableW / ((sideways ? doc.heightMm : doc.widthMm) * 10)
    const fitH = availableH / ((sideways ? doc.widthMm : doc.heightMm) * 10)
    const nextZoom = zoomMode === 'w' ? fitW : zoomMode === 'h' ? fitH : Math.min(fitW, fitH)
    if (Math.abs(nextZoom - zoom) > 0.000001) setZoom(nextZoom, true)
  }, [doc.widthMm, doc.heightMm, labelRotation, zoomMode, vpSize.h, vpSize.w, setZoom, zoom])

  // 普通滚轮交给滚动容器上下滚动；只有 Ctrl + 滚轮才进行缩放。
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const delta = e.deltaY < 0 ? 1 : -1
      if (delta > 0) {
        const next = ZOOM_LEVELS.find((z) => z > zoom + 0.001) ?? ZOOM_LEVELS[ZOOM_LEVELS.length - 1]
        setZoom(next)
      } else {
        const next = [...ZOOM_LEVELS].reverse().find((z) => z < zoom - 0.001) ?? ZOOM_LEVELS[0]
        setZoom(next)
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom, setZoom])

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

  const onPanDown = (e: React.MouseEvent) => {
    if (!spaceRef.current || e.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    panRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }
    el.style.cursor = 'grabbing'
  }
  const onPanMove = (e: React.MouseEvent) => {
    const pan = panRef.current
    const el = scrollRef.current
    if (!pan || !el) return
    el.scrollLeft = pan.sl - (e.clientX - pan.x)
    el.scrollTop = pan.st - (e.clientY - pan.y)
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
    selectionCleanupRef.current?.()
    selectionCleanupRef.current = null
  }, [])

  const isSide = labelRotation === 90 || labelRotation === 270
  const innerW = Math.round(doc.widthMm * pxPerMm)
  const innerH = Math.round(doc.heightMm * pxPerMm)
  // 旋转后占用的逻辑尺寸（旋转容器 width/height 交换）
  const stageW = isSide ? innerH : innerW
  const stageH = isSide ? innerW : innerH
  const visibleW = scrollRef.current?.clientWidth || vpSize.w
  const visibleH = scrollRef.current?.clientHeight || vpSize.h
  // Fit modes center the short axis while keeping a small breathing room on
  // the long axis. Manual zoom keeps the paper anchored with the same gutter.
  const contentW = Math.max(visibleW, stageW + FIT_GUTTER_PX * 2)
  const contentH = Math.max(visibleH, stageH + FIT_GUTTER_PX * 2)
  const paperOffsetX = zoomMode === 'manual' ? FIT_GUTTER_PX : Math.max(FIT_GUTTER_PX, (visibleW - stageW) / 2)
  const paperOffsetY = zoomMode === 'manual' ? FIT_GUTTER_PX : Math.max(FIT_GUTTER_PX, (visibleH - stageH) / 2)

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
            title={`版面旋转方向指示（当前 ${labelRotation}°）· 单击旋转`}
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
          <div style={{ position: 'absolute', top: 0, left: 20 }}>
            <Ruler lengthMm={(contentW + scroll.x) / pxPerMm} pxPerMm={pxPerMm} horizontal offset={scroll.x - paperOffsetX} unit={unit} />
          </div>
          <div style={{ position: 'absolute', top: 20, left: 0 }}>
            <Ruler lengthMm={(contentH + scroll.y) / pxPerMm} pxPerMm={pxPerMm} horizontal={false} offset={scroll.y - paperOffsetY} unit={unit} />
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        data-testid="workspace-viewport"
        onScroll={(e) => setScroll({ x: e.currentTarget.scrollLeft, y: e.currentTarget.scrollTop })}
        onMouseDown={onWorkspaceMouseDown}
        onMouseMove={onPanMove}
        onMouseUp={onPanUp}
        onMouseLeave={onPanUp}
        onContextMenu={(ev) => {
          // 画布（标签）内右键由 LabelEditor 精确命中处理后弹出；此处负责标签外工作区/标尺/空白区域
          const t = ev.target as HTMLElement | null
          if (t && t.tagName === 'CANVAS') return
          ev.preventDefault()
          props.onContextMenu?.(ev.clientX, ev.clientY, false, 0)
        }}
        style={{ position: 'relative', flex: 1, marginLeft: showRulers ? 20 : 0, marginTop: showRulers ? 20 : 0, minWidth: 0, minHeight: 0, overflow: 'auto', boxSizing: 'border-box', cursor: spaceRef.current ? 'grab' : 'default' }}
      >
        <div style={{ width: contentW, height: contentH, position: 'relative', boxSizing: 'border-box' }}>
          <div style={{ width: stageW, height: stageH, position: 'absolute', left: paperOffsetX, top: paperOffsetY, boxSizing: 'border-box', flexShrink: 0 }}>
            <div
              style={{
                position: 'absolute',
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
                      props.onCanvasReady?.(canvas)
                    }}
                    showGrid={showGrid}
                    allowScript={props.allowScript}
                    tool={props.tool}
                    onCreateAt={props.onCreateAt}
                    onToolObjClick={props.onToolObjClick}
                    onCreateRect={props.onCreateRect}
                    onContextMenu={props.onContextMenu}
                    onDoubleClick={props.onDoubleClick}
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
        <button type="button" onClick={() => setManualZoom(Math.max(0.25, +(zoom - 0.25).toFixed(2)))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#1A1B1C' }} title="缩小">
          −
        </button>
        <select
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
        <button type="button" onClick={() => setManualZoom(Math.min(4, +(zoom + 0.25).toFixed(2)))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#1A1B1C' }} title="放大">
          +
        </button>
      </div>
    </div>
  )
}
