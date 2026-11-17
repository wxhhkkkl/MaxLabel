import { describe, expect, it } from 'vitest'
import { updateObjectsById } from '@shared/domain/objects'
import { textObject } from '../../../helpers/color'

describe('updateObjectsById', () => {
  it('把同一份补丁应用到多个对象', () => {
    const a = textObject({ id: 'a' })
    const b = textObject({ id: 'b' })
    const c = textObject({ id: 'c' })
    const next = updateObjectsById([a, b, c], ['a', 'c'], { bold: true })
    expect(next[0].type === 'text' && next[0].bold).toBe(true)
    expect(next[1].type === 'text' && next[1].bold).toBe(false)
    expect(next[2].type === 'text' && next[2].bold).toBe(true)
  })

  it('未知 id 保持文档不变，没有 id 时原样返回', () => {
    const a = textObject({ id: 'a' })
    expect(updateObjectsById([a], ['missing'], { bold: true })[0]).toBe(a)
    expect(updateObjectsById([a], [], { bold: true })[0]).toBe(a)
  })
})
