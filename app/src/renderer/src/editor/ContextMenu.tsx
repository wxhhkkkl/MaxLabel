import { useEffect, useRef, useState } from 'react'
import type { MenuItem } from './MenuBar'

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

/**
 * 通用右键上下文菜单：支持多级子菜单（hover 展开）、点击外部/Esc 关闭。
 * 与 MenuBar 共用 MenuItem 数据结构，保证菜单树风格一致。
 */
export default function ContextMenu({ x, y, items, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [subPath, setSubPath] = useState<number[]>([])
  const [menuH, setMenuH] = useState(0)

  useEffect(() => {
    if (rootRef.current) setMenuH(rootRef.current.offsetHeight)
  }, [items])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [onClose])

  const fire = (it: MenuItem) => {
    onClose()
    if (it.action && !it.disabled) it.action()
  }

  const renderItem = (it: MenuItem, idx: number, path: number[]): JSX.Element => {
    const hasChildren = !!it.children && it.children.length > 0
    const itemOpen = path.every((v, i) => subPath[i] === v)
    return (
      <div key={idx}>
        {it.divider && <div style={{ height: 1, background: '#E4E3DD', margin: '5px 6px' }} />}
        <div
          onClick={() => (hasChildren ? setSubPath(itemOpen ? path.slice(0, -1) : path) : fire(it))}
          onMouseEnter={() => setSubPath(hasChildren ? path : path.slice(0, -1))}
          style={{
            padding: '6px 12px',
            fontSize: 13,
            borderRadius: 5,
            cursor: it.disabled ? 'default' : 'pointer',
            color: it.disabled ? '#B0AFA9' : '#1A1B1C',
            background: itemOpen ? '#EEF3F8' : 'transparent',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            whiteSpace: 'nowrap',
            minWidth: 150
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {it.checked && <span style={{ width: 14, textAlign: 'center', fontSize: 12 }}>✓</span>}
            {it.radio && <span style={{ width: 14, textAlign: 'center', fontSize: 10 }}>●</span>}
            {!it.checked && !it.radio && <span style={{ width: 14 }} />}
            <span>{it.label}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20 }}>
            {it.shortcut && <span style={{ color: '#9AA0A6', fontSize: 12 }}>{it.shortcut}</span>}
            {hasChildren && <span style={{ color: '#9AA0A6', fontSize: 11 }}>›</span>}
          </span>
          {hasChildren && itemOpen && (
            <div
              ref={(el) => {
                // 子菜单防溢出：右侧超出屏幕则向左展开，底部超出则上移
                if (el && el.offsetParent && !el.dataset.fixed) {
                  el.dataset.fixed = '1'
                  const r = el.getBoundingClientRect()
                  if (r.right > window.innerWidth - 8) {
                    el.style.left = 'auto'
                    el.style.right = '100%'
                    el.style.marginLeft = '0'
                    el.style.marginRight = '2px'
                  }
                  const r2 = el.getBoundingClientRect()
                  if (r2.bottom > window.innerHeight - 8) {
                    const overflow = r2.bottom - window.innerHeight + 8
                    el.style.top = Math.max(-(overflow), -(r2.height - 14)) + 'px'
                  }
                }
              }}
              style={{
                position: 'absolute',
                left: '100%',
                top: -5,
                marginLeft: 2,
                minWidth: 170,
                background: '#fff',
                border: '1px solid #D8D6CF',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                padding: 5,
                zIndex: 300
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {it.children!.map((c, ci) => renderItem(c, ci, [...path, ci]))}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        left: Math.min(x, window.innerWidth - 240),
        top: Math.min(y, Math.max(4, window.innerHeight - (menuH || 360) - 8)),
        zIndex: 400,
        background: '#FFFFFF',
        border: '1px solid #D8D6CF',
        borderRadius: 8,
        boxShadow: '0 10px 32px rgba(0,0,0,0.18)',
        padding: 5,
        minWidth: 200,
        userSelect: 'none'
      }}
    >
      {items.map((it, i) => renderItem(it, i, [i]))}
    </div>
  )
}
