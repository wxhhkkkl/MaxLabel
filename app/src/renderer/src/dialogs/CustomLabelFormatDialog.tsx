import { useState } from 'react'
import { normalizeLabelColor, paperPath, type PaperGeometry, type PaperShape } from '../../../shared/domain/paper'
import { PAPER_HOLE_OPTIONS, PAPER_SHAPE_OPTIONS, maxHoleSizeMm, withHoleSelection } from './paperHoleFields'
import { previewAnnotationLayout } from './previewAnnotation'

/** 预览 svg 的像素尺寸（字号按它换算，见 previewAnnotation.ts）。 */
const PREVIEW_BOX_W = 210
const PREVIEW_BOX_H = 185

export interface CustomLabelDraft {
  width: string
  height: string
  rowGap: string
  colGap: string
  rows: string
  cols: string
  shape: PaperShape
  hole: string
  holeSize: string
  labelColor?: string
  pageWidth: string
  pageHeight: string
}

interface Props {
  initial: CustomLabelDraft
  onClose: () => void
  onConfirm: (draft: CustomLabelDraft, paper: PaperGeometry, pageWidthMm: number, pageHeightMm: number) => void
  onPrinterSettings?: () => void
  onInstallPrinter?: () => void
  onHelp?: () => void
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #BDBDBD',
  borderRadius: 2,
  fontSize: 13,
  background: '#fff',
  color: '#1A1B1C',
  boxSizing: 'border-box'
}

const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '8px 18px',
  border: 0,
  borderBottom: active ? '2px solid #2E6E93' : '2px solid transparent',
  background: active ? '#fff' : 'transparent',
  color: active ? '#111' : '#4B5563',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit'
})

/**
 * 毫米字段的**显示格式**：真机两个独立的控件值 dump 都是两位小数
 * （`probe-round105-custom-label-values.txt` / `probe-round107b-hole-rect-values.txt`：
 * `宽度(&W):` = `100.00`、`高度(&H):` = `70.00`、`列距(&P):` = `2.00`、`行距(&L):` = `2.00`）。
 * 复刻版原来直接把 draft 里的字符串塞进输入框，显示成 `100` / `70` / `2`（并排图 `cmp-custom-85c2d8e.png` 右半）。
 */
export function formatMmValue(value: string): string {
  const parsed = Number(value)
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed.toFixed(2) : value
}

/**
 * 毫米输入框：**编辑时显示原样、失焦后归一成两位小数**。
 * 若一直显示两位小数，用户每敲一个字符都会被格式化，光标会乱跳。
 */
