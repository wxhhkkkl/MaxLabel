import { useEffect, useMemo, useRef, useState } from 'react'
import type * as fabric from 'fabric'
import type { LabelDoc, LabelObject } from '../types'
import { orientedLabelSize } from '../../../shared/print/layout'
import LabelEditor from './LabelEditor'

export const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2, 3, 4]

interface Props {
  doc: LabelDoc
  selectedId: string | null
  onSelect: (id: string | null) => void
  onSync: (objs: LabelObject[]) => void
  zoom: number
  setZoom: (z: number) => void
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

function Ruler({ lengthMm, pxPerMm, horizontal, bg = '#22BDED', unit = 'mm' }: { lengthMm: number; pxPerMm: number; horizontal: boolean; bg?: string; unit?: 'mm' | 'inch' }) {
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
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: bg,
        ...(horizontal ? { width: size, height: 20 } : { width: 20, height: size })
      }}
    >
      {ticks.map((t, idx) =>
        horizontal ? (
          <div key={idx} style={{ position: 'absolute', left: Math.round(t.pos * pxPerMm) - 1, top: 0, width: 1, height: t.major ? 10 : 5, background: 'rgba(255,255,255,0.75)' }}>
            {t.major && (
              <span style={{ position: 'absolute', left: 2, top: 10, fontSize: 9, color: 'rgba(255,255,255,0.9)', whiteSpace: 'nowrap' }}>{t.label}</span>
            )}
          </div>
        ) : (
          <div key={idx} style={{ position: 'absolute', top: Math.round(t.pos * pxPerMm) - 1, left: 0, height: 1, width: t.major ? 10 : 5, background: 'rgba(255,255,255,0.75)' }}>
            {t.major && (
              <span style={{ position: 'absolute', left: 10, top: 1, fontSize: 9, color: 'rgba(255,255,255,0.9)' }}>{t.label}</span>
            )}
          </div>
        )
      )}
    </div>
  )
}

export default function WorkArea(props: Props) {
  const { doc, zoom, setZoom, showRulers, showGrid, labelRotation = 0, onRotate, workspaceBg = '#22BDED', unit = 'mm', docKey } = props
  const pxPerMm = 10 * zoom
  const scrollRef = useRef<HTMLDivElement>(null)
  const spaceRef = useRef(false)
  const panRef = useRef<{ x: number; y: number; sl: number; st: number } | null>(null)
  /** 已执行过自动适应窗口的标签页 key，避免用户手动缩放后被重置 */
  const fittedKeyRef = useRef<string | number | null>(null)

  // 工作区（视口）尺寸：标尺固定在左上角，按视口宽度/高度铺满
  const [vpSize, setVpSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => setVpSize({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 打开新文档/切换标签时自动"适应窗口"：按视口尺寸计算合适缩放，使画布完整可见
  useEffect(() => {
    if (docKey === undefined || docKey === null) return
    if (vpSize.w === 0 || vpSize.h === 0) return
    if (fittedKeyRef.current === docKey) return
    fittedKeyRef.current = docKey
    const margin = 48
    const label = orientedLabelSize(doc)
    const fitW = (vpSize.w - margin) / (label.widthMm * 10)
    const fitH = (vpSize.h - margin) / (label.heightMm * 10)
    const z = Math.max(0.25, Math.min(fitW, fitH, 1)) // 不超过 100%
    setZoom(Math.round(z * 100) / 100)
  }, [docKey, vpSize.w, vpSize.h, doc.widthMm, doc.heightMm, doc.orientation, setZoom])

  // 鼠标滚轮缩放（以 ZOOM_LEVELS 步进）
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
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

  const isSide = labelRotation === 90 || labelRotation === 270
  const innerW = doc.widthMm * pxPerMm + (showRulers ? 20 : 0) + 24
  const innerH = doc.heightMm * pxPerMm + (showRulers ? 20 : 0) + 24
  // 旋转后占用的逻辑尺寸（旋转容器 width/height 交换）
  const stageW = isSide ? innerH : innerW
  const stageH = isSide ? innerW : innerH

  // 画布默认居中：挂载/尺寸/缩放变化时，滚动到内容中心
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollLeft = Math.max(0, (el.scrollWidth - el.clientWidth) / 2)
    el.scrollTop = Math.max(0, (el.scrollHeight - el.clientHeight) / 2)
  }, [stageW, stageH, vpSize.w, vpSize.h, zoom])

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
              background: workspaceBg,
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
                stroke="rgba(255,255,255,0.95)"
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
            <Ruler lengthMm={vpSize.w / pxPerMm} pxPerMm={pxPerMm} horizontal bg={workspaceBg} unit={unit} />
          </div>
          <div style={{ position: 'absolute', top: 20, left: 0 }}>
            <Ruler lengthMm={vpSize.h / pxPerMm} pxPerMm={pxPerMm} horizontal={false} bg={workspaceBg} unit={unit} />
          </div>
        </div>
      )}
      <div
        ref={scrollRef}
        onMouseDown={onPanDown}
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
        style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', boxSizing: 'border-box', cursor: spaceRef.current ? 'grab' : 'default' }}
      >
        <div style={{ minWidth: '100%', minHeight: '100%', display: 'flex', padding: 24, boxSizing: 'border-box' }}>
          <div style={{ width: stageW, height: stageH, position: 'relative', boxSizing: 'border-box', flexShrink: 0, margin: 'auto' }}>
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
                    onCanvasReady={props.onCanvasReady}
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
        <button type="button" onClick={() => setZoom(Math.max(0.5, +(zoom - 0.25).toFixed(2)))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#1A1B1C' }} title="缩小">
          −
        </button>
        <select
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          style={{ border: '1px solid #D8D6CF', borderRadius: 6, fontSize: 12, padding: '2px 4px', background: '#fff', color: '#1A1B1C' }}
        >
          {ZOOM_LEVELS.map((z) => (
            <option key={z} value={z}>
              {Math.round(z * 100)}%
            </option>
          ))}
        </select>
        <button type="button" onClick={() => setZoom(Math.min(4, +(zoom + 0.25).toFixed(2)))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#1A1B1C' }} title="放大">
          +
        </button>
      </div>
    </div>
  )
}
