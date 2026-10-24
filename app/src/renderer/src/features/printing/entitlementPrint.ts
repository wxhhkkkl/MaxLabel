import type { EntitlementState } from '../../../../shared/domain/entitlement'

export interface SerialBumpResult {
  ok: boolean
  message?: string
}

export type BumpSerial = (
  tabKey: string,
  count: number,
  expectedRevision: number,
  savePath?: string
) => Promise<SerialBumpResult>

/**
 * 只读状态允许打印，但不得推进序列号或触发自动保存。
 * 返回一个不变更文档的 bumpSerial；可编辑时沿用真实实现。
 */
export function serialBumpFor(entitlement: EntitlementState, bumpSerial: BumpSerial): BumpSerial {
  if (entitlement.editable) return bumpSerial
  return async () => ({ ok: true })
}
