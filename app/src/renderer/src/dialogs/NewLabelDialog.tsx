import { useEffect, useMemo, useState } from 'react'
import { paperPath, type PaperGeometry } from '../../../shared/domain/paper'
import { LABEL_FORMATS, type LabelFormatRecord } from '../../../shared/domain/labelFormats.generated'

export type LabelPreset = LabelFormatRecord

export interface LabelFormatSelection {
  rows: number
  cols: number
  pagesPerBox?: number
  formatKind: 'preset' | 'custom'
  formatCode?: string
  pageWidthMm?: number
  pageHeightMm?: number
}

interface Props {
  onSelect: (w: number, h: number, paper?: PaperGeometry, printerName?: string, format?: LabelFormatSelection) => void
  onClose: () => void
  onInstallPrinter?: () => void
  onHelp?: () => void
  defaultW?: number
  defaultH?: number
  defaultShape?: PaperGeometry['shape']
}

const INITIAL = LABEL_FORMATS.find((format) => format.code === '608053') ?? LABEL_FORMATS[0]
const brandNames: Record<number, string> = {
  1: '京成云马标签（平张标签）',
  2: '普林泰科标签（平张标签）'
}

function paperFor(format: LabelFormatRecord | undefined, fallback: PaperGeometry['shape']): PaperGeometry {
  if (!format) return { shape: fallback }
  if (format.corner === 2) return { shape: 'disc' }
  if (format.corner === 1) return { shape: 'roundRect' }
  return { shape: 'rect' }
}

