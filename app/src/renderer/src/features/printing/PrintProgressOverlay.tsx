import type { CSSProperties } from 'react'

export interface PrintProgressValue {
  /** 已完成单位数（驱动打印=已准备页数；指令打印=已发送标签数） */
  done: number
  /** 总单位数；<= 0 表示总数还没确定，进度条显示不确定态 */
  total: number
}

/** 百分比（0–100）；总数未知时返回 null（不确定进度）。 */
export function printProgressPercent(done: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null
  const percent = Math.round((Math.max(0, done) / total) * 100)
  return Math.max(0, Math.min(100, percent))
}

const CARD: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 45,
  minWidth: 290,
  maxWidth: '78%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid #D5D4CD',
  background: 'rgba(255,255,255,0.97)',
  boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
  // 纯展示，不挡住编辑和打印对话框。
  pointerEvents: 'none'
}

/**
 * 打印进度（挂在编辑页面顶部）：打印开始时出现，任务提交/失败/取消后随
 * `progress = null` 自动消失。文案复用状态栏的打印进度提示。
 */
export default function PrintProgressOverlay({ progress, status }: { progress: PrintProgressValue | null; status: string }) {
  if (!progress) return null
  const percent = printProgressPercent(progress.done, progress.total)
  return (
    <div data-testid="print-progress-overlay" role="status" aria-live="polite" style={CARD}>
      <div
        data-testid="print-progress-label"
        style={{ marginBottom: 6, fontSize: 12.5, color: '#1A1B1C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
      >
        {status}
      </div>
      <div style={{ height: 6, borderRadius: 3, background: '#E7E6E0', overflow: 'hidden' }}>
        <div
          data-testid="print-progress-bar"
          style={{
            height: '100%',
            width: percent === null ? '30%' : `${percent}%`,
            borderRadius: 3,
            background: '#2E6E93',
            transition: percent === null ? undefined : 'width 120ms linear',
            ...(percent === null ? { animation: 'maxlabel-print-progress 1.2s ease-in-out infinite' } : {})
          }}
        />
      </div>
      {percent !== null && (
        <div data-testid="print-progress-percent" style={{ marginTop: 4, fontSize: 11, color: '#6B7280', textAlign: 'right' }}>
          {percent}%
        </div>
      )}
      <style>{'@keyframes maxlabel-print-progress{0%{transform:translateX(-100%)}100%{transform:translateX(320%)}}'}</style>
    </div>
  )
}
