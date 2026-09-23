import { useEffect } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { displayMfcCaption } from '../../../shared/mfcCaption'

interface Props {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: number
  testId?: string
}

export default function Modal({ title, onClose, children, footer, width = 580, testId }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={onClose}
    >
      <div
        data-testid={testId}
        style={{
          background: '#fff',
          borderRadius: 12,
          width,
          maxWidth: '94vw',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #E4E3DD' }}>
          <div data-testid="modal-title" style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'none', fontSize: 20, color: '#6B7280', cursor: 'pointer', width: 32, height: 32, borderRadius: 6 }}
            aria-label="关闭"
          >
            ×
          </button>
        </div>
        <div style={{ padding: 18, flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: '12px 18px', borderTop: '1px solid #E4E3DD', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>{footer}</div>}
      </div>
    </div>
  )
}

export function FormField({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  // 标签原文照抄真机**控件树 dump**，而 dump 里带 MFC 加速键标记 `(&X)`——
  // 真机屏幕上 `&` 不显示（DIFF-83），所以这里统一走 displayMfcCaption。
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, color: '#4B5563' }}>{displayMfcCaption(label)}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{hint}</div>}
    </div>
  )
}

export const selStyle: CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #D5D4CD',
  borderRadius: 6,
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#fff'
}
