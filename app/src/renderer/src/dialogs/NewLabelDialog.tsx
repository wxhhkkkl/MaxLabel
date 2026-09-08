import { useEffect, useState } from 'react'

export interface LabelPreset {
  name: string
  w: number
  h: number
  sheet?: { w: number; h: number; perRow: number; perCol: number }
}

const PRESETS: LabelPreset[] = [
  { name: '[608059] 105mm x 55mm 直角10枚/页 20页/盒', w: 105, h: 55, sheet: { w: 210, h: 297, perRow: 2, perCol: 5 } },
  { name: '100mm x 100mm 单枚/连续 500张/卷', w: 100, h: 100 },
  { name: '80mm x 60mm 直角/连续 1000张/卷', w: 80, h: 60 },
  { name: '70mm x 50mm 直角/连续 1000张/卷', w: 70, h: 50 },
  { name: '60mm x 40mm 直角/连续 2000张/卷', w: 60, h: 40 },
  { name: '50mm x 30mm 直角/连续 3000张/卷', w: 50, h: 30 },
  { name: '40mm x 30mm 直角/连续 3000张/卷', w: 40, h: 30 },
  { name: '30mm x 20mm 直角/连续 5000张/卷', w: 30, h: 20 }
]

const BRANDS = ['京成云马标签（平张标签）', '京成云马标签（卷装标签）', '通用标签纸', '自定义品牌']
const TYPES = ['云马优质打印纸标签', '热敏标签纸', '铜版纸标签', '合成纸标签', 'PET 标签', '无']

interface Props {
  onSelect: (w: number, h: number) => void
  onClose: () => void
  defaultW?: number
  defaultH?: number
}

export default function NewLabelDialog({ onSelect, onClose, defaultW = 105, defaultH = 55 }: Props) {
  const [printer, setPrinter] = useState('')
  const [printers, setPrinters] = useState<string[]>([])
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
        const names = (r.printers ?? []).map((p) => p.displayName || p.name)
        setPrinters(names)
        if (names.length > 0) setPrinter(names[0])
      })
      .catch(() => {})
  }, [])

  const sheet = PRESETS[presetIdx]?.sheet
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
    onSelect(w, h)
  }

  const field = { padding: '7px 8px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, background: '#fff', color: '#1A1B1C', width: '100%', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 620, maxWidth: '94vw', boxShadow: '0 16px 60px rgba(0,0,0,0.3)', padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #ECEBE6', fontSize: 15, fontWeight: 600, color: '#1A1B1C' }}>选择标签格式</div>
        <div style={{ padding: 16, display: 'flex', gap: 20 }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>
              {PRESETS[presetIdx].name}
            </div>
            <div style={{ position: 'relative', width: 190, height: 260, border: '1px solid #D5D4CD', background: '#FAFAF7', borderRadius: 6, overflow: 'hidden' }}>
              {sheet ? (
                (() => {
                  const rows: React.ReactNode[] = []
                  for (let j = 0; j < sheet.perCol; j++) {
                    for (let i = 0; i < sheet.perRow; i++) {
                      rows.push(
                        <div
                          key={`${i}-${j}`}
                          style={{
                            position: 'absolute',
                            left: 6 + (i * (190 - 12)) / sheet.perRow,
                            top: 6 + (j * (260 - 12)) / sheet.perCol,
                            width: (190 - 12) / sheet.perRow - 3,
                            height: (260 - 12) / sheet.perCol - 3,
                            border: '1px dashed #8FB9D8',
                            background: '#fff',
                            boxSizing: 'border-box',
                            borderRadius: 2
                          }}
                        />
                      )
                    }
                  }
                  return rows
                })()
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    left: '8%',
                    top: '8%',
                    width: '84%',
                    height: '84%',
                    border: '2px dashed #2E6E93',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    color: '#5B8FF9'
                  }}
                >
                  连续标签
                </div>
              )}
            </div>
            <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 6 }}>
              纸张: {sheet ? `${sheet.w}毫米 × ${sheet.h}毫米` : '连续纸 / 卷装'}
            </div>
            <div style={{ fontSize: 11.5, color: '#6B7280' }}>
              标签: {PRESETS[presetIdx].w.toFixed(2)}毫米 × {PRESETS[presetIdx].h.toFixed(2)}毫米
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12.5, color: '#1A1B1C' }}>
              打印机(P):
              <select value={printer} onChange={(e) => setPrinter(e.target.value)} style={{ ...field, marginTop: 4 }}>
                {printers.length === 0 && <option value="">（未检测到打印机）</option>}
                {printers.map((p) => (
                  <option key={p} value={p}>
                    {p}
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
            {custom && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, color: '#1A1B1C' }}>
                宽
                <input type="number" min={5} max={500} value={cw} onChange={(e) => setCw(e.target.value)} style={{ ...field, width: 70 }} />
                mm × 高
                <input type="number" min={5} max={500} value={ch} onChange={(e) => setCh(e.target.value)} style={{ ...field, width: 70 }} />
                mm
              </div>
            )}
            <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>提示：如列表中没有尺寸适合的标签格式，请选择"自定义"，自行设置标签尺寸。</div>
          </div>
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #ECEBE6', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={confirm} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            选择
          </button>
          <button type="button" onClick={() => setCustom(true)} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            自定义
          </button>
          <button type="button" onClick={onClose} style={{ padding: '7px 18px', borderRadius: 7, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
