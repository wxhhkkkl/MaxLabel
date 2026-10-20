import { describe, expect, it } from 'vitest'
import { editorAvailability } from '@/features/editor/editorAvailability'

const base = { isStart: false, hasDatabase: false, selectionCount: 0, selectedGroup: false }

describe('editor command availability', () => {
  it('disables document commands on the start page', () => {
    const availability = editorAvailability({ ...base, isStart: true })
    expect(availability.hasDocument).toBe(false)
    expect(availability.hasSelection).toBe(false)
    expect(availability.canDatabaseNavigate).toBe(false)
  })

  it('requires two selections for group, align and size', () => {
    expect(editorAvailability({ ...base, selectionCount: 1 }).canGroup).toBe(false)
    expect(editorAvailability({ ...base, selectionCount: 2 }).canGroup).toBe(true)
    expect(editorAvailability({ ...base, selectionCount: 1 }).canAlignObjects).toBe(false)
    expect(editorAvailability({ ...base, selectionCount: 2 }).canAlignObjects).toBe(true)
    expect(editorAvailability({ ...base, selectionCount: 2 }).canSizeObjects).toBe(true)
  })

  it('requires three selections for distribution', () => {
    expect(editorAvailability({ ...base, selectionCount: 2 }).canDistribute).toBe(false)
    expect(editorAvailability({ ...base, selectionCount: 3 }).canDistribute).toBe(true)
  })

  it('allows ungroup only for a single selected group', () => {
    expect(editorAvailability({ ...base, selectionCount: 1, selectedGroup: true }).canUngroup).toBe(true)
    expect(editorAvailability({ ...base, selectionCount: 2, selectedGroup: true }).canUngroup).toBe(false)
    expect(editorAvailability({ ...base, selectionCount: 1, selectedGroup: false }).canUngroup).toBe(false)
  })

  it('allows database navigation only with a document and a database', () => {
    expect(editorAvailability({ ...base, hasDatabase: true }).canDatabaseNavigate).toBe(true)
    expect(editorAvailability({ ...base, hasDatabase: true, isStart: true }).canDatabaseNavigate).toBe(false)
  })
})
