import { paperPath, type PaperGeometry, type PaperShape } from '../../../shared/domain/paper'

export default function PaperFields({ value, width, height, onChange }: {
  value: PaperGeometry; width: number; height: number; onChange: (value: PaperGeometry) => void
}) {
  const w = Math.max(1, width || 1), h = Math.max(1, height || 1)
  return <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
    <div style={{ flex: 1, display: 'grid', gap: 8, fontSize: 13 }}>
      <label>外观形状 <select aria-label="外观形状" value={value.shape ?? 'rect'} onChange={(e) => onChange({ ...value, shape: e.target.value as PaperShape })}>
        <option value="rect">矩形（直角）</option><option value="roundRect">圆角矩形</option>
        <option value="ellipse">圆形 / 椭圆形</option><option value="disc">光盘标签（圆环）</option>
      </select></label>
      {value.shape === 'roundRect' && <label>圆角半径（mm） <input aria-label="圆角半径" type="number" min={0} max={Math.min(w, h) / 2} step={0.1} style={{ width: 75 }} value={value.cornerRadiusMm ?? +(Math.min(w, h) * 0.12).toFixed(2)} onChange={(e) => onChange({ ...value, cornerRadiusMm: Math.max(0, Math.min(Math.min(w, h) / 2, Number(e.target.value))) })} /></label>}
      <label>孔洞 <select aria-label="孔洞" value={(value.innerDiameterMm ?? (value.shape === 'disc' ? 15 : 0)) > 0 ? 'circle' : 'none'} onChange={(e) => onChange({ ...value, innerDiameterMm: e.target.value === 'circle' ? Math.min(15, Math.min(w, h) / 2) : 0 })}><option value="none">无</option><option value="circle">圆洞（居中）</option></select></label>
      {(value.innerDiameterMm ?? (value.shape === 'disc' ? 15 : 0)) > 0 && <label>中心孔直径（mm） <input aria-label="中心孔直径" type="number" min={0} max={Math.min(w, h) - 0.02} step={0.1} style={{ width: 75 }} value={value.innerDiameterMm ?? 15} onChange={(e) => onChange({ ...value, innerDiameterMm: Math.max(0, Math.min(Math.min(w, h) - 0.02, Number(e.target.value))) })} /></label>}
    </div>
    <svg aria-label="纸张形状预览" viewBox={`-1 -1 ${w + 2} ${h + 2}`} width={80} height={70} style={{ background: '#22BDED' }}>
      <path d={paperPath(w, h, value)} fill="#fff" fillRule="evenodd" stroke="#000" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
}
