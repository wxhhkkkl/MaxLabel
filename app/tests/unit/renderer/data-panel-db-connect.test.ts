// @vitest-environment jsdom
import { act } from 'react-dom/test-utils'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DataPanel from '@/dialogs/DataPanel'
import type { EntitlementState } from '@shared/domain/entitlement'

const ENTITLEMENT: EntitlementState = {
  editable: true,
  edition: 'professional',
  editionLabel: '专业版',
  source: 'member',
  features: {
    editDocuments: true,
    print: true,
    databaseSources: true,
    batchDataSources: true,
    printHistory: true,
    cloudTemplates: true,
    scripts: true,
    scaleAutoPrint: true,
    rfidObjects: true,
    extendedBarcodeTypes: true
  },
  subscriptionActive: true,
  expiresAt: null,
  offline: false,
  dongle: { present: false, valid: false, checkedAt: '2026-10-29T00:00:00.000Z' },
  checkedAt: '2026-10-29T00:00:00.000Z'
}

let root: Root | null = null
let container: HTMLDivElement | null = null

function installApi(overrides: Record<string, unknown> = {}) {
  ;(window as unknown as { maxlabel: unknown }).maxlabel = {
    entitlement: {
      status: async () => ({ ok: true, state: ENTITLEMENT }),
      onChanged: () => () => undefined
    },
    pickFile: vi.fn(async () => ({ ok: true, path: 'C:\\data\\demo.sqlite' })),
    db: {
      test: vi.fn(async () => ({ ok: true, message: '连接成功（SELECT 1 返回 1 行）' })),
      query: vi.fn(async () => ({ ok: true, rows: [{ name: 'orders' }] })),
      cancel: vi.fn(async () => ({ ok: true })),
      saveSecret: vi.fn(async () => ({ ok: true }))
    },
    ...overrides
  }
}

async function render() {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root!.render(
      createElement(DataPanel, {
        datasets: {},
        connections: {},
        onClose: () => undefined,
        onImport: () => undefined,
        onImportReplace: () => undefined,
        onDelete: () => undefined,
        onConnectionSave: () => undefined,
        onConnectionDelete: () => undefined,
        onRenameField: () => undefined
      } as never)
    )
  })
}

function setSelect(testId: string, value: string) {
  const el = document.querySelector(`[data-testid="${testId}"]`) as HTMLSelectElement
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!
  setter.call(el, value)
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

async function click(testId: string) {
  const el = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
  delete (window as unknown as { maxlabel?: unknown }).maxlabel
})

describe('数据库连接：选文件与选表', () => {
  it('SQLite 可以点「浏览…」用系统对话框选库文件', async () => {
    installApi()
    await render()
    await click('database-connection-new')
    await act(async () => setSelect('database-connection-driver', 'sqlite'))
    await click('database-connection-file-pick')

    const input = document.querySelector('[data-testid="database-connection-file"]') as HTMLInputElement
    expect(input.value).toBe('C:\\data\\demo.sqlite')
  })

  it('测试连接成功后列出可用的表，选中后自动生成整表 SQL', async () => {
    installApi()
    await render()
    await click('database-connection-new')
    await act(async () => setSelect('database-connection-driver', 'sqlite'))

    await click('database-connection-test')

    const select = document.querySelector('[data-testid="database-connection-table"]') as HTMLSelectElement
    expect(Array.from(select.options).map((option) => option.value)).toContain('orders')

    await act(async () => setSelect('database-connection-table', 'orders'))
    const textarea = document.querySelector('[data-testid="database-connection-sql"]') as HTMLTextAreaElement
    expect(textarea.value).toBe('SELECT * FROM "orders"')
  })
})
