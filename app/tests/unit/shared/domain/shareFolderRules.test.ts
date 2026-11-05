import { describe, expect, it } from 'vitest'
import {
  canDeleteFolder,
  canManageFolder,
  canWriteFolder,
  folderPermissionsConfigured,
  normalizeFolderMemberPermissions
} from '../../../../src/shared/domain/shareFolderRules'

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

  it('defaults unconfigured folders to all members with read-only access', () => {
    expect(folderPermissionsConfigured(0, [{ memberId: 1 }])).toBe(false)
    expect(normalizeFolderMemberPermissions([{ memberId: 1 }, { memberId: 2 }], false)).toEqual([
      { memberId: 1, visible: true, canEdit: false, canDelete: false },
      { memberId: 2, visible: true, canEdit: false, canDelete: false }
    ])
  })

  it('keeps explicit visibility and edit/delete grants when configured', () => {
    const members = [
      { memberId: 1, visible: true, canEdit: true, canDelete: false },
      { memberId: 2, visible: false, canEdit: false, canDelete: false }
    ]
    expect(folderPermissionsConfigured(2, members)).toBe(true)
    expect(folderPermissionsConfigured(0, [{ memberId: 1, visible: false }])).toBe(true)
    expect(normalizeFolderMemberPermissions(members, true)).toEqual(members)
  })
})
