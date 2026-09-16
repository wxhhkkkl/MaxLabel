import { useRef, useState } from 'react'
import type { LabelObject } from '../types'
import * as I from './icons'

/**
 * 格式栏（对标 LabelShop 格式栏）：
 * 字体名称 / 字号 / 粗体 / 斜体 / 下划线 / 反白 / 颜色 / 文字停靠（居左/居中/居右/撑满）/ 组合 / 取消组合 / 属性
 */

interface Props {
  obj: LabelObject | null
  onPatch: (patch: Partial<LabelObject>) => void
  onGroup: () => void
  onUngroup: () => void
  onProps: () => void
  canGroup?: boolean
  canUngroup?: boolean
}

export const FONTS = ['微软雅黑', '宋体', '黑体', '楷体', '仿宋', 'Arial', 'Times New Roman', 'Courier New', 'Symbol', 'OCR-B-10 BT', 'OCR-A Std', 'Verdana', 'Tahoma']
/** 常见字号（磅）；存储模型为毫米：mm = pt × 25.4/72 */
export const PT_SIZES = [6, 7, 8, 9, 10, 10.5, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 48, 72]
export const PT_TO_MM = 25.4 / 72
export const MM_TO_PT = 72 / 25.4

function Btn({ title, testId, onClick, active, disabled, children }: { title: string; testId?: string; onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      data-testid={testId}
      style={{
        width: 28,
        height: 28,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
        border: active ? '1px solid #9DC3E0' : '1px solid transparent',
        background: active ? '#EAF3FB' : 'transparent',
        color: disabled ? '#B9BCC2' : 'var(--app-bar-text, #1A1B1C)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        padding: 0
      }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: '#E4E3DD', margin: '0 5px', flexShrink: 0 }} />
}

