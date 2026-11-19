import { useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import {
  FONT_SIZE_MAX_PT,
  FONT_SIZE_MIN_PT,
  clampFontSizePt,
  formatFontSizePt,
  type FontSizePreset
} from './fontSizePt'

export type { FontSizePreset }

interface Props {
  /** 当前字号（磅），来自模型；输入过程中未被覆盖时按它显示。 */
  pt: number
  presets: ReadonlyArray<FontSizePreset>
  /** 提交结果（磅）。与「常规」页的几何输入一致：离开输入框或回车才提交，避免逐键产生撤销记录。 */
  onCommit: (pt: number) => void
  min?: number
  max?: number
  testId?: string
  title?: string
  accessKey?: string
  accessSuffix?: string
  disabled?: boolean
  /** 没有选中文字对象时显示空白（格式栏在非文字对象上是禁用的）。 */
  empty?: boolean
  style?: CSSProperties
}

/**
 * 字号（磅）：可输入、也可从常用字号里选的组合框。
 *
 * 真机下拉是固定档位（格式栏 18 项 / 文字属性 31 项，8,9,10,11,12,14… 里没有 13），
 * 而 lsdx 的 `font/height` 是 1/100 磅的**任意值**（1300 = 13pt、788 = 7.88pt）。
 * Chromium 不支持（或极不稳定地支持）`input[type=number]` 的 `datalist`，所以档位放在
 * 一个透明的原生 `<select>` 里盖住右端箭头：下拉由浏览器绘制、不会被对话框滚出，
 * 输入框本身仍接受任意磅值。
 */
export default function FontSizeInput({
  pt, presets, onCommit, min = FONT_SIZE_MIN_PT, max = FONT_SIZE_MAX_PT,
  testId, title, accessKey, accessSuffix, disabled, empty, style
}: Props) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (raw: string): void => {
    const value = clampFontSizePt(raw)
    if (value === null) return
    const clamped = Math.min(max, Math.max(min, value))
    if (Math.abs(clamped - pt) > 0.0001) onCommit(clamped)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      commit(event.currentTarget.value)
      setDraft(null)
    } else if (event.key === 'Escape') {
      // 只撤销输入框里的草稿，不关闭外层属性对话框。
      event.stopPropagation()
      setDraft(null)
    }
  }

  // 组合框要撑满父级给它的宽度（表单列/网格列）；没有显式宽度时按 100%，
  // 否则输入框的原生默认宽度会把四列网格撑出对话框。
  const width = style?.width ?? '100%'
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width, minWidth: 0, boxSizing: 'border-box' }}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        data-testid={testId}
        title={title}
        accessKey={accessKey}
        data-access-suffix={accessSuffix}
        disabled={disabled}
        value={empty ? '' : (draft ?? formatFontSizePt(pt))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => {
          commit(event.target.value)
          setDraft(null)
        }}
        onKeyDown={onKeyDown}
        style={{ boxSizing: 'border-box', ...style, width, paddingRight: 24 }}
      />
      {/* 透明的原生 select：点箭头弹出浏览器自带的下拉，键盘/滚动行为都由浏览器处理。
          当前值不在档位里也不会显示成空白——它的显示值始终是空的，真实值在左边的输入框。 */}
      <select
        aria-label={title ?? '字号'}
        data-testid={testId ? `${testId}-presets` : undefined}
        value=""
        tabIndex={-1}
        disabled={disabled || empty}
        onChange={(event) => {
          const value = event.target.value
          // 复位显示值：否则连续两次选同一档位时浏览器认为值没变、不再触发 change。
          event.target.value = ''
          if (value !== '') commit(value)
        }}
        style={{ position: 'absolute', top: 0, right: 0, width: 22, height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }}
      >
        <option value="" />
        {presets.map((preset) => <option key={preset.label} value={preset.value}>{preset.label}</option>)}
      </select>
      <span aria-hidden="true" style={{ position: 'absolute', right: 7, fontSize: 8, lineHeight: 1, color: disabled || empty ? '#B9BCC2' : '#6B7280', pointerEvents: 'none' }}>▼</span>
    </span>
  )
}
