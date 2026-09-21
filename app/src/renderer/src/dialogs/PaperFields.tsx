import { normalizeLabelColor, paperPath, type PaperGeometry, type PaperShape } from '../../../shared/domain/paper'
import { PAPER_HOLE_OPTIONS, PAPER_SHAPE_OPTIONS, holeSelectionOf, maxHoleSizeMm, withHoleSelection, withHoleSize } from './paperHoleFields'

/** 形状只有方角矩形、圆角矩形、圆形三种外观选择。
 *  **用词口径**：真机 UI 是「方角矩形」，帮助 label_page_label.html 写「直角矩形」——两者不一致，
 *  按「真机 UI 为准」（parity/diffs.md DIFF-67）。`OptionsDialog` 的「系统选项」形状下拉尚未取证，不动。
 *  `disc` 是早期为「光盘标签」单列的一档，语义上等于「圆形 + 圆洞」，
 *  打开对话框时统一归一化成 `ellipse`（孔洞尺寸另存），不再作为独立档位暴露。 */
export function normalizePaperShape(value: PaperGeometry): PaperGeometry {
  if (value.shape !== 'disc') return value
  return { ...value, shape: 'ellipse', innerDiameterMm: value.innerDiameterMm && value.innerDiameterMm > 0 ? value.innerDiameterMm : 15 }
}

export default function PaperFields({ value, width, height, onChange, disabled = false }: {
  value: PaperGeometry; width: number; height: number; onChange: (value: PaperGeometry) => void; disabled?: boolean
}) {
  const w = Math.max(1, width || 1), h = Math.max(1, height || 1)
  const shape: PaperShape = value.shape === 'disc' ? 'ellipse' : (value.shape ?? 'rect')
  // 孔洞下拉的选中态必须能表达真机三项（无/圆洞/矩形）。旧实现用 `holeMm > 0 ? 'circle' : 'none'`
  // 反查，选「矩形」会立刻回弹成「圆洞」且几何被写成圆孔 —— 这正是两个入口规则漂移的现场。
  const hole = holeSelectionOf(value, w, h)
  const holeMm = hole === 'none' ? 0 : (value.innerDiameterMm ?? 0)
  const labelColor = normalizeLabelColor(value.labelColor)
  return <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13, opacity: disabled ? 0.6 : 1 }}>
      <fieldset data-testid="template-label-shape-group" style={{ margin: 0, padding: '10px 10px 12px', border: '1px solid #D5D5D5' }}>
        <legend style={{ padding: '0 5px' }}>形状</legend>
        <select aria-label="形状" data-testid="template-label-shape" disabled={disabled} value={shape} onChange={(e) => onChange({ ...value, shape: e.target.value as PaperShape })} style={{ width: '100%' }}>
          {PAPER_SHAPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {shape === 'ellipse' && <div style={{ marginTop: 8, fontSize: 11.5, color: '#6B7280', lineHeight: 1.5 }}>圆形标签的宽度与高度表示两个方向的直径；两者数值相同时即为正圆形标签。</div>}
      </fieldset>
      <fieldset data-testid="template-label-hole-group" style={{ margin: 0, padding: '10px 10px 12px', border: '1px solid #D5D5D5' }}>
        <legend style={{ padding: '0 5px' }}>孔洞</legend>
        <select aria-label="孔洞" data-testid="template-label-hole" disabled={disabled} value={hole} onChange={(e) => onChange(withHoleSelection(value, e.target.value as 'none' | 'circle' | 'rectangle', 0, w, h))} style={{ width: '100%' }}>
          {PAPER_HOLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        {/* 真机「孔洞」组始终只有一个尺寸框：选「无」时为禁用空框（值 0.00），选「圆洞」/「矩形」时点亮
            （probe-round107-hole-rect-tree.txt 里该 Edit 在「无」下是 DISABLED，切「矩形」后 enabled 且值 0.00）。 */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, opacity: hole === 'none' ? 0.6 : 1 }}>尺寸
          <input aria-label="孔洞尺寸" data-testid="template-label-hole-size" type="number" min={0} max={maxHoleSizeMm(w, h)} step={0.1} disabled={disabled || hole === 'none'} style={{ width: 75 }} value={hole === 'none' ? '' : holeMm} onChange={(e) => onChange(withHoleSize(value, Number(e.target.value), w, h))} /> 毫米
        </label>
      </fieldset>
      {/* 真机「标签格式设置 → 标签」没有圆角半径输入框；圆角矩形统一使用
          shared/domain/paper.ts 的 LabelShop 固定半径规则。 */}
    </div>
    <svg aria-label="纸张形状预览" viewBox={`-1 -1 ${w + 2} ${h + 2}`} width={80} height={70} style={{ background: '#22BDED' }}>
      <path d={paperPath(w, h, { ...value, shape })} fill={labelColor} fillRule="evenodd" stroke="#000" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
}
