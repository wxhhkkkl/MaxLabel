import { useState } from 'react'
import type { PrintAdvancedOptions } from './PrintDialog'

interface Props {
  advanced: PrintAdvancedOptions
  onSave: (patch: Partial<PrintAdvancedOptions>) => void
  onClose: () => void
  onHelp: () => void
}

const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#fff',
  boxSizing: 'border-box'
}

function Check({ checked, disabled, onChange, children, testId }: { checked: boolean; disabled?: boolean; onChange: (value: boolean) => void; children: React.ReactNode; testId?: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 30, color: disabled ? '#9CA3AF' : '#1A1B1C', cursor: disabled ? 'default' : 'pointer', fontSize: 13 }}>
      <input data-testid={testId} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} style={{ width: 16, height: 16, margin: 0 }} />
      <span>{children}</span>
    </label>
  )
}

export default function PrintAdvancedDialog({ advanced, onSave, onClose, onHelp }: Props) {
  const [tab, setTab] = useState<'header' | 'crop' | 'database'>('header')
  const [draft, setDraft] = useState(advanced)
  const set = (patch: Partial<PrintAdvancedOptions>) => setDraft((current) => ({ ...current, ...patch }))
  const commit = () => { onSave(draft); onClose() }

  return (
    <div role="dialog" aria-modal="true" data-testid="print-advanced-dialog" style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }} onClick={onClose}>
      <div style={{ width: 'min(720px, 96vw)', maxHeight: '92vh', overflow: 'auto', background: '#fff', borderRadius: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.3)', color: '#1A1B1C' }} onClick={(event) => event.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', borderBottom: '1px solid #E4E3DD' }}>
          <div style={{ fontSize: 15, fontWeight: 600 }}>高级打印选项</div>
          <button type="button" aria-label="关闭高级打印选项" onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 22, color: '#6B7280', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: 2, padding: '0 16px', borderBottom: '1px solid #E4E3DD' }}>
          {[
            ['header', '页眉页脚'],
            ['crop', '定位裁切标记'],
            ['database', '数据库打印高级选项']
          ].map(([key, label]) => (
            <button key={key} type="button" data-testid={`print-advanced-tab-${key}`} onClick={() => setTab(key as typeof tab)} style={{ padding: '10px 14px', border: 'none', borderBottom: tab === key ? '2px solid #2E6E93' : '2px solid transparent', background: 'none', color: tab === key ? '#2E6E93' : '#4B5563', fontSize: 13, fontWeight: tab === key ? 600 : 400, cursor: 'pointer' }}>{label}</button>
          ))}
        </div>

        <div style={{ padding: 18, minHeight: 300 }}>
          {tab === 'header' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Check testId="print-advanced-header-enabled" checked={draft.headerFooter} onChange={(value) => set({ headerFooter: value })}>输出页眉页脚</Check>
              <div style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: 10, alignItems: 'center', fontSize: 13, color: draft.headerFooter ? '#1A1B1C' : '#9CA3AF' }}>
                <span>使用全局设置</span><input type="checkbox" checked readOnly disabled style={{ width: 16, height: 16 }} />
                <span>页眉页脚样式</span><select disabled={!draft.headerFooter} style={{ ...inputStyle }} defaultValue="default"><option value="default">默认设置</option></select>
                <span>位置偏移（毫米）</span><input data-testid="print-advanced-header-offset" type="number" step="0.01" disabled={!draft.headerFooter} value={draft.headerFooterOffsetMm} onChange={(event) => set({ headerFooterOffsetMm: Number(event.target.value) || 0 })} style={{ ...inputStyle, width: 130 }} />
                <span>模板</span><input data-testid="print-advanced-header-template" disabled={!draft.headerFooter} value={draft.headerFooterTemplate} onChange={(event) => set({ headerFooterTemplate: event.target.value })} style={inputStyle} />
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>默认模板：&amp;D &amp;T &amp;F - &amp;P</div>
            </div>
          )}

          {tab === 'crop' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Check testId="print-advanced-crop-enabled" checked={draft.cropMarks} onChange={(value) => set({ cropMarks: value })}>输出定位裁切标记</Check>
              <div style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr)', gap: 10, alignItems: 'center', fontSize: 13, color: draft.cropMarks ? '#1A1B1C' : '#9CA3AF' }}>
                <span>使用全局设置</span><input type="checkbox" checked readOnly disabled style={{ width: 16, height: 16 }} />
                <span>标记类型</span><select disabled={!draft.cropMarks} style={inputStyle} defaultValue="both"><option value="both">定位和裁切标记</option></select>
                <span>位置偏移（毫米）</span><input data-testid="print-advanced-crop-offset" type="number" step="0.01" disabled={!draft.cropMarks} value={draft.cropMarkOffsetMm} onChange={(event) => set({ cropMarkOffsetMm: Number(event.target.value) || 0 })} style={{ ...inputStyle, width: 130 }} />
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>定位裁切标记默认启用，偏移默认 -5.00 毫米。</div>
            </div>
          )}

          {tab === 'database' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Check testId="print-option-auto-count" checked={draft.autoCount} onChange={(value) => set({ autoCount: value })}>打印时自动设置数据库记录数量</Check>
              <Check testId="print-option-copy-field" checked={draft.copyField} onChange={(value) => set({ copyField: value })}>拷贝数量从数据库字段引入</Check>
              {draft.copyField && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 4px 24px', fontSize: 12.5, color: '#6B7280' }}>
                  字段名称
                  <input data-testid="print-option-copy-field-name" value={draft.copyFieldName} onChange={(event) => set({ copyFieldName: event.target.value })} placeholder="如 qty" style={{ ...inputStyle, flex: 1 }} />
                </label>
              )}
              <Check testId="print-option-first-copy" checked={draft.firstCopyAsk} onChange={(value) => set({ firstCopyAsk: value })}>允许打印时输入第一个标签的拷贝数量</Check>
              <Check testId="print-option-dupcheck" checked={draft.dupcheck} onChange={(value) => set({ dupcheck: value })}>打印时数据查重</Check>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '12px 18px', borderTop: '1px solid #E4E3DD' }}>
          <button type="button" onClick={onHelp} style={{ marginRight: 'auto', padding: '7px 16px', border: '1px solid #D5D4CD', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13 }}>帮助</button>
          <button type="button" onClick={onClose} style={{ padding: '7px 16px', border: '1px solid #D5D4CD', borderRadius: 7, background: '#fff', cursor: 'pointer', fontSize: 13 }}>取消</button>
          <button type="button" data-testid="print-advanced-submit" onClick={commit} style={{ padding: '7px 18px', border: '1px solid #2E6E93', borderRadius: 7, background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>确定</button>
        </div>
      </div>
    </div>
  )
}
