import { useEffect, useState } from 'react'
import { paperPath, type PaperGeometry } from '../../../shared/domain/paper'
import PaperFields from './PaperFields'

export interface LabelPreset {
  name: string
  w: number
  h: number
  paper?: PaperGeometry
  sheet?: { w: number; h: number; perRow: number; perCol: number; pagesPerBox?: number }
}

export interface LabelFormatSelection {
  rows: number
  cols: number
  pagesPerBox?: number
  formatKind: 'preset' | 'custom'
  pageWidthMm?: number
  pageHeightMm?: number
}

const PRESETS: LabelPreset[] = [
  { name: '[608053] 100mm x 70mm 圆角8枚/页 20页/盒', w: 100, h: 70, paper: { shape: 'roundRect' }, sheet: { w: 210, h: 297, perRow: 2, perCol: 4, pagesPerBox: 20 } },
  { name: '100mm x 100mm 单枚/连续 500张/卷', w: 100, h: 100 },
  { name: '80mm x 60mm 直角/连续 1000张/卷', w: 80, h: 60 },
  { name: '70mm x 50mm 直角/连续 1000张/卷', w: 70, h: 50 },
  { name: '60mm x 40mm 直角/连续 2000张/卷', w: 60, h: 40 },
  { name: '50mm x 30mm 直角/连续 3000张/卷', w: 50, h: 30 },
  { name: '40mm x 30mm 直角/连续 3000张/卷', w: 40, h: 30 },
  { name: '30mm x 20mm 直角/连续 5000张/卷', w: 30, h: 20 },
  { name: '光盘标签 120mm / 中心孔 15mm（可调整）', w: 120, h: 120, paper: { shape: 'disc', innerDiameterMm: 15 } }
]

const BRANDS = ['京成云马标签（平张标签）', '京成云马标签（卷装标签）', '通用标签纸', '自定义品牌']
const TYPES = ['云马优质打印纸标签', '热敏标签纸', '铜版纸标签', '合成纸标签', 'PET 标签', '无']

interface Props {
  onSelect: (w: number, h: number, paper?: PaperGeometry, printerName?: string, format?: LabelFormatSelection) => void
  onClose: () => void
  defaultW?: number
  defaultH?: number
  defaultShape?: PaperGeometry['shape']
}