function distinctBy<T>(items: readonly T[], key: (item: T) => string | number): T[] {
  const seen = new Set<string | number>()
  return items.filter((item) => {
    const value = key(item)
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

function fixedMm(value: number): string {
  return value.toFixed(2)
}

export default function NewLabelDialog({ onSelect, onClose, onInstallPrinter, onHelp, defaultW = 105, defaultH = 55, defaultShape = 'rect' }: Props) {
  const [printer, setPrinter] = useState('')
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string }>>([])
  const [brandId, setBrandId] = useState(INITIAL.brandId)
  const [categoryId, setCategoryId] = useState(INITIAL.categoryId)
  const [formatCode, setFormatCode] = useState(INITIAL.code)
  const [custom, setCustom] = useState(false)
  const [cw, setCw] = useState(String(defaultW))
  const [ch, setCh] = useState(String(defaultH))

  useEffect(() => {
    window.maxlabel
      .listPrinters()
      .then((result) => {
        const items = (result.printers ?? []).map((p) => ({ name: p.name, displayName: p.displayName || p.name }))
        setPrinters(items)
        if (items.length > 0) setPrinter(items[0].name)
      })
      .catch(() => {})
  }, [])

  const brands = useMemo(() => distinctBy(LABEL_FORMATS, (format) => format.brandId).map((format) => ({ id: format.brandId, name: format.brandName })), [])
  const brandFormats = useMemo(() => LABEL_FORMATS.filter((format) => format.brandId === brandId), [brandId])
  const categories = useMemo(() => distinctBy(brandFormats, (format) => format.categoryId), [brandFormats])
  const categoryFormats = useMemo(() => brandFormats.filter((format) => format.categoryId === categoryId), [brandFormats, categoryId])
  const selected: LabelFormatRecord = custom ? INITIAL : (LABEL_FORMATS.find((format) => format.code === formatCode) ?? categoryFormats[0] ?? INITIAL)

  const previewW = Math.max(1, custom ? Number(cw) || 1 : selected.labelWidthMm)
  const previewH = Math.max(1, custom ? Number(ch) || 1 : selected.labelHeightMm)
  const pageW = custom ? previewW + 4 : Math.max(selected.pageWidthMm, selected.labelWidthMm)
  const pageH = custom ? previewH + 4 : Math.max(selected.pageHeightMm, selected.labelHeightMm)
  const cols = custom ? 1 : selected.cols
  const rows = custom ? 1 : selected.rows
  const colGap = custom ? 0 : selected.colGapMm
  const rowGap = custom ? 0 : selected.rowGapMm
  const totalGridW = cols * previewW + Math.max(0, cols - 1) * colGap
  const totalGridH = rows * previewH + Math.max(0, rows - 1) * rowGap
  const originX = custom ? 2 : (selected.pageLeftMm || Math.max(0, (pageW - totalGridW) / 2))
  const originY = custom ? 2 : (selected.pageTopMm || Math.max(0, (pageH - totalGridH) / 2))
  const viewW = pageW + 28
  const viewH = pageH + 28
  const previewPaper = paperFor(selected, defaultShape)

  const chooseBrand = (nextBrandId: number) => {
    const first = LABEL_FORMATS.find((format) => format.brandId === nextBrandId)
    if (!first) return
    setBrandId(nextBrandId)
    setCategoryId(first.categoryId)
    setFormatCode(first.code)
    setCustom(false)
  }

  const chooseType = (nextCategoryId: number) => {
    const first = brandFormats.find((format) => format.categoryId === nextCategoryId)
    if (!first) return
    setCategoryId(nextCategoryId)
    setFormatCode(first.code)
    setCustom(false)
  }

  const chooseFormat = (nextCode: string) => {
    if (nextCode === '__custom__') {
      setCustom(true)
      return
    }
    const next = LABEL_FORMATS.find((format) => format.code === nextCode)
    if (!next) return
    setCustom(false)
    setBrandId(next.brandId)
    setCategoryId(next.categoryId)
    setFormatCode(next.code)
  }

  const confirm = () => {
    const w = custom ? parseFloat(cw) : selected.labelWidthMm
    const h = custom ? parseFloat(ch) : selected.labelHeightMm
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 5 || h < 5 || w > 500 || h > 500) return
    const format: LabelFormatSelection = custom
      ? { rows: 1, cols: 1, formatKind: 'custom', pageWidthMm: w + 4, pageHeightMm: h + 4 }
      : {
        rows: selected.rows,
        cols: selected.cols,
        formatKind: 'preset',
        formatCode: selected.code,
        pageWidthMm: selected.pageWidthMm,
        pageHeightMm: selected.pageHeightMm,
        ...(selected.type === 1 ? { pagesPerBox: selected.totalLabels } : {})
      }
    onSelect(w, h, previewPaper, printer || undefined, format)
  }

  const field = { padding: '6px 8px', border: '1px solid #BDBDBD', borderRadius: 2, fontSize: 13, background: '#fff', color: '#1A1B1C', width: '100%', boxSizing: 'border-box' as const }
  const button = { padding: '7px 20px', border: '1px solid #BDBDBD', borderRadius: 2, background: '#fff', color: '#1A1B1C', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }
  const primaryButton = { ...button, borderColor: '#2E6E93', outline: '1px dotted #111', outlineOffset: -4 }

  return (
    <div data-testid="new-label-dialog-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
      <div data-testid="new-label-dialog" role="dialog" aria-modal="true" aria-label="选择标签格式" style={{ background: '#F5F5F5', width: 760, maxWidth: '96vw', maxHeight: '96vh', overflow: 'auto', boxShadow: '0 12px 48px rgba(0,0,0,0.35)', color: '#111' }}>
        <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #D7D7D7', background: '#F4F4F4', fontSize: 16 }}>
          <span>选择标签格式</span>
          <button type="button" aria-label="关闭" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: '#333' }}>×</button>
        </div>

        <div style={{ padding: '14px 18px 8px' }}>
          <div data-testid="new-label-preview" style={{ position: 'relative', margin: '0 auto', width: 430, maxWidth: '100%', height: 345, background: '#EFEFEF' }}>
            <svg width="100%" height="100%" viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="xMidYMid meet" aria-label="标签预览">
              <rect x={12} y={12} width={pageW} height={pageH} fill="#fff" stroke="#111" strokeWidth={0.45} />
              {Array.from({ length: cols * rows }, (_, index) => {
                const x = 12 + originX + (index % cols) * (previewW + colGap)
                const y = 12 + originY + Math.floor(index / cols) * (previewH + rowGap)
                return <path key={index} d={paperPath(previewW, previewH, previewPaper)} transform={`translate(${x} ${y})`} fill="#fff" stroke="#111" strokeWidth={0.45} />
              })}
              <line x1={12 + originX} y1={7} x2={12 + originX + previewW} y2={7} stroke="#F00" strokeWidth={0.35} />
              <path d={`M ${12 + originX} 7 l 2 -1.1 M ${12 + originX} 7 l 2 1.1 M ${12 + originX + previewW} 7 l -2 -1.1 M ${12 + originX + previewW} 7 l -2 1.1`} stroke="#F00" strokeWidth={0.35} fill="none" />
              <text x={12 + originX + previewW / 2} y={5} textAnchor="middle" fontSize="4.2" fill="#E00">{`${Math.round(previewW)}mm`}</text>
              <line x1={viewW - 9} y1={12 + originY} x2={viewW - 9} y2={12 + originY + previewH} stroke="#F00" strokeWidth={0.35} />
              <path d={`M ${viewW - 9} ${12 + originY} l -1.1 2 M ${viewW - 9} ${12 + originY} l 1.1 2 M ${viewW - 9} ${12 + originY + previewH} l -1.1 -2 M ${viewW - 9} ${12 + originY + previewH} l 1.1 -2`} stroke="#F00" strokeWidth={0.35} fill="none" />
              <text x={viewW - 5} y={12 + originY + previewH / 2} textAnchor="middle" fontSize="4.2" fill="#E00" transform={`rotate(90 ${viewW - 5} ${12 + originY + previewH / 2})`}>{`${Math.round(previewH)}mm`}</text>
              {Array.from({ length: cols * rows }, (_, index) => {
                const x = 12 + originX + (index % cols) * (previewW + colGap) + previewW / 2
                const y = 12 + originY + Math.floor(index / cols) * (previewH + rowGap) + previewH / 2 + 1.5
                return <text key={`n-${index}`} x={x} y={y} textAnchor="middle" fontSize="4.5" fill="#111">{index + 1}</text>
              })}
            </svg>
          </div>
          <div data-testid="new-label-sheet-info" style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.8, marginTop: 2 }}>
            纸张：  {custom ? '连续纸 / 卷装' : `${Math.round(selected.pageWidthMm)} 毫米 X ${Math.round(selected.pageHeightMm)} 毫米`}
          </div>
          <div data-testid="new-label-label-info" style={{ textAlign: 'center', fontSize: 14, lineHeight: 1.8 }}>
            标签：  {fixedMm(previewW)} 毫米 X {fixedMm(previewH)} 毫米
          </div>
        </div>

        <fieldset data-testid="new-label-choose-group" style={{ margin: '4px 18px 12px', padding: '10px 12px 12px', border: '1px solid #D5D5D5', background: '#F8F8F8' }}>
          <legend style={{ padding: '0 5px', fontSize: 14 }}>选择标签</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '7px 12px' }}>
            <label style={{ fontSize: 13 }}>打印机(P):
              <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
                <select data-testid="new-label-printer" value={printer} onChange={(event) => setPrinter(event.target.value)} style={{ ...field, flex: 1 }}>
                  {printers.length === 0 && <option value="">（未检测到打印机）</option>}
                  {printers.map((item) => <option key={item.name} value={item.name}>{item.displayName}</option>)}
                </select>
                <button type="button" data-testid="new-label-install" onClick={onInstallPrinter} style={{ ...button, whiteSpace: 'nowrap' }}><span>安装</span><span>(I)</span></button>
              </div>
            </label>
            <label style={{ fontSize: 13 }}>标签品牌(B):
              <select data-testid="new-label-brand" value={brandId} onChange={(event) => chooseBrand(Number(event.target.value))} style={{ ...field, marginTop: 3 }}>
                {brands.map((brand) => <option key={brand.id} value={brand.id}>{brandNames[brand.id] ?? brand.name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>标签类型(G):
              <select data-testid="new-label-type" value={categoryId} onChange={(event) => chooseType(Number(event.target.value))} style={{ ...field, marginTop: 3 }}>
                {categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.categoryName}</option>)}
              </select>
            </label>
            <label style={{ fontSize: 13 }}>标签名称(L):
              <select data-testid="new-label-format" value={custom ? '__custom__' : formatCode} onChange={(event) => chooseFormat(event.target.value)} style={{ ...field, marginTop: 3 }}>
                {categoryFormats.map((format) => <option key={format.code} value={format.code}>{`[${format.code}] ${format.name}`}</option>)}
                <option value="__custom__">自定义</option>
              </select>
            </label>
            {custom && <div data-testid="new-label-custom-fields" style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span>宽度(W):</span><input data-testid="new-label-custom-width" type="number" min={5} max={500} value={cw} onChange={(event) => setCw(event.target.value)} style={{ ...field, width: 90 }} />
              <span>毫米&nbsp;&nbsp;高度(H):</span><input data-testid="new-label-custom-height" type="number" min={5} max={500} value={ch} onChange={(event) => setCh(event.target.value)} style={{ ...field, width: 90 }} />
              <span>毫米</span>
            </div>}
          </div>
          <div data-testid="new-label-hint" style={{ marginTop: 8, fontSize: 12.5 }}>提示：如果上列表中没有尺寸适合的标签格式，请点击“自定义”，自行设置标签的尺寸。</div>
        </fieldset>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 18, padding: '2px 18px 18px' }}>
          <button type="button" data-testid="new-label-select" accessKey="o" data-access-suffix="(O)" className="legacy-access-key" autoFocus onClick={confirm} style={primaryButton}>选择</button>
          <button type="button" data-testid="new-label-custom" accessKey="n" data-access-suffix="(N)" className="legacy-access-key" onClick={() => setCustom(true)} style={button}>自定义</button>
          <button type="button" data-testid="new-label-cancel" accessKey="c" data-access-suffix="(C)" className="legacy-access-key" onClick={onClose} style={button}>取消</button>
          <button type="button" data-testid="new-label-help" accessKey="h" data-access-suffix="(H)" className="legacy-access-key" onClick={onHelp} style={button}>帮助</button>
        </div>
      </div>
    </div>
  )
}
