/** 企业文件夹的前端判定规则（与服务端口径保持一致）。 */
export interface FolderRuleInput {
  canManage?: boolean
  contentCount?: number | null
}

export function canManageFolder(folder: FolderRuleInput): boolean {
  return folder.canManage === true
}

/** 只有空文件夹可以删除；非空时按钮应禁用，服务端也会拒绝。 */
export function canDeleteFolder(folder: FolderRuleInput): boolean {
  return canManageFolder(folder) && (folder.contentCount ?? 0) === 0
}

/** 授权到期只读时，不允许新建/改名/删除文件夹。 */
export function canWriteFolder(folder: FolderRuleInput, readOnly: boolean): boolean {
  return !readOnly && canManageFolder(folder)
}

export interface FolderMemberRule {
  memberId: number
  visible?: boolean
  canEdit?: boolean
  canDelete?: boolean
}

export interface FolderMemberPermissionRule {
  memberId: number
  visible: boolean
  canEdit: boolean
  canDelete: boolean
}

/**
 * 企业文件夹成员权限：没有显式配置时，默认全部成员可访问且只读；
 * 一旦配置过（限制可见成员或授权编辑/删除），按服务端返回的字段展示。
 */
export function folderPermissionsConfigured(
  memberCount: number | null | undefined,
  members: ReadonlyArray<FolderMemberRule>
): boolean {
  return (memberCount ?? 0) > 0
    || members.some((member) => member.visible === false || member.canEdit === true || member.canDelete === true)
}

export function normalizeFolderMemberPermissions(
  members: ReadonlyArray<FolderMemberRule>,
  configured: boolean
): FolderMemberPermissionRule[] {
  return members.map((member) => ({
    memberId: member.memberId,
    visible: configured ? member.visible === true : true,
    canEdit: configured && member.canEdit === true,
    canDelete: configured && member.canDelete === true
  }))
}