export default function NewLabelDialog({ onSelect, onClose, defaultW = 105, defaultH = 55, defaultShape = 'rect' }: Props) {
  const [paper, setPaper] = useState<PaperGeometry>(PRESETS[0].paper ?? { shape: defaultShape })
  const [printer, setPrinter] = useState('')
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string }>>([])
  const [brand, setBrand] = useState(BRANDS[0])
  const [type, setType] = useState(TYPES[0])
  const [presetIdx, setPresetIdx] = useState(0)
  const [custom, setCustom] = useState(false)
  const [cw, setCw] = useState(String(defaultW))
  const [ch, setCh] = useState(String(defaultH))

  useEffect(() => {
    window.maxlabel
      .listPrinters()
      .then((r) => {
        const items = (r.printers ?? []).map((p) => ({ name: p.name, displayName: p.displayName || p.name }))
        setPrinters(items)
        if (items.length > 0) setPrinter(items[0].name)
      })
      .catch(() => {})
  }, [])

  const sheet = custom ? undefined : PRESETS[presetIdx]?.sheet
  const previewW = Math.max(1, custom ? Number(cw) || 1 : PRESETS[presetIdx].w)
  const previewH = Math.max(1, custom ? Number(ch) || 1 : PRESETS[presetIdx].h)
  const confirm = () => {
    let w: number
    let h: number
    if (custom) {
      w = parseFloat(cw)
      h = parseFloat(ch)
    } else {
      w = PRESETS[presetIdx].w
      h = PRESETS[presetIdx].h
    }
    if (!w || !h || w < 5 || h < 5) return
    const format = {
      rows: sheet?.perCol ?? 1,
      cols: sheet?.perRow ?? 1,
      formatKind: custom ? 'custom' as const : 'preset' as const,
      ...(sheet?.pagesPerBox ? { pagesPerBox: sheet.pagesPerBox } : {}),
      ...(sheet ? { pageWidthMm: sheet.w, pageHeightMm: sheet.h } : {})
    }
    onSelect(w, h, paper, printer || undefined, format)
  }

  const field = { padding: '7px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, background: '#fff', color: '#1A1B1C', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 620, maxWidth: '94vw', boxShadow: '0 16px 60px rgba(0,0,0,0.3)', padding: 0, overflow: 'hidden' }}>
        <div data-testid="new-label-dialog" style={{ padding: '12px 16px', borderBottom: '1px solid #ECEBE6', fontSize: 15, fontWeight: 600, color: '#1A1B1C' }}>选择标签格式</div>
        <div style={{ padding: 16, display: 'flex', gap: 20 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
              {custom ? '自定义标签' : PRESETS[presetIdx].name}
            </div>
            <div style={{ position: 'relative', width: 190, height: 260, border: '1px solid #D5D4CD', background: '#FAFAF7', borderRadius: 6, overflow: 'hidden' }}>
              <svg width="100%" height="100%" viewBox={`0 0 ${(previewW + 2) * (sheet?.perRow ?? 1)} ${(previewH + 2) * (sheet?.perCol ?? 1)}`} style={{ background: '#22BDED' }}>
                {Array.from({ length: (sheet?.perRow ?? 1) * (sheet?.perCol ?? 1) }, (_, i) => <path key={i}
                  transform={`translate(${1 + (i % (sheet?.perRow ?? 1)) * (previewW + 2)} ${1 + Math.floor(i / (sheet?.perRow ?? 1)) * (previewH + 2)})`}
                  d={paperPath(previewW, previewH, paper)} fill="#fff" fillRule="evenodd" stroke="#000" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />)}
              </svg>
            </div>
            <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 6 }}>
              纸张: {sheet ? `${sheet.w}毫米 × ${sheet.h}毫米` : '连续纸 / 卷装'}
            </div>
            <div style={{ fontSize: 11.5, color: '#6B7280' }}>
              标签: {previewW.toFixed(2)}毫米 × {previewH.toFixed(2)}毫米
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12.5, color: '#1A1B1C' }}>
              打印机(P):
              <select value={printer} onChange={(e) => setPrinter(e.target.value)} style={{ ...field, marginTop: 4 }}>
                {printers.length === 0 && <option value="">（未检测到打印机）</option>}
                {printers.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12.5, color: '#1A1B1C' }}>
              标签品牌(B):
              <select value={brand} onChange={(e) => setBrand(e.target.value)} style={{ ...field, marginTop: 4 }}>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12.5, color: '#1A1B1C' }}>
              标签类型(G):
              <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...field, marginTop: 4 }}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 12.5, color: '#1A1B1C' }}>
              标签名称(L):
              <select
                value={custom ? '__custom__' : String(presetIdx)}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustom(true)
                  } else {
                    setCustom(false)
                    setPresetIdx(parseInt(e.target.value, 10))
                    setPaper(PRESETS[parseInt(e.target.value, 10)].paper ?? { shape: defaultShape })
                  }
                }}
                style={{ ...field, marginTop: 4 }}
              >
                {PRESETS.map((p, i) => (
                  <option key={i} value={i}>
                    {p.name}
                  </option>
                ))}
                <option value="__custom__">自定义…</option>
              </select>
            </label>
            <PaperFields value={paper} width={custom ? Number(cw) : PRESETS[presetIdx].w} height={custom ? Number(ch) : PRESETS[presetIdx].h} onChange={setPaper} />
            {custom && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: '#1A1B1C' }}>
                宽
                <input data-testid="new-label-custom-width" type="number" min={5} max={500} value={cw} onChange={(e) => setCw(e.target.value)} style={{ ...field, width: 70 }} />
                mm × 高
                <input data-testid="new-label-custom-height" type="number" min={5} max={500} value={ch} onChange={(e) => setCh(e.target.value)} style={{ ...field, width: 70 }} />
                mm
              </div>
            )}
            <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>提示：如列表中没有尺寸适合的标签格式，请选择"自定义"，自行设置标签尺寸。</div>
          </div>
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #ECEBE6', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" data-testid="new-label-select" onClick={confirm} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            选择
          </button>
          <button type="button" data-testid="new-label-custom" onClick={() => setCustom(true)} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            自定义
          </button>
          <button type="button" data-testid="new-label-cancel" onClick={onClose} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
