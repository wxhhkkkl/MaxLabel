import { useI18n } from '../features/i18n/useI18n'

interface Props {
  status: string
  printerLabel: string
  labelSpec: string
  dbStatus: string
  cursor: string
  objectInfo?: string
  zoom: number
  /** 缩放滑块回调（0.5~4 倍） */
  onZoom?: (z: number) => void
  /** 显示单位（系统选项可调，默认毫米） */
  unit?: 'mm' | 'inch'
}

const unitSuffix = (u: 'mm' | 'inch') => (u === 'inch' ? 'in' : 'mm')

export default function StatusBar({ status, printerLabel, labelSpec, dbStatus, cursor, objectInfo = '', zoom, onZoom, unit = 'mm' }: Props) {
  const { t } = useI18n()
  const cell = { padding: '0 12px', fontSize: 12, color: '#4B5563', borderRight: '1px solid #ECEBE6', display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' as const }
  return (
    <div data-testid="status-bar" title={status} style={{ height: 26, background: 'var(--app-bar-bg, #F6F5F2)', color: 'var(--app-bar-text, #1A1B1C)', borderTop: '1px solid #E4E3DD', display: 'flex', alignItems: 'center', boxSizing: 'border-box', overflow: 'hidden' }}>
      {/* 原版 的状态栏从打印机字段开始，不显示独立的“就绪”字段。 */}
      <div data-testid="status-printer" style={{ ...cell, fontWeight: 600 }} title={t('status.printer')}>
        <span aria-hidden="true" style={{ marginRight: 6, color: '#4B5563', fontSize: 13 }}>▣</span>
        {printerLabel}
      </div>
      <div data-testid="status-label-spec" style={cell} title={t('status.labelSpec')}>
        <span aria-hidden="true" style={{ marginRight: 6, color: '#4B5563', fontSize: 13 }}>▤</span>
        {labelSpec}
      </div>
      <div data-testid="status-database" style={cell} title={t('status.database')}>
        <span aria-hidden="true" style={{ marginRight: 6, color: '#4B5563', fontSize: 13 }}>▥</span>
        {dbStatus}
      </div>
      <div data-testid="status-cursor" style={cell} title={`${t('status.cursor')} (${unitSuffix(unit)})`}>
        <span aria-hidden="true" style={{ marginRight: 6, color: '#4B5563', fontSize: 13 }}>⌖</span>
        {cursor && <span>{cursor}</span>}
      </div>
      <div data-testid="status-object-info" style={{ ...cell, flex: '0 1 auto', minWidth: 34, overflow: 'hidden' }} title={t('status.objectInfo')}>
        <span aria-hidden="true" style={{ marginRight: objectInfo ? 6 : 0, color: '#4B5563', fontSize: 13 }}>▱</span>
        {objectInfo && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{objectInfo}</span>}
      </div>
      {/* 状态消息（保存失败/已保存/只读等）以前只放在整条的 title 里，用户看不到；这里可见地显示出来。 */}
      <div data-testid="status-message" style={{ ...cell, flex: '1 1 120px', minWidth: 60, borderRight: 'none', overflow: 'hidden' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={status}>{status}</span>
      </div>
      <div data-testid="status-zoom" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', whiteSpace: 'nowrap' }}>
        <input
          type="range"
          min={50}
          max={400}
          step={5}
          value={Math.round(zoom * 100)}
          onChange={(e) => onZoom?.(parseInt(e.target.value, 10) / 100)}
          title={t('status.zoom')}
          style={{ width: 110, cursor: 'pointer', accentColor: 'var(--app-accent, #2E6E93)' }}
        />
        <span style={{ fontSize: 12, color: '#4B5563', minWidth: 40, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  )
}
