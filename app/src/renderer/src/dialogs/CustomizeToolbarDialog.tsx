import { useEffect, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import Modal from './Modal'
import {
  TOOLBAR_BUTTONS,
  defaultToolbarLayout,
  formatToolbarKey,
  toolbarGroupsInOrder,
  toolbarButtonLabel,
  type ToolbarLayout
} from '../editor/toolbarLayout'

interface Props {
  layout: ToolbarLayout
  onApply: (layout: ToolbarLayout) => void
  onClose: () => void
}

const BTN: CSSProperties = {
  height: 26,
  padding: '0 10px',
  fontSize: 12,
  borderRadius: 5,
  border: '1px solid #C9C7BE',
  background: '#FFFFFF',
  cursor: 'pointer'
}

/**
 * 「添加或删除按钮 → 自定义...」对话框（帮助 toolbar_mainbar.html：「用于添加或删除工具栏按钮，
 * 也可自定义按键及布局」）。逐按钮勾选显示/隐藏、上移/下移调整布局、指派/清除按键；
 * 确定后一次性写回系统选项 `toolbarLayout`。取消不改动任何设置。
 */
export default function CustomizeToolbarDialog({ layout, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<ToolbarLayout>(() => ({
    order: [...layout.order],
    hidden: [...layout.hidden],
    keys: { ...layout.keys }
  }))
  const [selected, setSelected] = useState<string>(layout.order[0] ?? '')
  const [recording, setRecording] = useState(false)
  const [hint, setHint] = useState('')

  useEffect(() => { setRecording(false) }, [selected])

  const hiddenSet = new Set(draft.hidden)

  const setVisible = (key: string, visible: boolean) => {
    setDraft((prev) => ({ ...prev, hidden: visible ? prev.hidden.filter((k) => k !== key) : [...new Set([...prev.hidden, key])] }))
  }

  const move = (delta: number) => {
    setDraft((prev) => {
      const i = prev.order.indexOf(selected)
      const j = i + delta
      if (i < 0 || j < 0 || j >= prev.order.length) return prev
      const order = [...prev.order]
      const [item] = order.splice(i, 1)
      order.splice(j, 0, item)
      return { ...prev, order }
    })
  }

  const assignKey = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!recording) return
    e.preventDefault()
    if (e.key === 'Escape') { setRecording(false); setHint(''); return }
    const combo = formatToolbarKey(e)
    if (!combo) { setHint('按键需要带 Ctrl / Alt / Shift 修饰键（例如 Ctrl+1）。'); return }
    const taken = Object.entries(draft.keys).find(([k, v]) => k !== selected && v === combo)
    if (taken) { setHint(`按键 ${combo} 已指派给「${toolbarButtonLabel(taken[0])}」。`); return }
    setDraft((prev) => ({ ...prev, keys: { ...prev.keys, [selected]: combo } }))
    setHint('')
    setRecording(false)
  }

  const clearKey = () => {
    setDraft((prev) => {
      const keys = { ...prev.keys }
      delete keys[selected]
      return { ...prev, keys }
    })
    setHint('')
  }

  const reset = () => {
    setDraft(defaultToolbarLayout())
    setHint('')
  }

  return (
    <Modal
      title="自定义"
      testId="customize-toolbar-dialog"
      width={640}
      onClose={onClose}
      footer={
        <>
          <button type="button" style={BTN} data-testid="customize-toolbar-reset" onClick={reset}>全部重置(R)</button>
          <div style={{ flex: 1 }} />
          <button type="button" style={BTN} data-testid="customize-toolbar-cancel" onClick={onClose}>取消</button>
          <button
            type="button"
            data-testid="customize-toolbar-ok"
            style={{ ...BTN, border: '1px solid #2F7DC0', background: '#2F7DC0', color: '#fff', fontWeight: 600 }}
            onClick={() => onApply(draft)}
          >
            确定
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 12, color: '#6B7280' }}>工具栏按钮：勾选即显示，取消勾选即从工具栏移除；选中一行后用「上移 / 下移」调整布局顺序。</div>
        <div data-testid="customize-toolbar-list" style={{ border: '1px solid #E4E3DD', borderRadius: 6, maxHeight: 320, overflow: 'auto' }}>
          {toolbarGroupsInOrder.map((group) => {
            const items = draft.order.filter((key) => TOOLBAR_BUTTONS.find((b) => b.key === key)?.group === group.key)
            if (!items.length) return null
            return (
              <div key={group.key}>
                <div style={{ padding: '6px 10px', background: '#F5F5F1', fontSize: 12, fontWeight: 600, color: '#4A4B4C' }}>{group.label}</div>
                {items.map((key) => (
                  <div
                    key={key}
                    data-testid={'customize-toolbar-row-' + key}
                    onClick={() => setSelected(key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', fontSize: 13, cursor: 'pointer', background: selected === key ? '#EAF3FB' : '#fff', borderTop: '1px solid #F3F2EE' }}
                  >
                    <input
                      type="checkbox"
                      data-testid={'customize-toolbar-visible-' + key}
                      checked={!hiddenSet.has(key)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setVisible(key, e.target.checked)}
                    />
                    <span style={{ flex: 1 }}>{toolbarButtonLabel(key)}</span>
                    <span data-testid={'customize-toolbar-key-' + key} style={{ fontSize: 12, color: draft.keys[key] ? '#2F7DC0' : '#9AA0A6' }}>{draft.keys[key] ?? '无'}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#6B7280' }}>已选：<b data-testid="customize-toolbar-selected">{toolbarButtonLabel(selected)}</b></span>
          <button type="button" style={BTN} data-testid="customize-toolbar-up" onClick={() => move(-1)}>上移(U)</button>
          <button type="button" style={BTN} data-testid="customize-toolbar-down" onClick={() => move(1)}>下移(D)</button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            data-testid="customize-toolbar-keyassign"
            style={{ ...BTN, borderColor: recording ? '#2F7DC0' : '#C9C7BE', background: recording ? '#EAF3FB' : '#fff' }}
            onClick={() => { setRecording(true); setHint('请按下新的按键组合（需含 Ctrl / Alt / Shift）。') }}
            onKeyDown={assignKey}
          >
            {recording ? '请按新按键…' : '指派按键(K)'}
          </button>
          <button type="button" style={BTN} data-testid="customize-toolbar-keyclear" onClick={clearKey}>清除按键</button>
        </div>
        {hint && <div data-testid="customize-toolbar-hint" style={{ fontSize: 12, color: '#B45309' }}>{hint}</div>}
      </div>
    </Modal>
  )
}
