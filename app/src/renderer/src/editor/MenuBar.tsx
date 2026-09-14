import { useEffect, useRef, useState } from 'react'

export interface MenuItem {
  label: string
  action?: () => void
  disabled?: boolean
  /** 当前工具等互斥命令的选中态（不显示勾选符号）。 */
  active?: boolean
  /** 子菜单（支持任意层级嵌套） */
  children?: MenuItem[]
  divider?: boolean
  /** 快捷键提示文本，显示在右侧 */
  shortcut?: string
  /** 勾选状态（显示 ✓） */
  checked?: boolean
  /** 单选状态（显示 ●） */
  radio?: boolean
}

export interface MenuSection {
  title: string
  items: MenuItem[]
}

interface Props {
  sections: MenuSection[]
}

export default function MenuBar({ sections }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  /** 当前展开的子菜单路径，元素为每一层的 item 索引 */
  const [subPath, setSubPath] = useState<number[]>([])
  /** Alt 键按下（显示菜单项字母下划线，Windows 快捷键习惯） */
  const [altActive, setAltActive] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpen(null)
        setSubPath([])
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  // Windows 菜单习惯：Alt 显示字母下划线；Alt+字母 打开对应菜单；菜单打开时按字母键触发菜单项
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltActive(true)
        return
      }
      // Alt+字母：打开对应顶级菜单（不拦截 Alt+Enter 等已有组合）
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key !== 'Shift') {
        const k = e.key.toLowerCase()
        const sec = [...sections].reverse().find((s) => {
          const m = s.title.match(/\((\w)\)/)
          return m && m[1].toLowerCase() === k
        })
        if (sec) {
          e.preventDefault()
          setOpen(sec.title)
          setSubPath([])
          return
        }
      }
      // 菜单打开时：按下字母键触发对应菜单项（有子菜单则展开子菜单，Windows 习惯）
      if (open && !e.ctrlKey && !e.metaKey && !e.altKey && /^[a-zA-Z]$/.test(e.key)) {
        const sec = sections.find((s) => s.title === open)
        if (sec) {
          const k = e.key.toLowerCase()
          const it = sec.items.find(
            (i) => !i.divider && !i.disabled && i.label.match(/\((\w)\)/)?.[1].toLowerCase() === k
          )
          if (it) {
            e.preventDefault()
            if (it.children?.length) {
              const idx = sec.items.indexOf(it)
              setSubPath([idx])
            } else {
              setOpen(null)
              setSubPath([])
              if (it.action) it.action()
            }
          }
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltActive(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [sections, open])

  const closeAll = () => {
    setOpen(null)
    setSubPath([])
  }

  const fire = (it: MenuItem) => {
    closeAll()
    if (it.action && !it.disabled) it.action()
  }

  /** 渲染菜单标题，Alt 按下时给字母加下划线（Windows mnemonic） */
  const renderTitle = (t: string) => {
    const m = t.match(/^(.*)\((\w)\)$/)
    // 仅在按下 Alt 时给助记字母加下划线（Windows 习惯），平时保持纯文本
    if (!m || !altActive) return t
    return (
      <>
        {m[1]}(<u>{m[2]}</u>)
      </>
    )
  }

  /** 判断指定路径的子菜单是否处于展开状态 */
  const isPathOpen = (path: number[]): boolean => {
    if (subPath.length < path.length) return false
    return path.every((v, i) => subPath[i] === v)
  }

  const renderItem = (it: MenuItem, idx: number, path: number[]) => {
    if (it.divider) {
      return <div key={idx} data-menu-divider="true" aria-hidden="true" style={{ height: 1, background: '#E4E3DD', margin: '5px 6px' }} />
    }
    const hasChildren = !!it.children && it.children.length > 0
    const itemOpen = isPathOpen(path)

    return (
      <div key={idx}>
        <div
          data-menu-item={it.label || undefined}
          data-menu-disabled={it.disabled ? 'true' : 'false'}
          data-menu-shortcut={it.shortcut || undefined}
          data-menu-active={it.active ? 'true' : 'false'}
          data-menu-checked={it.checked ? 'true' : 'false'}
          aria-disabled={it.disabled || undefined}
          role="menuitem"
          onClick={() => {
            if (it.disabled) return
            if (hasChildren) {
              setSubPath(itemOpen ? path.slice(0, -1) : path)
            } else {
              fire(it)
            }
          }}
          onMouseEnter={() => {
            if (hasChildren && !it.disabled) {
              setSubPath(path)
            } else if (!it.disabled) {
              setSubPath(path.slice(0, -1))
            }
          }}
          style={{
            padding: '6px 10px',
            fontSize: 13,
            borderRadius: 5,
            cursor: it.disabled ? 'not-allowed' : 'pointer',
            color: it.disabled ? '#B0AFA9' : 'var(--app-bar-text, #1A1B1C)',
            background: itemOpen ? '#EEF3F8' : it.active ? '#FFF0B8' : 'transparent',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {it.checked && <span style={{ width: 14, textAlign: 'center', fontSize: 12 }}>✓</span>}
            {it.radio && <span style={{ width: 14, textAlign: 'center', fontSize: 10 }}>●</span>}
            {!it.checked && !it.radio && <span style={{ width: 14 }} />}
            <span>{it.label}</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 24 }}>
            {it.shortcut && <span style={{ color: '#9AA0A6', fontSize: 12 }}>{it.shortcut}</span>}
            {hasChildren && <span style={{ color: '#9AA0A6', fontSize: 11 }}>›</span>}
          </span>
          {hasChildren && itemOpen && (
            <div
              style={{
                position: 'absolute',
                left: '100%',
                top: -5,
                marginLeft: 2,
                minWidth: 170,
                background: 'var(--app-bar-bg, #fff)',
                border: '1px solid #D8D6CF',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                padding: 5,
                zIndex: 200
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
      ref={barRef}
      style={{
        background: 'var(--app-bar-bg, #F6F5F2)', color: 'var(--app-bar-text, #1A1B1C)',
        borderBottom: '1px solid #E4E3DD',
        display: 'flex',
        alignItems: 'center',
        height: 30,
        padding: '0 4px',
        boxSizing: 'border-box',
        userSelect: 'none',
        position: 'relative',
        zIndex: 40
      }}
    >
      {sections.map((sec) => (
        <div key={sec.title} style={{ position: 'relative' }}>
          <button
            type="button"
            data-menu-title={sec.title}
            role="menuitem"
            onClick={() => {
              if (open === sec.title) {
                closeAll()
              } else {
                setOpen(sec.title)
                setSubPath([])
              }
            }}
            style={{
              padding: '4px 9px',
              fontSize: 12.5,
              background: open === sec.title ? '#E8E7E2' : 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              color: 'var(--app-bar-text, #1A1B1C)',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap'
            }}
          >
            {renderTitle(sec.title)}
          </button>
          {open === sec.title && (
            <div
              style={{
                position: 'absolute',
                top: 26,
                left: 0,
                minWidth: 220,
                background: 'var(--app-bar-bg, #FFFFFF)',
                border: '1px solid #D8D6CF',
                borderRadius: 8,
                boxShadow: '0 8px 28px rgba(0,0,0,0.14)',
                padding: 5,
                zIndex: 100
              }}
            >
              {sec.items.map((it, i) => renderItem(it, i, [i]))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
