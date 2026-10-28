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

/**
 * 功能矩阵（2026-10-28 口径，对齐 `docs/软件功能需求清单.md` 的「级别」列）：
 *
 * - `none`：未登录——只能查看已有模板、不能编辑，打印仍允许；
 * - `standard`：**登录即可用**。清单里标「标准」的操作都在这一档：
 *   编辑、打印、数据源（常量/序列号/数据库/日期/时间/键盘/脚本）、
 *   数据库连接与选表选字段；
 * - `professional` / `enterprise`：凡付费来源（个人订阅 / 企业授权）与加密狗，
 *   一律**全部功能**——即清单里的「高级」项（扩展码制、数据源高级选项、
 *   数据库定位查找、打印高级选项、自定义格式）加上清单外的云模板、打印历史、
 *   电子秤、RFID。两者只在「来源」上不同（企业授权会在起始页显示企业名），
 *   能力完全一致，所以下面两份表逐项相同。
 */
export const FEATURE_MATRIX: Record<Edition, FeatureSet> = {
  none: featureSet({}),
  standard: featureSet({
    editDocuments: true,
    databaseSources: true,
    batchDataSources: true,
    scripts: true
  }),
  professional: featureSet({
    editDocuments: true,
    databaseSources: true,
    batchDataSources: true,
    printHistory: true,
    cloudTemplates: true,
    scripts: true,
    scaleAutoPrint: true,
    rfidObjects: true,
    extendedBarcodeTypes: true
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
 * 已登录会员的实际档位：
 * - 有效订阅且带合法版本 → 该版本（个人会员=专业版 / 企业授权=企业版）；
 * - 其余已登录情况（未付费、已过期、版本缺失/非法）→ 标准版（2026-10-26 口径）。
 */
function loggedInEdition(member: EntitlementMemberInput | null | undefined, now: number): Edition {
  if (!member) return 'none'
  if (subscriptionIsActive(member, now)) {
    const edition = memberEdition(member)
    if (edition !== 'none') return edition
  }
  return 'standard'
}

/**
 * 计算授权状态。规则（见 spec FR-016/FR-026/FR-033，2026-10-26 修订）：
 * - 有效加密狗：全部功能；与会员同时存在时来源为 member+dongle；
 * - 已登录会员：至少标准版（不能编辑的限制只针对未登录），有有效订阅时按订阅版本；
 * - 未登录且无加密狗：只读（打印仍允许）。
 */
export function resolveEntitlement(input: EntitlementInput): EntitlementState {
  const now = input.now ?? Date.now()
  const dongle = input.dongle
  const activeMember = subscriptionIsActive(input.member, now)
  const edition = loggedInEdition(input.member, now)
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

  const loggedIn = input.member != null
  return {
    editable: edition !== 'none',
    edition,
    editionLabel: EDITION_LABELS[edition],
    source: loggedIn ? 'member' : 'none',
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
