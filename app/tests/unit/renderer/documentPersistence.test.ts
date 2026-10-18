import { describe, expect, it } from 'vitest'
import {
  assertDocumentSavePathAvailable,
  canonicalDocumentPath,
  confirmDocumentClosures,
  DocumentSaveQueue,
  savedTemplatePath
} from '@/features/workspace/documentPersistence'

describe('savedTemplatePath', () => {
  it('distinguishes cancel, failure and missing paths', () => {
    expect(() => savedTemplatePath({ canceled: false, message: 'disk full' })).toThrow(/disk full/)
    expect(() => savedTemplatePath({ ok: false, filePath: 'old.msdx' })).toThrow(/保存失败/)
    expect(() => savedTemplatePath({ canceled: false })).toThrow(/保存路径/)
    expect(savedTemplatePath({ canceled: true })).toBeNull()
    expect(savedTemplatePath({ ok: true, filePath: 'new.msdx' })).toBe('new.msdx')
  })
})

describe('DocumentSaveQueue', () => {
  it('serializes per document, does not block other documents and recovers after failure', async () => {
    const queue = new DocumentSaveQueue()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const events: string[] = []
    let serial = 1

    const saving = queue.run('doc', async () => {
      events.push(`save:${serial}`)
      await gate
    })
    const bumping = queue.run('doc', async () => {
      serial++
      events.push(`serial:${serial}`)
    })
    const savingAgain = queue.run('doc', async () => {
      events.push(`save:${serial}`)
    })
    await queue.run('other-doc', async () => {
      events.push('other')
    })

    expect(events).toEqual(['save:1', 'other'])
    release()
    await Promise.all([saving, bumping, savingAgain])
    expect(events).toEqual(['save:1', 'other', 'serial:2', 'save:2'])

    await expect(queue.run('doc', async () => {
      throw new Error('disk full')
    })).rejects.toThrow('disk full')
    await expect(queue.run('doc', async () => 'recovered')).resolves.toBe('recovered')
  })
})

describe('close confirmation', () => {
  it('keeps other tabs and removes approved tabs', async () => {
    let tabs = [{ key: 'a', revision: 1 }, { key: 'b', revision: 1 }]
    const approved = await confirmDocumentClosures(['a'], () => tabs, async () => {
      tabs = [{ key: 'a', revision: 1 }, { key: 'b', revision: 2 }, { key: 'new', revision: 0 }]
      return true
    })
    expect(approved).not.toBeNull()
    if (!approved) return
    tabs = tabs.filter((tab) => !approved.has(tab.key))
    expect(tabs).toEqual([{ key: 'b', revision: 2 }, { key: 'new', revision: 0 }])
  })

  it('aborts when an already-confirmed tab changed while a later dialog was open', async () => {
    let tabs = [{ key: 'a', revision: 1 }, { key: 'b', revision: 1 }]
    const changed = await confirmDocumentClosures(['a', 'b'], () => tabs, async (tab) => {
      if (tab.key === 'b') tabs = tabs.map((item) => (item.key === 'a' ? { ...item, revision: 2 } : item))
      return true
    })
    expect(changed).toBeNull()
  })
})

describe('save path safety', () => {
  it('canonicalizes paths and rejects saving over another open tab', () => {
    expect(canonicalDocumentPath('D:\\Labels\\Folder\\..\\Test.msdx')).toBe(canonicalDocumentPath('d:/labels/test.msdx'))
    expect(canonicalDocumentPath('D:/labels/a.msdx')).not.toBe(canonicalDocumentPath('D:/labels/b.msdx'))

    const openTabs = [
      { key: 'a', path: 'D:/labels/a.msdx' },
      { key: 'b', path: 'D:/labels/b.msdx' }
    ]
    expect(() => assertDocumentSavePathAvailable(openTabs, 'a', 'd:\\labels\\B.msdx')).toThrow(/其他标签/)
    expect(() => assertDocumentSavePathAvailable(openTabs, 'a', 'D:/labels/a.msdx')).not.toThrow()
    expect(() => assertDocumentSavePathAvailable(openTabs, 'a', 'D:/labels/new.msdx')).not.toThrow()
  })
})