export default function FormatBar({ obj, onPatch, onGroup, onUngroup, onProps, canGroup = false, canUngroup = false }: Props) {
  const [openColor, setOpenColor] = useState(false)
  const [openBg, setOpenBg] = useState(false)
  const colorWrapRef = useRef<HTMLDivElement>(null)
  const isText = obj?.type === 'text'
  const isGroup = obj?.type === 'group'
  const text = isText ? (obj as Extract<LabelObject, { type: 'text' }>) : null
  // 磅值按 0.1 取整：毫米以两位小数存储（mmOf），换算回来会带 ±0.02pt 的残差，
  // 若按两位小数取值就会取不到下拉里的任何选项（原版字号下拉始终落在列表值上）。
  const pt = text ? Math.round((text.fontSize * MM_TO_PT) * 10) / 10 : 0
  const mmOf = (p: number) => Math.round(p * PT_TO_MM * 100) / 100

  const apply = (patch: Partial<LabelObject>) => {
    if (obj) onPatch(patch)
  }

  return (
    <div data-testid="format-bar" style={{ background: 'var(--app-bar-bg, #FFFFFF)', color: 'var(--app-bar-text, #1A1B1C)', borderBottom: '1px solid #E4E3DD', padding: '3px 8px', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', boxSizing: 'border-box', userSelect: 'none' }}>
      <span style={{ fontSize: 12, color: '#6B7280', marginRight: 2, whiteSpace: 'nowrap' }}>格式</span>
      {/* 字体名称 */}
      <select
        value={text?.fontFamily ?? ''}
        disabled={!isText}
        onChange={(e) => apply({ fontFamily: e.target.value })}
        title="字体"
        style={{ height: 26, fontSize: 12, border: '1px solid #D5D4CD', color: 'var(--app-bar-text, #1A1B1C)', borderRadius: 5, background: 'var(--app-bar-bg, #fff)', maxWidth: 130 }}
      >
        {!isText && <option value="">—</option>}
        {FONTS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      {/* 字号（磅，存储毫米） */}
      <select
        value={isText ? String(pt) : ''}
        disabled={!isText}
        onChange={(e) => apply({ fontSize: mmOf(parseFloat(e.target.value)) })}
        title="字号"
        style={{ height: 26, fontSize: 12, border: '1px solid #D5D4CD', color: 'var(--app-bar-text, #1A1B1C)', borderRadius: 5, background: 'var(--app-bar-bg, #fff)', width: 58 }}
      >
        {!isText && <option value="">—</option>}
        {PT_SIZES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <Sep />
      {/* 粗体 / 斜体 / 下划线 / 反白 */}
      <Btn title="粗体" active={!!text?.bold} disabled={!isText} onClick={() => text && apply({ bold: !text.bold })}>
        <I.IBold />
      </Btn>
      <Btn title="斜体" active={!!text?.italic} disabled={!isText} onClick={() => text && apply({ italic: !text.italic })}>
        <I.IItalic />
      </Btn>
      <Btn title="下划线" active={!!text?.underline} disabled={!isText} onClick={() => text && apply({ underline: !text.underline })}>
        <I.IUnderline />
      </Btn>
      <Btn title="反白" active={!!text?.reverse} disabled={!isText} onClick={() => text && apply({ reverse: !text.reverse })}>
        <I.IReverse />
      </Btn>
      {/* 颜色 */}
      <div ref={colorWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          disabled={!isText}
          onClick={() => setOpenColor((v) => !v)}
          title="字体颜色"
          style={{
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 5,
            border: openColor ? '1px solid #9DC3E0' : '1px solid transparent',
            background: openColor ? '#EAF3FB' : 'transparent',
            cursor: isText ? 'pointer' : 'not-allowed',
            opacity: isText ? 1 : 0.45,
            padding: 0
          }}
        >
          <I.IColor />
        </button>
        {openColor && isText && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpenColor(false)} />
            <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 41, background: '#fff', border: '1px solid #E4E3DD', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.14)' }}>
              <input
                type="color"
                value={text?.color ?? '#000000'}
                onChange={(e) => {
                  apply({ color: e.target.value })
                  setOpenColor(false)
                }}
                style={{ width: 96, height: 32, border: 'none', padding: 0, cursor: 'pointer' }}
              />
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>当前：{text?.color ?? '#000000'}</div>
            </div>
          </>
        )}
      </div>
      {/* 背景颜色（原版格式栏"背景颜色"按钮） */}
      <div ref={colorWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          disabled={!isText}
          onClick={() => setOpenBg((v) => !v)}
          title="背景颜色"
          style={{
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 5,
            border: openBg ? '1px solid #9DC3E0' : '1px solid transparent',
            background: openBg ? '#EAF3FB' : 'transparent',
            cursor: isText ? 'pointer' : 'not-allowed',
            opacity: isText ? 1 : 0.45,
            padding: 0
          }}
        >
          <I.IColorBg />
        </button>
        {openBg && isText && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpenBg(false)} />
            <div style={{ position: 'absolute', top: 32, left: 0, zIndex: 41, background: '#fff', border: '1px solid #E4E3DD', borderRadius: 8, padding: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.14)' }}>
              <input
                type="color"
                value={text?.backgroundColor ?? '#FFFFFF'}
                onChange={(e) => {
                  apply({ backgroundColor: e.target.value })
                  setOpenBg(false)
                }}
                style={{ width: 96, height: 32, border: 'none', padding: 0, cursor: 'pointer' }}
              />
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>当前：{text?.backgroundColor ?? '透明'}</div>
            </div>
          </>
        )}
      </div>
      <Sep />
      {/* 文字停靠 */}
      <Btn title="居左" active={text?.align === 'left'} disabled={!isText} onClick={() => apply({ align: 'left' })}>
        <I.IAlignLeft />
      </Btn>
      <Btn title="居中" active={text?.align === 'center'} disabled={!isText} onClick={() => apply({ align: 'center' })}>
        <I.IAlignCenter />
      </Btn>
      <Btn title="居右" active={text?.align === 'right'} disabled={!isText} onClick={() => apply({ align: 'right' })}>
        <I.IAlignRight />
      </Btn>
      <Btn title="撑满（两端对齐）" active={text?.align === 'justify'} disabled={!isText} onClick={() => apply({ align: 'justify' })}>
        <I.IAlignJustify />
      </Btn>
      <Sep />
      {/* 组合 / 取消组合 */}
      <Btn title="组合（将选中的多个对象组合为一个整体）" onClick={onGroup} disabled={!canGroup}>
        <I.IGroup />
      </Btn>
      <Btn title="取消组合" active={isGroup} onClick={onUngroup} disabled={!canUngroup}>
        <I.IUngroup />
      </Btn>
      <Sep />
      {/* 属性对话框 */}
      <Btn title="属性" testId="format-props" onClick={onProps}>
        <I.IProps />
      </Btn>
    </div>
  )
}
