import type { LabelObject } from '../types'
import { resolveSourceText } from '../types'

/** 显示对象信息浮窗（查看 → 显示对象信息 / Ctrl+R），展示选中对象的位置、尺寸、数据源摘要 */
export default function ObjectInfoPopup({ obj, onClose }: { obj: LabelObject; onClose: () => void }) {
  const typeName: Record<string, string> = { text: '文字', barcode: '条码', rfid: 'RFID', rect: '矩形', circle: '圆形', line: '线条', image: '图片', table: '表格', group: '组合' }
  const title = 'X: ' + obj.x.toFixed(2) + '  Y: ' + obj.y.toFixed(2) + '  W: ' + obj.w.toFixed(2) + '  H: ' + obj.h.toFixed(2)
  let sourceDesc = ''
  let content = ''
  if ('source' in obj && obj.source) {
    const s = obj.source
    sourceDesc = s.kind === 'constant' ? '常量' : s.kind === 'serial' ? '序列号' : s.kind === 'database' ? '数据库' : s.kind === 'date' ? '日期' : s.kind === 'time' ? '时间' : s.kind === 'keyboard' ? '键盘输入' : '脚本'
    content = resolveSourceText(s)
  }
  const row = (k: string, v: string) => (
    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 12.5, borderBottom: '1px solid #F0EFEA' }}>
      <span style={{ color: '#6B7280' }}>{k}</span>
      <span style={{ color: '#1A1B1C', fontWeight: 500, textAlign: 'right' }}>{v}</span>
    </div>
  )
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 42,
        right: 322,
        width: 260,
        background: '#FFFFFF',
        border: '1px solid #E4E3DD',
        borderRadius: 10,
        boxShadow: '0 10px 34px rgba(0,0,0,0.18)',
        zIndex: 60,
        overflow: 'hidden',
        fontFamily: 'inherit'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#F6F5F2', borderBottom: '1px solid #E4E3DD' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1B1C' }}>对象信息</span>
        <button
          type="button"
          onClick={onClose}
          title="关闭"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#6B7280', fontSize: 14, padding: '2px 6px', fontFamily: 'inherit' }}
        >
          ✕
        </button>
      </div>
      <div style={{ padding: '8px 12px 10px' }}>
        {row('类型', typeName[obj.type] ?? obj.type)}
        {row('位置', title)}
        {row('旋转', (obj.rotation ?? 0) + '°')}
        {sourceDesc ? row('数据源', sourceDesc) : null}
        {content ? (
          <div style={{ marginTop: 6, fontSize: 12.5, color: '#1A1B1C', background: '#F8F7F4', borderRadius: 6, padding: '6px 8px', wordBreak: 'break-all' }}>
            {content}
          </div>
        ) : null}
        {obj.type === 'barcode' && 'barcodeType' in obj ? row('码制', String(obj.barcodeType)) : null}
      </div>
    </div>
  )
}