function MmInput({ testId, value, onChange, disabled = false, width = 110, max, style }: {
  testId: string; value: string; onChange: (value: string) => void; disabled?: boolean; width?: number
  max?: number; style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  return <input
    data-testid={testId}
    type="number"
    min={0}
    max={max}
    value={editing ? value : formatMmValue(value)}
    disabled={disabled}
    onFocus={() => setEditing(true)}
    onBlur={() => { setEditing(false); onChange(formatMmValue(value)) }}
    onChange={(event) => onChange(event.target.value)}
    style={{ ...inputStyle, width, ...style }}
  />
}

function NumberField({ testId, label, value, onChange, disabled = false, width = 110 }: {
  testId: string; label: string; value: string; onChange: (value: string) => void; disabled?: boolean; width?: number
}) {
  return <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
    <span style={{ minWidth: 62 }}>{label}</span>
    <MmInput testId={testId} value={value} onChange={onChange} disabled={disabled} width={width} />
    <span>毫米</span>
  </label>
}

export default function CustomLabelFormatDialog({ initial, onClose, onConfirm, onPrinterSettings, onInstallPrinter, onHelp }: Props) {
  const [tab, setTab] = useState<'printer' | 'page' | 'label' | 'other'>('label')
  const [draft, setDraft] = useState<CustomLabelDraft>(initial)
  const patch = (next: Partial<CustomLabelDraft>) => setDraft((current) => ({ ...current, ...next }))
  const width = Math.max(1, Number(draft.width) || 1)
  const height = Math.max(1, Number(draft.height) || 1)
  const cols = Math.max(1, parseInt(draft.cols, 10) || 1)
  const rows = Math.max(1, parseInt(draft.rows, 10) || 1)
  const colGap = Math.max(0, Number(draft.colGap) || 0)
  const rowGap = Math.max(0, Number(draft.rowGap) || 0)
  const holeSize = Math.max(0, Math.min(maxHoleSizeMm(width, height), Number(draft.holeSize) || 0))
  const pageWidth = Math.max(0.1, Number(draft.pageWidth) || width * cols + colGap * (cols - 1) + 4)
  const pageHeight = Math.max(0.1, Number(draft.pageHeight) || height * rows + rowGap * (rows - 1) + 4)
  const labelColor = normalizeLabelColor(draft.labelColor)
  const paper: PaperGeometry = {
    shape: draft.shape,
    // 真机「孔洞」三项（无/圆洞/矩形）共用同一个尺寸框：选「无」时禁用，选「圆洞」或「矩形」时启用
    // （probe-round107-hole-rect-tree.txt：无 → Edit DISABLED；矩形 → Edit enabled，值 0.00）。
    // 尺寸为 0 时不画孔，与真机默认值 0.00 一致。
    ...(draft.hole === 'none' ? {} : withHoleSelection({}, draft.hole as 'circle' | 'rectangle', holeSize, width, height)),
    labelColor
  }

  const confirm = () => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 5 || height < 5 || width > 500 || height > 500) return
    onConfirm(draft, paper, pageWidth, pageHeight)
  }

  return <div data-testid="custom-label-dialog-overlay" style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div data-testid="custom-label-dialog" role="dialog" aria-modal="true" aria-label="标签格式设置" style={{ width: 760, maxWidth: '96vw', maxHeight: '92vh', overflow: 'auto', background: '#F5F5F5', color: '#111', boxShadow: '0 12px 48px rgba(0,0,0,0.35)' }}>
      <div style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', borderBottom: '1px solid #D7D7D7', background: '#F4F4F4', fontSize: 16 }}>
        <span>标签格式设置</span>
        <button type="button" aria-label="关闭" onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 24, lineHeight: 1, cursor: 'pointer', color: '#777' }}>×</button>
      </div>

      <div style={{ padding: '14px 18px 10px' }}>
        <div data-testid="custom-label-tabs" style={{ display: 'flex', gap: 2, borderBottom: '1px solid #D5D5D5' }}>
          {([['printer', '打印机'], ['page', '页面'], ['label', '标签'], ['other', '其它']] as const).map(([key, label]) => (
            <button key={key} type="button" data-testid={`custom-label-tab-${key}`} aria-selected={tab === key} onClick={() => setTab(key)} style={tabStyle(tab === key)}>{label}</button>
          ))}
        </div>

        {tab === 'label' && <div data-testid="custom-label-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.9fr', gap: 16, paddingTop: 18 }}>
          <fieldset style={{ gridColumn: '1 / 2', margin: 0, padding: '14px 12px 12px', border: '1px solid #D5D5D5' }}>
            <legend style={{ padding: '0 5px', fontSize: 14 }}>标签</legend>
            <div style={{ display: 'grid', gap: 12 }}>
              <NumberField testId="new-label-custom-width" label="宽度(W):" value={draft.width} onChange={(value) => patch({ width: value })} />
              <NumberField testId="new-label-custom-height" label="高度(H):" value={draft.height} onChange={(value) => patch({ height: value })} />
            </div>
          </fieldset>
          <fieldset style={{ gridColumn: '2 / 3', margin: 0, padding: '14px 12px 12px', border: '1px solid #D5D5D5' }}>
            <legend style={{ padding: '0 5px', fontSize: 14 }}>间距</legend>
            <div style={{ display: 'grid', gap: 12 }}>
              <NumberField testId="new-label-custom-col-gap" label="列距(P):" value={draft.colGap} onChange={(value) => patch({ colGap: value })} />
              <NumberField testId="new-label-custom-row-gap" label="行距(L):" value={draft.rowGap} onChange={(value) => patch({ rowGap: value })} />
            </div>
          </fieldset>
          <fieldset style={{ gridColumn: '3 / 4', gridRow: '1 / 3', margin: 0, padding: '14px 12px 12px', border: '1px solid #D5D5D5' }}>
            <legend style={{ padding: '0 5px', fontSize: 14 }}>行列</legend>
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><span>列数(C):</span><input data-testid="new-label-custom-cols" type="number" min={1} max={100} value={draft.cols} onChange={(event) => patch({ cols: event.target.value })} style={{ ...inputStyle, width: 78 }} /></label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><span>行数(R):</span><input data-testid="new-label-custom-rows" type="number" min={1} max={100} value={draft.rows} onChange={(event) => patch({ rows: event.target.value })} style={{ ...inputStyle, width: 78 }} /></label>
            </div>
          </fieldset>
          <fieldset style={{ gridColumn: '1 / 2', margin: 0, padding: '14px 12px 12px', border: '1px solid #D5D5D5' }}>
            <legend style={{ padding: '0 5px', fontSize: 14 }}>形状</legend>
            <select data-testid="custom-label-shape" aria-label="形状" value={draft.shape} onChange={(event) => patch({ shape: event.target.value as PaperShape })} style={{ ...inputStyle, width: '100%' }}>
              {PAPER_SHAPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </fieldset>
          <fieldset style={{ gridColumn: '2 / 4', margin: 0, padding: '14px 12px 12px', border: '1px solid #D5D5D5' }}>
            <legend style={{ padding: '0 5px', fontSize: 14 }}>孔洞</legend>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <select data-testid="custom-label-hole" aria-label="孔洞" value={draft.hole} onChange={(event) => patch({ hole: event.target.value })} style={{ ...inputStyle, width: 150 }}>{PAPER_HOLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              {/* 真机该框选「矩形」后显示 `0.00`（probe-round107b-hole-rect-values.txt），
                  所以同样走两位小数的显示格式。 */}
              <MmInput testId="custom-label-hole-size" value={draft.holeSize} onChange={(value) => patch({ holeSize: value })} disabled={draft.hole === 'none'} width={86} max={maxHoleSizeMm(width, height)} />
              <span style={{ color: draft.hole === 'none' ? '#999' : '#111' }}>毫米</span>
            </div>
          </fieldset>
          {/* 预览底白：真机 round105-custom-label.png 的预览区是白底（复刻版原是对话框灰 #F5F5F5）。 */}
          <div data-testid="custom-label-preview" style={{ gridColumn: '1 / 4', display: 'flex', justifyContent: 'center', padding: 4, background: '#fff' }}>
            {(() => {
              /* 真机「标签格式设置」的预览画**整张拼版**（证据 parity/review/cmp-custom-r114.png 左半：
                 4行×2列 共 8 格、每格正中带序号、列距/行距参与间距、孔洞画在每格中心），
                 尺寸标注**只在第一个格子上**（`100mm` 在格子上方 / `70mm` 在格子右侧）。
                 viewBox = 整张网格的范围（width*cols + colGap*(cols-1) × height*rows + rowGap*(rows-1)）+ 少量边距；
                 与上面 pageWidth/pageHeight 的计算用**同一套公式**，不写第二份。 */
              const gridW = width * cols + colGap * (cols - 1)
              const gridH = height * rows + rowGap * (rows - 1)
              // 字号按**渲染像素**算再换算回 viewBox 单位（见 previewAnnotation.ts 的取证说明）：
              // 原来按 `unit * 0.0xx` 算出来只有 ~4px，序号与 100mm/70mm 在屏幕上糊掉。
              const layout = previewAnnotationLayout(gridW, gridH, PREVIEW_BOX_W, PREVIEW_BOX_H, height)
              const margin = layout.margin
              const unit = Math.min(gridW, gridH)
              const dimFont = layout.font
              const numFont = layout.font
              const originX = margin
              const originY = margin
              // 竖排尺寸线：真机把它画在**整张网格的右边**（round105-custom-label.png：`70mm` 在第二列右侧，
              // 不是第一列右侧）；文字在线的右边（rotate(90) 后字形沿 +x 伸展）。
              const vx = originX + gridW + dimFont * 0.35
              return (
                <svg
                  width={PREVIEW_BOX_W}
                  height={PREVIEW_BOX_H}
                  viewBox={`0 0 ${gridW + margin * 2} ${gridH + margin * 2}`}
                  preserveAspectRatio="xMidYMid meet"
                  aria-label="标签格式预览"
                  data-testid="custom-label-preview-svg"
                  data-grid-cols={cols}
                  data-grid-rows={rows}
                >
                  {Array.from({ length: cols * rows }, (_, index) => {
                    const cx = originX + (index % cols) * (width + colGap)
                    const cy = originY + Math.floor(index / cols) * (height + rowGap)
                    return (
                      <g key={`cell-${index}`}>
                        <path data-testid="custom-label-preview-cell" d={paperPath(width, height, paper)} transform={`translate(${cx} ${cy})`} fill="#fff" stroke="#111" strokeWidth={unit * 0.004} />
                        {/* 格子序号：先行后列（1、2 在第一行），写在格子正中 */}
                        <text data-testid="custom-label-preview-number" x={cx + width / 2} y={cy + height / 2 + numFont * 0.36} textAnchor="middle" fontSize={numFont} fill="#111">{index + 1}</text>
                      </g>
                    )
                  })}
                  {/* 尺寸标注只在第一个格子。**留白由字号决定**（margin = 2.2 × 字号），
                      否则字号变大后文字会被 viewBox 裁掉。 */}
                  <line x1={originX} y1={originY - dimFont * 0.3} x2={originX + width} y2={originY - dimFont * 0.3} stroke="#C00" strokeWidth={unit * 0.003} />
                  <path d={`M ${originX} ${originY - dimFont * 0.3} l ${unit * 0.016} ${-unit * 0.008} M ${originX} ${originY - dimFont * 0.3} l ${unit * 0.016} ${unit * 0.008} M ${originX + width} ${originY - dimFont * 0.3} l ${-unit * 0.016} ${-unit * 0.008} M ${originX + width} ${originY - dimFont * 0.3} l ${-unit * 0.016} ${unit * 0.008}`} stroke="#C00" strokeWidth={unit * 0.003} fill="none" />
                  <text x={originX + width / 2} y={originY - dimFont * 0.62} textAnchor="middle" fontSize={dimFont} fill="#C00">{`${Math.round(width)}mm`}</text>
                  <line x1={vx} y1={originY} x2={vx} y2={originY + height} stroke="#C00" strokeWidth={unit * 0.003} />
                  <text x={vx + dimFont * 0.95} y={originY + height / 2} textAnchor="middle" fontSize={dimFont} fill="#C00" transform={`rotate(90 ${vx + dimFont * 0.95} ${originY + height / 2})`}>{`${Math.round(height)}mm`}</text>
                </svg>
              )
            })()}
          </div>
          <div data-testid="custom-label-preview-info" style={{ gridColumn: '1 / 4', textAlign: 'center', fontSize: 14, lineHeight: 1.8 }}>
            {`${width.toFixed(2)} x ${height.toFixed(2)} 毫米 [${rows}行 ${cols}列]`}
          </div>
        </div>}

        {tab === 'printer' && <div data-testid="custom-label-printer-page" style={{ display: 'grid', gap: 14, paddingTop: 18 }}>
          <label style={{ fontSize: 13 }}>名称(N):<select data-testid="custom-label-printer-name" defaultValue="current" style={{ ...inputStyle, width: '100%', marginTop: 6 }}><option value="current">当前打印机</option></select></label>
          <label style={{ fontSize: 13 }}>输出方式:<select data-testid="custom-label-output-mode" defaultValue="driver" style={{ ...inputStyle, width: '100%', marginTop: 6 }}><option value="driver">Windows 驱动方式输出</option><option value="command">打印机指令方式输出</option></select></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button type="button" data-testid="custom-label-standard-driver" onClick={onPrinterSettings} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>标准驱动(S)</button>
            <button type="button" data-testid="custom-label-printer-settings" onClick={onPrinterSettings} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>设置(S)</button>
            <button type="button" data-testid="custom-label-printer-advanced" onClick={onPrinterSettings} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>高级设置(A)</button>
            <button type="button" data-testid="custom-label-install" onClick={onInstallPrinter} style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}>安装(I)</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <label><input type="checkbox" data-testid="custom-label-invert" /> 整页反相打印</label>
            <label><input type="checkbox" data-testid="custom-label-mirror" /> 镜像输出</label>
            <label><input type="checkbox" data-testid="custom-label-single-page" /> 单页任务模式</label>
          </div>
        </div>}
        {tab === 'page' && <div data-testid="custom-label-page" style={{ display: 'grid', gap: 14, paddingTop: 18 }}>
          <NumberField testId="custom-label-page-width" label="宽度(W):" value={draft.pageWidth} onChange={(value) => patch({ pageWidth: value })} />
          <NumberField testId="custom-label-page-height" label="高度(H):" value={draft.pageHeight} onChange={(value) => patch({ pageHeight: value })} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>纸张颜色:
            <input data-testid="custom-label-page-color" type="color" value={labelColor} onChange={(event) => patch({ labelColor: normalizeLabelColor(event.target.value) })} style={{ width: 42, height: 24, padding: 0 }} />
          </label>
        </div>}
        {tab === 'other' && <div data-testid="custom-label-other-page" style={{ display: 'grid', gap: 14, paddingTop: 18 }}><label style={{ fontSize: 13 }}>起始位置(A):<select data-testid="custom-label-start-pos" defaultValue="tl" style={{ ...inputStyle, width: '100%', marginTop: 6 }}><option value="tl">左上角</option><option value="tr">右上角</option><option value="bl">左下角</option><option value="br">右下角</option></select></label><label style={{ fontSize: 13 }}>首选方向(W):<select data-testid="custom-label-direction" defaultValue="ltr" style={{ ...inputStyle, width: '100%', marginTop: 6 }}><option value="ltr">从左到右</option><option value="rtl">从右到左</option></select></label></div>}
      </div>

      <div style={{ padding: '12px 18px', borderTop: '1px solid #D7D7D7', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" data-testid="custom-label-confirm" onClick={confirm} style={{ ...inputStyle, padding: '7px 22px', cursor: 'pointer', borderColor: '#2E6E93' }}>确定</button>
        <button type="button" data-testid="custom-label-cancel" onClick={onClose} style={{ ...inputStyle, padding: '7px 22px', cursor: 'pointer' }}>取消</button>
        {/* 真机该按钮在控件树里是 `[ ]` 隐藏（DISABLED），底部截图上只有 确定/取消/帮助
            —— 见 parity/reference/labelshop/probe-round107-hole-rect-tree.txt 与 r107-hole-rect-20.png。
            这里保留 testid 以便断言"不可见"，但按真机隐藏而不是画一个多出来的灰按钮。 */}
        <button type="button" data-testid="custom-label-apply" disabled hidden style={{ ...inputStyle, padding: '7px 22px', cursor: 'not-allowed', color: '#999', background: '#F2F2F2' }}>应用(A)</button>
        <button type="button" data-testid="custom-label-help" onClick={onHelp} style={{ ...inputStyle, padding: '7px 22px', cursor: 'pointer' }}>帮助</button>
      </div>
    </div>
  </div>
}
