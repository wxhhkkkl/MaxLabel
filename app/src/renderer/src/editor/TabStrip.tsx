import { useState } from 'react'
import ContextMenu from './ContextMenu'
import type { MenuItem } from './MenuBar'

export interface TabInfo {
  key: string
  title: string
  isStart?: boolean
}

interface Props {
  tabs: TabInfo[]
  active: string
  onSelect: (key: string) => void
  onClose: (key: string) => void
  onReorder: (newKeys: string[]) => void
  /** 新建标签模板（右键菜单"新建标签模板"） */
  onNew?: () => void
  /** 关闭其他标签（保留 key） */
  onCloseOthers?: (key: string) => void
  /** 关闭所有标签 */
  onCloseAll?: () => void
}

/** 标签页条：点击切换、× 关闭、拖拽排序、右键菜单 */
export default function TabStrip({ tabs, active, onSelect, onClose, onReorder, onNew, onCloseOthers, onCloseAll }: Props) {
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)
  const [tabMenu, setTabMenu] = useState<{ key: string; x: number; y: number } | null>(null)

  const reset = () => {
    setDragKey(null)
    setOverKey(null)
  }

  const handleDrop = (targetKey: string, fromKey: string | null) => {
    const from = fromKey || dragKey
    if (!from || from === targetKey) {
      reset()
      return
    }
    const keys = tabs.map((t) => t.key)
    const fromIdx = keys.indexOf(from)
    const toIdx = keys.indexOf(targetKey)
    if (fromIdx < 0 || toIdx < 0) {
      reset()
      return
    }
    const next = [...keys]
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, from)
    onReorder(next)
    reset()
  }

  const menuItemsFor = (key: string): MenuItem[] => {
    const isStart = tabs.find((t) => t.key === key)?.isStart
    const items: MenuItem[] = [
      { label: '新建标签模板(N)', shortcut: 'Ctrl+N', action: () => onNew?.() }
    ]
    if (!isStart) {
      items.push(
        { label: '关闭(C)', action: () => onClose(key) },
        { label: '关闭其他(T)', action: () => onCloseOthers?.(key) }
      )
    }
    items.push({ label: '关闭所有(A)', action: () => onCloseAll?.() })
    return items
  }

  return (
    <div
      style={{
        background: 'var(--app-bar-bg, #ECEBE6)', color: 'var(--app-bar-text, #1A1B1C)',
        borderBottom: '1px solid #D8D6CF',
        display: 'flex',
        alignItems: 'flex-end',
        height: 32,
        padding: '0 6px',
        boxSizing: 'border-box',
        gap: 2
      }}
    >
      {tabs.map((t) => {
        const isActive = t.key === active
        const isDragging = dragKey === t.key
        const isOver = overKey === t.key && dragKey && dragKey !== t.key
        return (
          <div
            key={t.key}
            draggable={!t.isStart}
            onClick={() => onSelect(t.key)}
            onContextMenu={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setTabMenu({ key: t.key, x: e.clientX, y: e.clientY })
            }}
            onDragStart={(e) => {
              if (t.isStart) {
                e.preventDefault()
                return
              }
              setDragKey(t.key)
              e.dataTransfer.effectAllowed = 'move'
              try {
                e.dataTransfer.setData('text/plain', t.key)
              } catch {
                /* 忽略 */
              }
            }}
            onDragOver={(e) => {
              let from: string | null = null
              try {
                from = e.dataTransfer.getData('text/plain') || null
              } catch { /* 忽略 */ }
              const hasData = !!(from || dragKey)
              if (!hasData || from === t.key || dragKey === t.key || t.isStart) return
              e.preventDefault()
              e.stopPropagation()
              setOverKey(t.key)
            }}
            onDragEnter={(e) => {
              let from: string | null = null
              try {
                from = e.dataTransfer.getData('text/plain') || null
              } catch { /* 忽略 */ }
              const hasData = !!(from || dragKey)
              if (!hasData || from === t.key || dragKey === t.key || t.isStart) return
              e.preventDefault()
              setOverKey(t.key)
            }}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              let from: string | null = null
              try {
                from = e.dataTransfer.getData('text/plain') || null
              } catch {
                /* 忽略 */
              }
              handleDrop(t.key, from)
            }}
            onDragEnd={reset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 26,
              padding: '0 8px 0 12px',
              background: isActive ? '#FFFFFF' : 'transparent',
              borderTopLeftRadius: 7,
              borderTopRightRadius: 7,
              border: isActive ? '1px solid #D8D6CF' : '1px solid transparent',
              borderBottom: isActive ? '1px solid #FFFFFF' : 'none',
              fontSize: 12.5,
              color: isActive ? 'var(--app-bar-text, #1A1B1C)' : '#6B7280',
              cursor: t.isStart ? 'default' : 'pointer',
              opacity: isDragging ? 0.45 : 1,
              boxSizing: 'border-box',
              position: 'relative',
              outline: 'none'
            }}
            title={t.isStart ? '起始页' : '拖拽可调整标签页顺序'}
          >
            {isOver && (
              <span
                style={{
                  position: 'absolute',
                  left: -2,
                  top: 4,
                  bottom: 4,
                  width: 2,
                  borderRadius: 1,
                  background: 'var(--app-accent, #2E6E93)'
                }}
              />
            )}
            <span>{t.title}</span>
            {!t.isStart && (
              <span
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(t.key)
                }}
                style={{ color: '#9AA0A6', fontSize: 12, padding: '0 2px', cursor: 'pointer' }}
                title="关闭"
              >
                ×
              </span>
            )}
          </div>
        )
      })}
      {tabMenu && (
        <ContextMenu x={tabMenu.x} y={tabMenu.y} items={menuItemsFor(tabMenu.key)} onClose={() => setTabMenu(null)} />
      )}
    </div>
  )
}
