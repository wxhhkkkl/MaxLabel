import { useState } from 'react'

export function PreviewModal({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 12, maxWidth: '92vw', maxHeight: '92vh', overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>打印预览 · {label}</div>
          <button type="button" onClick={onClose} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            关闭
          </button>
        </div>
        <img src={url} alt="标签预览" style={{ display: 'block', maxWidth: '100%', maxHeight: '78vh', border: '1px solid #E4E3DD' }} />
      </div>
    </div>
  )
}

export function KeyboardInputModal({ labels, initial, onClose, onSubmit, isTest }: { labels: string[]; initial: Record<string, string>; onClose: () => void; onSubmit: (vals: Record<string, string>) => void; isTest: boolean }) {
  const [vals, setVals] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {}
    for (const label of labels) result[label] = initial[label] ?? ''
    return result
  })
  const submit = () => onSubmit(vals)
  return (
    <div data-testid="keyboard-input-modal" role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }} onClick={onClose}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 12, width: 380, maxWidth: '92vw', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>提示输入数据</div>
        <form onSubmit={(event) => { event.preventDefault(); submit() }}>
          <fieldset style={{ border: '1px solid #D8D6CF', padding: '12px 14px', margin: 0 }}>
            <legend>输入数据</legend>
            {labels.map((label, index) => (
              <div key={label} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', alignItems: 'center', gap: 8, marginBottom: index === labels.length - 1 ? 0 : 10 }}>
                <label htmlFor={`keyboard-input-${label}`}>{label}:</label>
                <input id={`keyboard-input-${label}`} data-testid={`keyboard-input-${label}`} value={vals[label] ?? ''} onChange={(e) => setVals((current) => ({ ...current, [label]: e.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit() } }} style={{ width: '100%', padding: '7px 8px', border: '1px solid #B9B9B9', borderRadius: 2, fontSize: 13, boxSizing: 'border-box' }} autoFocus={index === 0} />
              </div>
            ))}
          </fieldset>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button type="submit" data-testid="keyboard-input-submit" style={{ padding: '8px 16px', borderRadius: 3, border: '1px solid #1479D1', background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>确定(O)</button>
            <button type="button" data-testid="keyboard-input-cancel" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 3, border: '1px solid #BDBBB4', background: '#F7F7F5', cursor: 'pointer', fontSize: 13 }}>取消(C)</button>
            <button type="button" data-testid="keyboard-input-help" onClick={() => void window.maxlabel.openHelp()} style={{ padding: '8px 16px', borderRadius: 3, border: '1px solid #BDBBB4', background: '#F7F7F5', cursor: 'pointer', fontSize: 13 }}>帮助(H)</button>
          </div>
        </form>
        {isTest && <div style={{ marginTop: 10, fontSize: 11, color: '#6B7280' }}>测试打印不推进序列号。</div>}
      </div>
    </div>
  )
}
