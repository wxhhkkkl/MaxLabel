interface Props {
  /** 状态提示文本（状态栏最左侧，对标原版：就绪/已对齐/已组合等操作反馈） */
  status: string
  printerLabel: string
  labelSpec: string
  dbStatus: string
  cursor: string
  zoom: number
  /** 选中对象信息（X/Y/W/H mm），有值时额外显示一格 */
  objInfo?: { x: number; y: number; w: number; h: number } | null
  /** 缩放滑块回调（0.25~4 倍） */
  onZoom?: (z: number) => void
  /** 显示单位（系统选项可调，默认毫米） */
  unit?: 'mm' | 'inch'
}

const INCH = 25.4
function mmOf(v: number, unit: 'mm' | 'inch'): number {
  return unit === 'inch' ? v / INCH : v
}
const unitSuffix = (u: 'mm' | 'inch') => (u === 'inch' ? 'in' : 'mm')

export default function StatusBar({ status, printerLabel, labelSpec, dbStatus, cursor, zoom, objInfo, onZoom, unit = 'mm' }: Props) {
  const cell = { padding: '0 12px', fontSize: 12, color: '#4B5563', borderRight: '1px solid #ECEBE6', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' as const }
  const fmt = (v: number) => (unit === 'inch' ? mmOf(v, unit).toFixed(3) : v.toFixed(2))
  return (
    <div data-testid="status-bar" title={status} style={{ height: 26, background: 'var(--app-bar-bg, #F6F5F2)', color: 'var(--app-bar-text, #1A1B1C)', borderTop: '1px solid #E4E3DD', display: 'flex', alignItems: 'center', boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* LabelShop 的状态栏从打印机字段开始，不显示独立的“就绪”字段。 */}
      <div data-testid="status-printer" style={{ ...cell, fontWeight: 600 }} title="打印机">
        <span aria-hidden="true" style={{ marginRight: 6, color: '#4B5563', fontSize: 13 }}>▣</span>
        {printerLabel}
      </div>
      <div data-testid="status-label-spec" style={cell} title="标签规格">
        <span aria-hidden="true" style={{ marginRight: 6, color: '#4B5563', fontSize: 13 }}>▤</span>
        {labelSpec}
      </div>
      <div data-testid="status-database" style={cell} title="数据库">
        <span aria-hidden="true" style={{ marginRight: 6, color: '#4B5563', fontSize: 13 }}>▥</span>
        {dbStatus}
      </div>
      <div data-testid="status-cursor" style={cell} title={`鼠标位置（${unitSuffix(unit)}）`}>
        <span aria-hidden="true" style={{ marginRight: 6, color: '#4B5563', fontSize: 13 }}>⌖</span>
        {cursor}
      </div>
      <div data-testid="status-object-info" style={cell} title={`对象信息（${unitSuffix(unit)}）`}>
        <span aria-hidden="true" style={{ marginRight: 6, color: '#4B5563', fontSize: 13 }}>└</span>
        {objInfo
          ? `X: ${fmt(objInfo.x)}  Y: ${fmt(objInfo.y)}  W: ${fmt(objInfo.w)}  H: ${fmt(objInfo.h)} ${unitSuffix(unit)}`
          : '对象信息'}
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', whiteSpace: 'nowrap' }}>
        <input
          type="range"
          min={25}
          max={400}
          step={5}
          value={Math.round(zoom * 100)}
          onChange={(e) => onZoom?.(parseInt(e.target.value, 10) / 100)}
          title="缩放比例"
          style={{ width: 110, cursor: 'pointer', accentColor: 'var(--app-accent, #2E6E93)' }}
        />
        <span style={{ fontSize: 12, color: '#4B5563', minWidth: 40, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}
