// @vitest-environment jsdom
import { act } from 'react-dom/test-utils'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import FontSizeInput, { type FontSizePreset } from '@/editor/FontSizeInput'

const PRESETS: FontSizePreset[] = [8, 9, 10, 12, 14].map((value) => ({ value, label: String(value) }))

let root: Root | null = null
let container: HTMLDivElement | null = null
let committed: number[] = []

function render(pt: number): HTMLDivElement {
  committed = []
  if (!root || !container) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  }
  act(() => {
    root!.render(
      createElement(FontSizeInput, {
        pt,
        presets: PRESETS,
        onCommit: (value: number) => committed.push(value),
        testId: 'size'
      })
    )
  })
  return container
}

/** React 会劫持 input.value 的 setter，必须走原型上的原生 setter 才能让 onChange 看到变化。 */
function type(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function choose(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!
  act(() => {
    setter.call(select, value)
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

describe('FontSizeInput', () => {
  it('offers the common sizes in a dropdown while keeping the value typeable', () => {
    const el = render(12)
    const select = el.querySelector<HTMLSelectElement>('[data-testid="size-presets"]')
    expect(select).not.toBeNull()
    // 第一项是占位（当前值不在档位里时也显示空白），后面是常用字号
    expect([...select!.options].map((option) => option.value)).toEqual(['', '8', '9', '10', '12', '14'])
    expect(el.querySelector<HTMLInputElement>('[data-testid="size"]')!.value).toBe('12')
  })

  it('commits a preset picked from the dropdown', () => {
    const el = render(12)
    choose(el.querySelector<HTMLSelectElement>('[data-testid="size-presets"]')!, '14')
    expect(committed).toEqual([14])
  })

  it('still commits an arbitrary typed value on blur', () => {
    const el = render(12)
    const input = el.querySelector<HTMLInputElement>('[data-testid="size"]')!
    type(input, '7.88')
    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    expect(committed).toEqual([7.88])
  })
})
