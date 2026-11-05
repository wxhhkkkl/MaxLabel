import { describe, expect, it } from 'vitest'
import { canDeleteFolder, canManageFolder, canWriteFolder } from '../../../../src/shared/domain/shareFolderRules'

describe('share folder rules', () => {
  it('only admins can manage folders', () => {
    expect(canManageFolder({ canManage: true })).toBe(true)
    expect(canManageFolder({ canManage: false })).toBe(false)
    expect(canManageFolder({})).toBe(false)
  })

  it('only empty folders can be deleted', () => {
    expect(canDeleteFolder({ canManage: true, contentCount: 0 })).toBe(true)
    expect(canDeleteFolder({ canManage: true, contentCount: null })).toBe(true)
    expect(canDeleteFolder({ canManage: true, contentCount: 3 })).toBe(false)
    expect(canDeleteFolder({ canManage: false, contentCount: 0 })).toBe(false)
  })

  it('read-only enterprise cannot write folders', () => {
    expect(canWriteFolder({ canManage: true }, true)).toBe(false)
    expect(canWriteFolder({ canManage: true }, false)).toBe(true)
    expect(canWriteFolder({ canManage: false }, false)).toBe(false)
  })
})
