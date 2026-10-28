import { useState } from 'react'
import { CONTROL_CHAR_ENTRIES } from '../../../shared/domain/datasource'
import { useI18n } from '../features/i18n/useI18n'
import LText from '../features/i18n/LText'
import { localizePropertyLabel } from '../../../shared/i18n/property.en-US'

interface Props {
  onInsert: (token: string) => void
  onClose: () => void
}

/**
 * 「插入字符」对话框（原版 `插入字符` 窗口）：列出 ASCII 1~31 的控制字符，
 * 选中一行后「插入」把 `<SOH>` 这样的记号写进常量内容，解码见 `decodeControlChars`。
 */
export default function InsertCharDialog({ onInsert, onClose }: Props) {
  const { language } = useI18n()
  const L = (text: string) => localizePropertyLabel(text, language)
  const [selected, setSelected] = useState<number | null>(null)

  const cell = { padding: '1px 6px', fontSize: 12.5, borderRight: '1px solid #E0E0E0', whiteSpace: 'nowrap' } as const
  const head = { ...cell, background: '#F2F2F2', fontWeight: 600, color: '#1A1B1C' } as const

  const insert = () => {
    if (selected === null) return
    onInsert(CONTROL_CHAR_ENTRIES[selected].label)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 700, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        data-testid="insert-char-dialog"
        role="dialog"
        aria-modal="true"
        style={{ width: 720, maxWidth: '94vw', background: '#F0F0F0', border: '1px solid #A9A9A9', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', borderBottom: '1px solid #C8C6BF', background: '#E8E8E8', fontSize: 12.5 }}>
          <span><LText text="插入字符"/></span>
          <button type="button" aria-label={L('关闭')} onClick={onClose} style={{ border: 0, background: 'transparent', fontSize: 16, lineHeight: 1, cursor: 'pointer', color: '#555' }}>×</button>
        </div>

        <div style={{ padding: '6px 8px 0' }}>
          <div data-testid="insert-char-tab" style={{ display: 'inline-block', padding: '3px 14px', border: '1px solid #C8C6BF', borderBottom: '1px solid #F0F0F0', background: '#F0F0F0', fontSize: 12.5, marginBottom: -1 }}>
            <LText text="控制符"/>
          </div>
        </div>

        <div style={{ padding: '0 8px' }}>
          <div style={{ border: '1px solid #C8C6BF', background: '#fff', display: 'grid', gridTemplateColumns: '70px 1fr 90px 90px', maxHeight: 380, overflow: 'auto' }}>
            <div style={head}><LText text="字符"/></div>
            <div style={head}><LText text="字符名称"/></div>
            <div style={head}><LText text="ASCII值"/></div>
            <div style={{ ...head, borderRight: 0 }}><LText text="十六进制值"/></div>

            {CONTROL_CHAR_ENTRIES.map((entry, index) => {
              const active = index === selected
              const style = { ...cell, background: active ? '#0A62C9' : '#fff', color: active ? '#fff' : '#1A1B1C' }
              return (
                <div
                  key={entry.name}
                  data-testid={`insert-char-row-${entry.name}`}
                  role="row"
                  aria-selected={active}
                  onClick={() => setSelected(index)}
                  onDoubleClick={() => { onInsert(entry.label); onClose() }}
                  style={{ display: 'contents', cursor: 'default' }}
                >
                  <div style={style}>{entry.name}</div>
                  <div style={style} data-testid={`insert-char-name-${entry.name}`}>{entry.description}</div>
                  <div style={style}>{entry.ascii}</div>
                  <div style={{ ...style, borderRight: 0 }}>{entry.hex}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '8px 10px' }}>
          <button
            type="button"
            data-testid="insert-char-insert"
            disabled={selected === null}
            onClick={insert}
            style={{ padding: '4px 26px', border: '1px solid #7A7A7A', background: '#fff', cursor: selected === null ? 'default' : 'pointer', color: selected === null ? '#A9A9A9' : '#1A1B1C', fontSize: 12.5, fontFamily: 'inherit' }}
          >
            <LText text="插入"/>
          </button>
          <button type="button" data-testid="insert-char-back" onClick={onClose} style={{ padding: '4px 26px', border: '1px solid #7A7A7A', background: '#fff', cursor: 'pointer', fontSize: 12.5, fontFamily: 'inherit' }}>
            <LText text="返回"/>
          </button>
        </div>
      </div>
    </div>
  )
}
