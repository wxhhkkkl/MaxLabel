import { normalizeLabelColor, paperPath, type PaperGeometry, type PaperShape } from '../../../shared/domain/paper'

/** 帮助 label_page_label.html：形状只有直角矩形、圆角矩形、圆形三种外观选择。
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
  const holeMm = value.innerDiameterMm ?? 0
  const labelColor = normalizeLabelColor(value.labelColor)
  return <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
    <div style={{ flex: 1, display: 'grid', gap: 8, fontSize: 13, opacity: disabled ? 0.6 : 1 }}>
      <label>形状 <select aria-label="形状" data-testid="template-label-shape" disabled={disabled} value={shape} onChange={(e) => onChange({ ...value, shape: e.target.value as PaperShape })}>
        <option value="rect">直角矩形</option><option value="roundRect">圆角矩形</option>
        <option value="ellipse">圆形</option>
      </select></label>
      {/* 真机「标签格式设置 → 标签」没有圆角半径输入框；圆角矩形统一使用
          shared/domain/paper.ts 的 LabelShop 固定半径规则。 */}
      {shape === 'ellipse' && <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.5 }}>圆形标签的宽度与高度表示两个方向的直径；两者数值相同时即为正圆形标签。</div>}
      <label>孔洞 <select aria-label="孔洞" data-testid="template-label-hole" disabled={disabled} value={holeMm > 0 ? 'circle' : 'none'} onChange={(e) => onChange({ ...value, innerDiameterMm: e.target.value === 'circle' ? Math.min(15, Math.min(w, h) / 2) : 0 })}><option value="none">无</option><option value="circle">圆洞</option></select></label>
      {holeMm > 0 && <label>孔洞尺寸（mm） <input aria-label="孔洞尺寸" data-testid="template-label-hole-size" type="number" min={0} max={Math.min(w, h) - 0.02} step={0.1} disabled={disabled} style={{ width: 75 }} value={holeMm} onChange={(e) => onChange({ ...value, innerDiameterMm: Math.max(0, Math.min(Math.min(w, h) - 0.02, Number(e.target.value))) })} /></label>}
      {/* 帮助 label_page_page.html：「设置标签纸的颜色。颜色只在编辑标签时显示，并不会实际输出底色。」 */}
      <label title="标签纸颜色：只在编辑标签时显示，并不会实际输出底色（帮助 label_page_page.html）">标签纸颜色
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
          <input aria-label="标签纸颜色" data-testid="template-label-color" type="color" disabled={disabled} value={labelColor} onChange={(e) => onChange({ ...value, labelColor: normalizeLabelColor(e.target.value) })} style={{ width: 42, height: 24, padding: 0, border: '1px solid #C8C6BF', background: '#fff' }} />
          {['#ffffff', '#fff8e1', '#e8f5e9', '#e3f2fd', '#f3e5f5', '#f5f5f5'].map((c) => (
            <button key={c} type="button" aria-label={`标签纸颜色 ${c}`} disabled={disabled} onClick={() => onChange({ ...value, labelColor: c })} style={{ width: 18, height: 18, padding: 0, background: c, border: labelColor === c ? '2px solid #2E6E93' : '1px solid #C8C6BF', cursor: disabled ? 'not-allowed' : 'pointer' }} />
          ))}
        </span>
      </label>
    </div>
    <svg aria-label="纸张形状预览" viewBox={`-1 -1 ${w + 2} ${h + 2}`} width={80} height={70} style={{ background: '#22BDED' }}>
      <path d={paperPath(w, h, { ...value, shape })} fill={labelColor} fillRule="evenodd" stroke="#000" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
}
