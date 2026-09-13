import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import WorkArea from '../src/renderer/src/editor/WorkArea'
import type { LabelDoc } from '../src/renderer/src/types'
import type { Canvas } from 'fabric'

let canvas: Canvas
let update: (patch: Partial<State>) => void
type State = { doc: LabelDoc; zoom: number; mode: 'manual' | 'win' | 'w' | 'h'; rotation: number; rulers: boolean }
let state: State
const initialDoc: LabelDoc = { version: 2, name: 'test', widthMm: 105, heightMm: 55, objects: [] }
function Harness() {
  const [s, set] = useState<State>({ doc: initialDoc, zoom: 1, mode: 'win', rotation: 0, rulers: true })
  state = s
  update = (patch) => set((v) => ({ ...v, ...patch }))
  return <WorkArea doc={s.doc} docKey="test" selectedId={null} onSelect={() => {}} onSync={() => {}} zoom={s.zoom} zoomMode={s.mode}
    setZoom={(zoom, automatic) => set((v) => ({ ...v, zoom, mode: automatic ? v.mode : 'manual' }))}
    showRulers={s.rulers} showGrid={false} onMouseMove={() => {}} labelRotation={s.rotation} onCanvasReady={(c) => { canvas = c }} />
}
function assert(ok: unknown, message: string) { if (!ok) throw new Error(message) }
export async function settle() { await new Promise((r) => setTimeout(r, 180)) }
export async function mount() {
  document.body.style.cssText = 'margin:0;display:flex;height:100vh;overflow:hidden'
  const host = document.createElement('div')
  host.style.cssText = 'display:flex;flex:1;min-width:0;min-height:0'
  document.body.append(host)
  createRoot(host).render(<Harness />)
  await settle()
}
export function geometry() {
  const viewport = document.querySelector('[data-testid="workspace-viewport"]') as HTMLElement
  const rect = canvas.upperCanvasEl.getBoundingClientRect(), vp = viewport.getBoundingClientRect()
  if (state.rulers) {
    const zeroXEl = document.querySelector('[data-testid="ruler-x"] [data-ruler-zero="true"]')
    const zeroYEl = document.querySelector('[data-testid="ruler-y"] [data-ruler-zero="true"]')
    if (zeroXEl) assert(Math.abs(zeroXEl.getBoundingClientRect().left - rect.left) < 2, `paper origin must coincide with horizontal ruler zero: ${zeroXEl.getBoundingClientRect().left} vs ${rect.left}, vp=${vp.left},${vp.width}, client=${viewport.clientWidth}, ruler=${document.querySelector('[data-testid="ruler-x"]')?.getBoundingClientRect().left}`)
    if (zeroYEl) assert(Math.abs(zeroYEl.getBoundingClientRect().top - rect.top) < 2, `paper origin must coincide with vertical ruler zero: ${zeroYEl.getBoundingClientRect().top} vs ${rect.top}`)
  }
  assert(rect.left - vp.left >= 10 && rect.top - vp.top >= 10, `paper needs a breathing room: paper ${rect.left - vp.left},${rect.top - vp.top}`)
  if (viewport.clientWidth - rect.width > 24) assert(Math.abs((rect.left + rect.width / 2) - (vp.left + viewport.clientWidth / 2)) < 2, `short horizontal axis must be centered: ${rect.left},${rect.width} vs ${vp.left},${viewport.clientWidth}`)
  if (viewport.clientHeight - rect.height > 24) assert(Math.abs((rect.top + rect.height / 2) - (vp.top + viewport.clientHeight / 2)) < 2, `short vertical axis must be centered: ${rect.top},${rect.height} vs ${vp.top},${viewport.clientHeight}`)
  assert(Math.abs(canvas.getZoom() - state.zoom) < 1e-6, 'Fabric viewport zoom must match React zoom')
  canvas.renderAll()
  const lower = canvas.lowerCanvasEl
  const pixel = canvas.getContext().getImageData(Math.floor(lower.width * 0.75), Math.floor(lower.height * 0.75), 1, 1).data
  assert(pixel[3] === 255, `paper must paint its full backing store, not just resize the DOM: ${lower.width}x${lower.height}, pixel ${pixel}, transform ${canvas.getContext().getTransform().a}, DPR ${window.devicePixelRatio}`)
  return { width: rect.width, height: rect.height, zoom: state.zoom }
}
export async function redraw() {
  update({ doc: { ...state.doc, name: 'edited' } }); await settle(); geometry()
  update({ doc: { ...state.doc, widthMm: 32, heightMm: 70 } }); await settle(); geometry()
  update({ rotation: 90 }); await settle(); geometry()
  update({ rulers: false }); await settle(); geometry()
  update({ rulers: true, rotation: 0 }); await settle(); geometry()
}
export async function fitModes() {
  update({ mode: 'w' }); await settle()
  const viewport = document.querySelector('[data-testid="workspace-viewport"]') as HTMLElement
  const rectW = canvas.upperCanvasEl.getBoundingClientRect(), vp = viewport.getBoundingClientRect()
  assert(Math.abs(rectW.left - vp.left - 12) < 2, 'fit width must leave the long axis gutter')
  update({ mode: 'h' }); await settle()
  const rectH = canvas.upperCanvasEl.getBoundingClientRect()
  assert(Math.abs(rectH.top - vp.top - 12) < 2, 'fit height must leave the long axis gutter')
  update({ mode: 'win' }); await settle()
  assert(/-\d/.test(document.querySelector('[data-testid="ruler-x"]')?.textContent ?? ''), 'ruler must expose negative coordinates before paper origin')
}
export async function manual() {
  const viewport = document.querySelector('[data-testid="workspace-viewport"]')!
  const before = state.zoom
  viewport.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }))
  await settle(); assert(state.zoom === before && state.mode === 'win', 'ordinary wheel must not zoom or cancel fit')
  const beforeRect = canvas.upperCanvasEl.getBoundingClientRect(), vp = viewport.getBoundingClientRect()
  viewport.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true }))
  await settle(); assert(state.zoom !== before && state.mode === 'manual', 'Ctrl wheel must set manual zoom')
  const afterRect = canvas.upperCanvasEl.getBoundingClientRect(), afterVp = viewport.getBoundingClientRect()
  const centerDx = (afterRect.left + afterRect.width / 2) - (afterVp.left + viewport.clientWidth / 2)
  const centerDy = (afterRect.top + afterRect.height / 2) - (afterVp.top + viewport.clientHeight / 2)
  assert(Math.abs(centerDx) < 4 && Math.abs(centerDy) < 4,
    `Ctrl wheel must zoom around viewport centre: before ${beforeRect.left},${beforeRect.top}, after ${afterRect.left},${afterRect.top}, viewport ${afterVp.width}x${afterVp.height}, delta ${centerDx},${centerDy}`)
  return state.zoom
}
export function zoom() { return state.zoom }
export async function fit() { update({ mode: 'win' }); await settle(); return geometry() }
export async function paper() {
  update({ doc: { ...state.doc, widthMm: 120, heightMm: 120, layout: { rows: 1, cols: 1, rowGapMm: 0, colGapMm: 0, shape: 'disc', innerDiameterMm: 40 } } })
  await settle(); geometry()
  const clip = canvas.wrapperEl.style.clipPath
  assert(clip.includes('paper-clip-'), `editor must use a real SVG evenodd shape clipping path: ${clip}`)
  assert(document.querySelector('[data-testid="paper-outline"] > path')?.getAttribute('vector-effect') === 'non-scaling-stroke', 'paper hairline must not grow when zoomed')
  assert(canvas.getObjects().every((o: any) => o.dataId === '__bg__'), 'editor paper edge must not be a document object')
}
