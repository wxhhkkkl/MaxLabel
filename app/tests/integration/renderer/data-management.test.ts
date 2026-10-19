import { describe, expect, it, vi } from 'vitest'
import { translate } from '@shared/i18n/translate'
import type { LabelDoc } from '@shared/domain/document'
import { normalizeDataset } from '@shared/domain/document'
import { useDataManagement } from '@/features/data/useDataManagement'
import type { DocTab } from '@/features/workspace/useDocumentWorkspace'

vi.mock('react', () => ({ useCallback: (fn: unknown) => fn }))

type QueryResolver = (result: { ok: boolean; rows: Array<Record<string, string>>; error?: string }) => void

function fixture() {
  let doc: LabelDoc = {
    version: 1,
    name: 'test',
    widthMm: 50,
    heightMm: 30,
    objects: [],
    connections: { db: { id: 'db', name: 'db', driver: 'sqlite', autoRefresh: true, sql: 'select', datasetName: 'db' } },
    datasets: { db: { name: 'db', columns: ['id'], rows: [['1']] } }
  }
  const requests: QueryResolver[] = []
  ;(globalThis as { window?: unknown }).window = {
    maxlabel: {
      db: {
        query: () => new Promise<{ ok: boolean; rows: Array<Record<string, string>> }>((resolve) => requests.push(resolve)),
        cancel: async () => ({ ok: true })
      }
    }
  }
  const tabsRef: { current: DocTab[] } = {
    current: [{
      key: 'tab',
      title: 'test',
      doc,
      selectedId: null,
      count: 1,
      printCount: 1,
      copies: 1,
      datasetName: '',
      zoom: 1,
      tool: 'select',
      recordIdx: 0,
      startLabel: 0,
      dirty: false,
      revision: 0
    }]
  }
  const statuses: string[] = []
  const management = useDataManagement({
    doc,
    active: 'tab',
    tabsRef,
    dbSecretOperationsRef: { current: new Map() },
    patchDocument: (_key, patch) => {
      doc = patch(doc)
      tabsRef.current[0] = { ...tabsRef.current[0], doc, revision: tabsRef.current[0].revision + 1 }
    },
    applyDocument: (patch) => {
      doc = patch(doc)
    },
    resetMutationGrouping: () => undefined,
    saveDbSecret: async () => undefined,
    setStatus: (status) => statuses.push(status),
    tr: (key, params) => translate('zh-CN', key, params)
  })
  return {
    management,
    requests,
    tabsRef,
    statuses,
    read: () => doc,
    edit(patch: (doc: LabelDoc) => LabelDoc) {
      doc = patch(doc)
      tabsRef.current[0] = { ...tabsRef.current[0], doc, revision: tabsRef.current[0].revision + 1 }
    }
  }
}

describe('database auto-refresh', () => {
  it.each([
    ['dataset import', (f: ReturnType<typeof fixture>) => f.edit((doc) => ({ ...doc, datasets: { ...doc.datasets, imported: { name: 'imported', columns: ['id'], rows: [['3']] } } }))],
    ['dataset deletion', (f: ReturnType<typeof fixture>) => f.edit((doc) => ({ ...doc, datasets: {} }))],
    ['row edit', (f: ReturnType<typeof fixture>) => f.edit((doc) => ({ ...doc, datasets: { db: { ...doc.datasets!.db, rows: [['99']] } } }))],
    ['tab close', (f: ReturnType<typeof fixture>) => { f.tabsRef.current = [] }]
  ])('cancels when the document changes (%s)', async (_label, mutate) => {
    const f = fixture()
    const pending = f.management.refreshAutoDb()
    await Promise.resolve()
    mutate(f)
    const expected = f.read()
    f.requests[0]({ ok: true, rows: [{ id: '2' }] })
    expect((await pending).error).toMatch(/取消刷新/)
    expect(f.read()).toBe(expected)
  })

  it('keeps the latest request and ignores the stale one', async () => {
    const f = fixture()
    const first = f.management.refreshAutoDb()
    const second = f.management.refreshAutoDb()
    await Promise.resolve()
    f.requests[1]({ ok: true, rows: [{ id: '3' }] })
    expect((await second).error).toBeNull()
    f.requests[0]({ ok: true, rows: [{ id: '2' }] })
    expect((await first).error).toMatch(/取消刷新/)
    expect(f.read().datasets?.db.rows).toEqual([['3']])
  })

  it('uses the print-specific cancellation message when a revision is expected', async () => {
    const f = fixture()
    const pending = f.management.refreshAutoDb(f.read(), 'tab', 0)
    await Promise.resolve()
    f.edit((doc) => ({ ...doc, name: 'edited' }))
    f.requests[0]({ ok: true, rows: [{ id: '2' }] })
    expect((await pending).error).toMatch(/取消打印/)
  })
})

describe('dataset column normalization and field rename', () => {
  it('guarantees globally unique, independently addressable and idempotent columns', () => {
    for (const columns of [['id', 'id', 'id_2'], ['id', 'id', 'id_2', 'id_3', 'id'], [' id ', 'id', 'id_2'], ['', '列1', '列1_2']]) {
      const dataset = normalizeDataset({ name: 'db', columns, rows: [columns.map((_, index) => String(index))] }, 'db')
      expect(new Set(dataset.columns).size).toBe(columns.length)
      for (const [index, field] of dataset.columns.entries()) {
        expect(dataset.rows[0][dataset.columns.indexOf(field)]).toBe(String(index))
      }
      expect(normalizeDataset(dataset, 'db')).toEqual(dataset)
    }
    expect(normalizeDataset({ name: 'db', columns: ['id', 'id', 'id_2'], rows: [] }, 'db').columns).toEqual(['id', 'id_3', 'id_2'])
  })

  it('rejects invalid renames and updates columns and object bindings', () => {
    let doc: LabelDoc = {
      version: 1,
      name: 'rename',
      widthMm: 50,
      heightMm: 30,
      datasets: { db: { name: 'db', columns: ['id', 'price'], rows: [['A', '100']] } },
      objects: [{ id: 'text', type: 'text', x: 0, y: 0, w: 10, h: 5, rotation: 0, fontFamily: 'Arial', fontSize: 3, bold: false, align: 'left', color: '#000', source: { kind: 'database', dataset: 'db', field: 'price' } }]
    }
    const statuses: string[] = []
    const management = useDataManagement({
      doc,
      active: 'tab',
      tabsRef: { current: [] },
      dbSecretOperationsRef: { current: new Map() },
      patchDocument: () => undefined,
      applyDocument: (patch) => {
        doc = patch(doc)
      },
      resetMutationGrouping: () => undefined,
      saveDbSecret: async () => undefined,
      setStatus: (status) => statuses.push(status),
      tr: (key, params) => translate('zh-CN', key, params)
    })

    const before = doc
    for (const name of ['id', ' id ', '', 'x'.repeat(4097)]) {
      management.handleRenameField('db', 'price', name)
      expect(doc).toBe(before)
      expect(statuses.at(-1)).toMatch(/失败/)
    }

    management.handleRenameField('db', 'price', ' amount ')
    expect(doc.datasets?.db.columns).toEqual(['id', 'amount'])
    expect((doc.objects[0] as { source: { field: string } }).source.field).toBe('amount')
    expect(doc.datasets?.db.rows).toEqual([['A', '100']])

    management.handleRenameField('db', 'amount', 'total')
    expect(doc.datasets?.db.columns).toEqual(['id', 'total'])
    expect((doc.objects[0] as { source: { field: string } }).source.field).toBe('total')
  })
})
