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
  return (
    <div data-testid="keyboard-input-modal" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110 }} onClick={onClose}>
      <div style={{ background: '#fff', padding: 20, borderRadius: 12, width: 380, maxWidth: '92vw', boxShadow: '0 8px 40px rgba(0,0,0,0.3)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{isTest ? '测试打印 · 打印前输入' : '打印 · 打印前输入'}</div>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>以下 {labels.length} 个数据源需要您手动输入（键盘输入）{isTest ? '· 测试打印不推进序列号' : ''}</div>
        {labels.map((label) => (
          <div key={label} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</div>
            <input data-testid={`keyboard-input-${label}`} value={vals[label] ?? ''} onChange={(e) => setVals((current) => ({ ...current, [label]: e.target.value }))} style={{ width: '100%', padding: '8px 10px', border: '1px solid #D5D4CD', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }} autoFocus={labels.length === 1} />
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #D5D4CD', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
            取消
          </button>
          <button type="button" data-testid="keyboard-input-submit" onClick={() => onSubmit(vals)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #2E6E93', background: '#2E6E93', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            开始打印
          </button>
        </div>
      </div>
    </div>
  )
}
