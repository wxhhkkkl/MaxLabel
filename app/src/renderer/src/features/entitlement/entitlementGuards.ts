import type { EntitlementState, FeatureKey } from '../../../../shared/domain/entitlement'

export type EntitlementTranslator = (key: string, params?: Record<string, string | number>) => string

export function isReadOnly(state: EntitlementState): boolean {
  return state.editable !== true
}

export function featureAllowed(state: EntitlementState, feature: FeatureKey): boolean {
  return state.features[feature] === true
}

/** 脚本是否允许执行：用户设置与会员版本矩阵同时满足。 */
export function effectiveAllowScript(configured: boolean, state: EntitlementState): boolean {
  return configured === true && state.features.scripts === true
}

/**
 * 只读/版本限制的统一守卫。返回 true 表示动作已执行。
 * 所有“写文档/写云端”的入口都应经过这里或 `guardFeature`。
 */
export function guardEdit(
  state: EntitlementState,
  tr: EntitlementTranslator,
  setStatus: (message: string) => void,
  action: () => void
): boolean {
  if (state.editable) {
    action()
    return true
  }
  setStatus(tr('entitlement.readOnly'))
  return false
}

export function guardFeature(
  state: EntitlementState,
  feature: FeatureKey,
  tr: EntitlementTranslator,
  setStatus: (message: string) => void,
  action: () => void
): boolean {
  if (state.features[feature]) {
    action()
    return true
  }
  setStatus(tr(state.editable ? 'entitlement.featureLocked' : 'entitlement.readOnly'))
  return false
}

export function featureLockLabel(tr: EntitlementTranslator): string {
  return `（${tr('entitlement.upgrade')}）`
}
