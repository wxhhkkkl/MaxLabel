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
