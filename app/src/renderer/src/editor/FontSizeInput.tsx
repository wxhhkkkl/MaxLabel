import { useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { FONT_SIZE_MAX_PT, FONT_SIZE_MIN_PT, clampFontSizePt, formatFontSizePt } from './fontSizePt'

export interface FontSizePreset {
  /** 磅值 */
  value: number
  label: string
}

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
  listId: string
}

/**
 * 字号（磅）：可输入的组合框。
 *
 * 真机下拉是固定档位（格式栏 18 项 / 文字属性 31 项，8,9,10,11,12,14… 里没有 13），
 * 而 lsdx 的 `font/height` 是 1/100 磅的**任意值**（1300 = 13pt、788 = 7.88pt），导入后
 * 字号不在档位里，`<select>` 匹配不到选项就显示空白，也选不回来。这里把档位降级成
 * `datalist` 候选，输入框本身接受任意磅值。
 */
export default function FontSizeInput({
  pt, presets, onCommit, min = FONT_SIZE_MIN_PT, max = FONT_SIZE_MAX_PT,
  testId, title, accessKey, accessSuffix, disabled, empty, style, listId
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

  return (
    <>
      <input
        type="number"
        inputMode="decimal"
        step={0.1}
        min={min}
        max={max}
        list={listId}
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
        style={{ boxSizing: 'border-box', ...style }}
      />
      <datalist id={listId}>
        {presets.map((preset) => <option key={preset.label} value={preset.value}>{preset.label}</option>)}
      </datalist>
    </>
  )
}
