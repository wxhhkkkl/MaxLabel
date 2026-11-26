import { getEntitlementState } from '../entitlementService'

const READ_ONLY_MESSAGE = '当前为只读状态：请登录有效会员或插入授权加密狗'

/** 会写用户数据的 IPC 入口统一使用：只读状态下拒绝写入。 */
export function assertEditable(): void {
  if (getEntitlementState().editable) return
  const error = new Error(READ_ONLY_MESSAGE) as Error & { messageKey?: string }
  error.messageKey = 'error.entitlementReadOnly'
  throw error
}
