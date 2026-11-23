import { describe, expect, it } from 'vitest'
import type { GroupObj, LabelObject } from '@shared/domain/objects'
import { cloneWithFreshIds, objectClipboardHtml, objectClipboardText, readObjectClipboard } from '@/features/editor/objectClipboard'
import { clipboardReader, clipboardText, rectObject } from '../../helpers/canvas'
import { sampleDoc } from '../../helpers/factories'

const text = sampleDoc().objects.find((object) => object.type === 'text') as LabelObject

describe('object clipboard', () => {
  it('reads the MaxLabel envelope and a bare object array', async () => {
    const envelope = await readObjectClipboard(clipboardReader(clipboardText([text])), [])
    expect(envelope).toHaveLength(1)
    expect(envelope[0]).toMatchObject({ type: 'text', id: text.id })
    const bare = await readObjectClipboard(clipboardReader(JSON.stringify([text])), [])
    expect(bare).toHaveLength(1)
  })

  it('ignores non-MaxLabel, empty and malformed content', async () => {
    expect(await readObjectClipboard(clipboardReader('hello'), [])).toEqual([])
    expect(await readObjectClipboard(clipboardReader('{}'), [])).toEqual([])
    expect(await readObjectClipboard(clipboardReader('{bad json'), [])).toEqual([])
    expect(await readObjectClipboard(clipboardReader(JSON.stringify({ objects: [] })), [])).toEqual([])
  })

  it('keeps plain text readable while carrying objects in an HTML marker', async () => {
    const objects = [text]
    expect(objectClipboardText(objects)).toBe('示例商品标签')
    const html = objectClipboardHtml(objects)
    expect(html).toContain('示例商品标签')
    expect(html).toContain('<!--maxlabel-objects:')
    const restored = await readObjectClipboard(clipboardReader(null), [], async () => html)
    expect(restored).toHaveLength(1)
    expect(restored[0]).toMatchObject({ type: 'text', id: text.id })
  })

  it('falls back to the in-memory copy when the system clipboard is unavailable', async () => {
    expect(await readObjectClipboard(undefined, [text])).toHaveLength(1)
  })

  it('clones objects with fresh ids and a 1 mm offset', () => {
    const copy = cloneWithFreshIds(text)
    expect(copy.id).not.toBe(text.id)
    expect(copy.x).toBe(text.x + 1)
    expect(copy.y).toBe(text.y + 1)
    expect(copy).toMatchObject({ type: 'text' })
  })

  it('clones groups recursively', () => {
    const group: GroupObj = {
      id: 'g',
      type: 'group',
      x: 10,
      y: 10,
      w: 20,
      h: 10,
      rotation: 0,
      children: [rectObject('child', 12, 12, 5, 4)]
    }
    const copy = cloneWithFreshIds(group) as GroupObj
    expect(copy.id).not.toBe('g')
    expect(copy.x).toBe(11)
    expect(copy.children[0].id).not.toBe('child')
    expect(copy.children[0].x).toBe(13)
    expect(copy.children[0].y).toBe(13)
  })
})
