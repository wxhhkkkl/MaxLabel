import { useState } from 'react'
import type { DataSource, LabelObject } from '../types'
import { resolveObjectText, sourceLabel } from '../types'

interface Props {
  obj: LabelObject
  onPatch: (patch: Partial<LabelObject>) => void
  onClose: () => void
}

const rowSel: React.CSSProperties = {
  padding: '6px 8px',
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8
}
const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'inherit'
}

/** 子串是否可直接编辑数据（常量 / 序列号） */
function isEditable(s: DataSource): boolean {
  return s.kind === 'constant' || s.kind === 'serial'
}

/** 取子串的可编辑值（常量取 value，序列号取 current 值） */
function editableValue(s: DataSource): string {
  if (s.kind === 'constant') return s.value
  if (s.kind === 'serial') return String(s.current)
  return ''
}

/** 修改数据对话框（对标 LabelShop "数据"工具 → 修改数据） */
export default function ChangeDataDialog({ obj, onPatch, onClose }: Props) {
  const hasSource = obj.type === 'text' || obj.type === 'barcode' || obj.type === 'rfid'
  const [selIdx, setSelIdx] = useState(0)
  const [input, setInput] = useState(() => (hasSource ? editableValue((obj as { source?: DataSource }).source as DataSource) : ''))
  const source = hasSource ? (obj as { source?: DataSource }).source : undefined
  const subs = hasSource ? ((obj as { subSources?: DataSource[] }).subSources ?? []) : []
  const sources: Array<{ label: string; s: DataSource | undefined; editable: boolean }> = [
    { label: '数据1', s: source as DataSource | undefined, editable: isEditable(source as DataSource) }
  ]
  subs.forEach((s, i) => sources.push({ label: `数据${i + 2}`, s, editable: isEditable(s) }))

  const onSelect = (i: number) => {
    setSelIdx(i)
    const s = sources[i].s
    setInput(s ? editableValue(s) : '')
  }

  const apply = () => {
    if (!hasSource) { onClose(); return }
    const s = sources[selIdx].s
    if (!s) { onClose(); return }
    if (selIdx === 0) {
      // 主源
      if (s.kind === 'constant') onPatch({ source: { ...s, value: input } } as never)
      else if (s.kind === 'serial') onPatch({ source: { ...s, current: parseInt(input || '0', 10) || s.current } } as never)
    } else {
      const arr = [...subs]
      const si = selIdx - 1
      if (s.kind === 'constant') arr[si] = { ...s, value: input }
      else if (s.kind === 'serial') arr[si] = { ...s, current: parseInt(input || '0', 10) || s.current }
      onPatch({ subSources: arr } as never)
    }
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div data-testid="change-data-dialog" style={{ background: '#fff', borderRadius: 10, width: 440, maxWidth: '94vw', boxShadow: '0 8px 30px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #ECEBE6', fontSize: 14, fontWeight: 600, color: '#1A1B1C' }}>
          修改数据
        </div>
        <div style={{ padding: 16, display: 'flex', gap: 12, minHeight: 180 }}>
          {/* 左侧子串列表 */}
          <div style={{ width: 150, border: '1px solid #ECEBE6', borderRadius: 8, padding: 6, overflow: 'auto' }}>
            {sources.map((it, i) => {
              const v = it.s ? resolveObjectText({ source: it.s }, { labelIndex: 1, recordIndex: 0, copy: 1, count: 1, totalLabels: 1, title: '', printerName: '', datasets: {}, sharedVars: {}, keyboardValues: {} }) : ''
              return (
                <div
                  key={i}
                  onClick={() => onSelect(i)}
                  style={{
                    ...rowSel,
                    background: selIdx === i ? '#EAF2FE' : 'transparent',
                    color: selIdx === i ? '#1A5FC9' : '#1A1B1C'
                  }}
                >
                  <span style={{ minWidth: 42, fontWeight: 500 }}>{it.label}</span>
                  <span style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {it.editable ? v : (sourceLabel(it.s) || '')}
                  </span>
                </div>
              )
            })}
          </div>
          {/* 右侧编辑区 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: '#6B7280' }}>显示数据</div>
            {sources[selIdx]?.editable ? (
              <input data-testid="change-data-input" value={input} onChange={(e) => setInput(e.target.value)} style={inputStyle} autoFocus />
            ) : (
              <div style={{ fontSize: 13, color: '#9AA0A6', padding: '6px 8px' }}>该子串为只读数据（日期 / 时间 / 数据库 / 键盘输入 / 脚本），请在"对象属性-数据源"中修改。</div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 'auto' }}>
              <button
                onClick={apply}
                disabled={!sources[selIdx]?.editable}
                style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: '#2563EB', color: '#fff', fontSize: 13, cursor: 'pointer' }}
              >
                确定
              </button>
              <button
                onClick={onClose}
                style={{ padding: '7px 18px', borderRadius: 6, border: '1px solid #D5D4CD', background: '#fff', color: '#1A1B1C', fontSize: 13, cursor: 'pointer' }}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
