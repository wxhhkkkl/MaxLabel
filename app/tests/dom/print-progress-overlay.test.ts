// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { flushSync } from 'react-dom'
import PrintProgressOverlay, { type PrintProgressValue } from '@/features/printing/PrintProgressOverlay'

let root: Root | null = null
let container: HTMLDivElement | null = null

function render(progress: PrintProgressValue | null, status = '正在发送打印任务（已发送 1/4 张）…') {
  if (!root || !container) {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  }
  flushSync(() => root!.render(createElement(PrintProgressOverlay, { progress, status })))
  return container
}

afterEach(() => {
  if (root) flushSync(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

describe('PrintProgressOverlay', () => {
  it('shows the status text and a determinate bar while printing', () => {
    const el = render({ done: 1, total: 4 })
    expect(el.querySelector('[data-testid="print-progress-overlay"]')).not.toBeNull()
    expect(el.querySelector('[data-testid="print-progress-label"]')?.textContent).toContain('已发送 1/4')
    const bar = el.querySelector<HTMLElement>('[data-testid="print-progress-bar"]')
    expect(bar?.style.width).toBe('25%')
    expect(el.querySelector('[data-testid="print-progress-percent"]')?.textContent).toBe('25%')
  })

  it('shows an indeterminate bar before the total is known', () => {
    const el = render({ done: 0, total: 0 })
    const bar = el.querySelector<HTMLElement>('[data-testid="print-progress-bar"]')
    expect(bar?.style.width).toBe('30%')
    expect(el.querySelector('[data-testid="print-progress-percent"]')).toBeNull()
  })

  it('renders nothing after the job finishes', () => {
    const el = render(null)
    expect(el.querySelector('[data-testid="print-progress-overlay"]')).toBeNull()
  })
})
