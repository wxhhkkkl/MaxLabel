/**
 * 会员版本与授权能力的唯一判定来源。
 *
 * 菜单、工具栏、快捷键和主进程保存守卫都消费这里的 `EntitlementState`，
 * 不在组件内另写“某版本能否使用某功能”的条件。
 */

export type Edition = 'none' | 'standard' | 'professional' | 'enterprise'

export type FeatureKey =
  | 'editDocuments'
  | 'print'
  | 'databaseSources'
  | 'batchDataSources'
  | 'printHistory'
  | 'cloudTemplates'
  | 'scripts'
  | 'scaleAutoPrint'
  | 'rfidObjects'
  | 'extendedBarcodeTypes'

export const FEATURE_KEYS: readonly FeatureKey[] = [
  'editDocuments',
  'print',
  'databaseSources',
  'batchDataSources',
  'printHistory',
  'cloudTemplates',
  'scripts',
  'scaleAutoPrint',
  'rfidObjects',
  'extendedBarcodeTypes'
]

export type FeatureSet = Record<FeatureKey, boolean>

/** 数据源类型 → 功能键的唯一映射；所有数据源入口共用。 */
export function dataSourceKindAllowed(kind: string, features: FeatureSet): boolean {
  if (kind === 'constant') return true
  if (kind === 'database') return features.databaseSources === true
  if (kind === 'serial' || kind === 'date' || kind === 'time' || kind === 'keyboard') {
    return features.batchDataSources === true
  }
  if (kind === 'script') return features.scripts === true
  return true
}

function featureSet(values: Partial<FeatureSet>): FeatureSet {
  return {
    editDocuments: false,
    print: true,
    databaseSources: false,
    batchDataSources: false,
    printHistory: false,
    cloudTemplates: false,
    scripts: false,
    scaleAutoPrint: false,
    rfidObjects: false,
    extendedBarcodeTypes: false,
    ...values
  }
}

/** 标准版 / 专业版 / 企业版的功能矩阵；未订阅（none）除打印外全部关闭。 */
export const FEATURE_MATRIX: Record<Edition, FeatureSet> = {
  none: featureSet({}),
  standard: featureSet({ editDocuments: true }),
  professional: featureSet({
    editDocuments: true,
    databaseSources: true,
    batchDataSources: true,
    printHistory: true
  }),
  enterprise: featureSet({
    editDocuments: true,
    databaseSources: true,
    batchDataSources: true,
    printHistory: true,
    cloudTemplates: true,
    scripts: true,
    scaleAutoPrint: true,
    rfidObjects: true,
    extendedBarcodeTypes: true
  })
}

export type DongleInvalidReason =
  | 'absent'
  | 'unwritten'
  | 'expired'
  | 'unreadable'
  | 'rejected'
  | 'unsupported'

export interface DongleState {
  present: boolean
  valid: boolean
  reason?: DongleInvalidReason
  identifierMasked?: string
  checkedAt: string
}

export interface EntitlementMemberInput {
  subscriptionActive?: boolean
  edition?: Edition | string | null
  subscriptionEndTime?: string | null
  subscriptionEndDate?: string | null
}

export interface EntitlementInput {
  member?: EntitlementMemberInput | null
  dongle: DongleState
  /** 本次判定是否来自离线快照。 */
  offline?: boolean
  /** 便于测试注入当前时间（毫秒）。 */
  now?: number
}

export interface EntitlementState {
  editable: boolean
  edition: Edition
  editionLabel: string
  source: 'none' | 'member' | 'dongle' | 'member+dongle'
  features: FeatureSet
  subscriptionActive: boolean
  expiresAt?: string | null
  offline: boolean
  dongle: DongleState
  checkedAt: string
}

const EDITION_LABELS: Record<Edition, string> = {
  none: '未订阅',
  standard: '标准版',
  professional: '专业版',
  enterprise: '企业版'
}

const DONGLE_LABEL = '加密狗（全部功能）'

export const ABSENT_DONGLE: DongleState = {
  present: false,
  valid: false,
  reason: 'absent',
  checkedAt: ''
}

export function isEdition(value: unknown): value is Edition {
  return value === 'none' || value === 'standard' || value === 'professional' || value === 'enterprise'
}

function subscriptionIsActive(member: EntitlementMemberInput | null | undefined, now: number): boolean {
  if (!member || member.subscriptionActive !== true) return false
  if (!isEdition(member.edition) || member.edition === 'none') return false
  if (typeof member.subscriptionEndTime === 'string' && member.subscriptionEndTime.trim()) {
    const end = Date.parse(member.subscriptionEndTime)
    if (Number.isFinite(end) && now > end) return false
  } else if (typeof member.subscriptionEndDate === 'string' && member.subscriptionEndDate.trim()) {
    const end = Date.parse(`${member.subscriptionEndDate.trim()}T23:59:59.999`)
    if (Number.isFinite(end) && now > end) return false
  }
  return true
}

function memberEdition(member: EntitlementMemberInput | null | undefined): Edition {
  return member && isEdition(member.edition) ? member.edition : 'none'
}

/**
 * 计算授权状态。规则（见 spec FR-016/FR-026/FR-033）：
 * - 有效加密狗：全部功能；与会员同时存在时来源为 member+dongle；
 * - 有效会员订阅：按版本矩阵；
 * - 两者都没有：只读（打印仍允许）。
 */
export function resolveEntitlement(input: EntitlementInput): EntitlementState {
  const now = input.now ?? Date.now()
  const dongle = input.dongle
  const activeMember = subscriptionIsActive(input.member, now)
  const edition = activeMember ? memberEdition(input.member) : 'none'
  const dongleValid = dongle.valid === true

  if (dongleValid) {
    const both = activeMember
    return {
      editable: true,
      edition: both ? edition : 'enterprise',
      editionLabel: both ? EDITION_LABELS[edition] : DONGLE_LABEL,
      source: both ? 'member+dongle' : 'dongle',
      features: { ...FEATURE_MATRIX.enterprise },
      subscriptionActive: activeMember,
      expiresAt: activeMember ? input.member?.subscriptionEndTime ?? input.member?.subscriptionEndDate ?? null : null,
      offline: input.offline === true,
      dongle,
      checkedAt: new Date(now).toISOString()
    }
  }

  return {
    editable: activeMember,
    edition,
    editionLabel: EDITION_LABELS[edition],
    source: activeMember ? 'member' : 'none',
    features: { ...FEATURE_MATRIX[edition] },
    subscriptionActive: activeMember,
    expiresAt: activeMember ? input.member?.subscriptionEndTime ?? input.member?.subscriptionEndDate ?? null : null,
    offline: input.offline === true,
    dongle,
    checkedAt: new Date(now).toISOString()
  }
}

/** 主进程首次回报前的保守状态：只读，允许打印。 */
export const DEFAULT_ENTITLEMENT: EntitlementState = resolveEntitlement({
  member: null,
  dongle: ABSENT_DONGLE,
  now: 0
})
