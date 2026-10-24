import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import type { MallMember } from '../shared/ipcContract'
import {
  ABSENT_DONGLE,
  DEFAULT_ENTITLEMENT,
  isEdition,
  resolveEntitlement,
  type DongleState,
  type Edition,
  type EntitlementState
} from '../shared/domain/entitlement'
import { FIXED_MALL_ORIGIN, MALL_TENANT_ID } from '../shared/config'
import { readMallCredential } from './mallCredentials'
import { readMallSession } from './mallAuth'
import { decryptSecureText, encryptSecureText, readSecureJson, updateSecureJson } from './secureJsonStore'

const SNAPSHOT_FILE = 'entitlement.json'
const SNAPSHOT_VERSION = 2
const CORRUPT = '授权快照损坏'

interface StoredSnapshot {
  version?: number
  /** 加密后的快照载荷；缺失/无法解密一律视为无快照。 */
  payload?: string
}

interface SnapshotPayload {
  version: number
  edition: Edition
  expiresAt: string | null
  checkedAt: string
  memberMasked: string
}

let broadcast: (state: EntitlementState) => void = () => {}
let currentMember: MallMember | null = null
let currentDongle: DongleState = ABSENT_DONGLE
let currentState: EntitlementState = DEFAULT_ENTITLEMENT
let testOverride: EntitlementState | null = null
let initialized = false
let testFileTimer: ReturnType<typeof setInterval> | null = null
let lastTestFileKey = ''

function memberInput(member: MallMember | null) {
  if (!member) return null
  return {
    subscriptionActive: member.subscriptionActive === true,
    edition: member.edition,
    subscriptionEndTime: member.subscriptionEndTime,
    subscriptionEndDate: member.subscriptionEndDate
  }
}

function compute(): EntitlementState {
  return resolveEntitlement({ member: memberInput(currentMember), dongle: currentDongle })
}

function publish(): EntitlementState {
  if (testOverride) currentState = testOverride
  else currentState = compute()
  broadcast(currentState)
  return currentState
}

function snapshotPayload(member: MallMember): SnapshotPayload | null {
  const edition = member.edition
  if (!edition || !isEdition(edition) || edition === 'none') return null
  return {
    version: SNAPSHOT_VERSION,
    edition,
    expiresAt: member.subscriptionEndTime ?? member.subscriptionEndDate ?? null,
    checkedAt: new Date().toISOString(),
    memberMasked: member.mobileMasked ?? ''
  }
}

async function saveSnapshot(member: MallMember | null): Promise<void> {
  if (!member) return
  const payload = snapshotPayload(member)
  if (!payload) return
  try {
    // 快照必须加密后落盘：明文快照可被用户改写版本/到期日来提升权限。
    const encoded = encryptSecureText(JSON.stringify(payload))
    await updateSecureJson<StoredSnapshot>(SNAPSHOT_FILE, { version: SNAPSHOT_VERSION }, CORRUPT, (store) => {
      store.version = SNAPSHOT_VERSION
      store.payload = encoded
    })
  } catch {
    // 无安全存储或保存失败：不写快照，离线时按未授权处理。
  }
}

async function readSnapshot(): Promise<MallMember | null> {
  let stored: StoredSnapshot
  try {
    stored = await readSecureJson<StoredSnapshot>(SNAPSHOT_FILE, { version: SNAPSHOT_VERSION }, CORRUPT)
  } catch {
    return null
  }
  // 旧版明文快照（version 1 / 直接字段）视为不可信，必须让用户重新在线校验。
  if (stored.version !== SNAPSHOT_VERSION || typeof stored.payload !== 'string' || !stored.payload) return null
  let payload: SnapshotPayload
  try {
    payload = JSON.parse(decryptSecureText(stored.payload)) as SnapshotPayload
  } catch {
    return null
  }
  if (payload.version !== SNAPSHOT_VERSION || !isEdition(payload.edition) || payload.edition === 'none') return null
  const expiresAt = typeof payload.expiresAt === 'string' ? payload.expiresAt : null
  if (expiresAt) {
    const end = Date.parse(expiresAt)
    if (Number.isFinite(end) && Date.now() > end) return null
  }
  return {
    userId: 0,
    mobileMasked: typeof payload.memberMasked === 'string' ? payload.memberMasked : '',
    edition: payload.edition,
    subscriptionActive: true,
    subscriptionEndTime: expiresAt,
    subscriptionEndDate: expiresAt
  }
}

function overrideForMode(value: string): EntitlementState | null {
  if (value === 'dongle') {
    return resolveEntitlement({ member: null, dongle: { present: true, valid: true, checkedAt: new Date().toISOString() } })
  }
  if (value === 'readonly') {
    return resolveEntitlement({ member: null, dongle: ABSENT_DONGLE })
  }
  if (isEdition(value) && value !== 'none') {
    return resolveEntitlement({
      member: {
        subscriptionActive: true,
        edition: value,
        subscriptionEndTime: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
      },
      dongle: ABSENT_DONGLE
    })
  }
  return null
}

function readTestOverride(): EntitlementState | null {
  if (app.isPackaged) return null
  const value = process.env.MAXLABEL_TEST_ENTITLEMENT?.trim()
  return value ? overrideForMode(value) : null
}

/** 仅测试：从文件读取动态授权模式，用于模拟编辑中授权失效/恢复。 */
async function readTestOverrideFile(): Promise<EntitlementState | null> {
  if (app.isPackaged) return null
  const file = process.env.MAXLABEL_TEST_ENTITLEMENT_FILE?.trim()
  if (!file) return null
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8')) as { mode?: unknown }
    return typeof parsed.mode === 'string' ? overrideForMode(parsed.mode) : null
  } catch {
    return null
  }
}

function startTestFilePolling(): void {
  if (testFileTimer || app.isPackaged || !process.env.MAXLABEL_TEST_ENTITLEMENT_FILE?.trim()) return
  testFileTimer = setInterval(() => {
    void readTestOverrideFile().then((next) => {
      const key = next ? JSON.stringify({ ...next, checkedAt: '' }) : ''
      if (key === lastTestFileKey) return
      lastTestFileKey = key
      testOverride = next
      publish()
    })
  }, 500)
  const unref = (testFileTimer as unknown as { unref?: () => void }).unref
  if (unref) unref.call(testFileTimer)
}

/** 主进程启动时调用：读取快照、尝试在线刷新，并注册变更广播。 */
export async function initEntitlementService(send: (state: EntitlementState) => void): Promise<void> {
  broadcast = send
  if (initialized) {
    publish()
    return
  }
  initialized = true
  // 动态文件优先于静态环境变量，便于测试模拟编辑中授权变化。
  testOverride = (await readTestOverrideFile()) ?? readTestOverride()
  if (testOverride) {
    startTestFilePolling()
    publish()
    return
  }

  const credential = await readMallCredential(FIXED_MALL_ORIGIN).catch(() => null)
  currentMember = credential?.member ?? null
  if (!currentMember) {
    currentMember = await readSnapshot()
  }
  publish()

  if (credential) {
    try {
      const member = await readMallSession({ baseUrl: FIXED_MALL_ORIGIN, tenantId: MALL_TENANT_ID })
      currentMember = member
      if (member) await saveSnapshot(member)
    } catch {
      // 网络/服务失败时保留快照与当前会员信息。
    }
    publish()
  }
}

/** 登录、续费、会话刷新成功后更新会员信息。 */
export function refreshEntitlementMember(member: MallMember | null): EntitlementState {
  if (testOverride) return publish()
  currentMember = member
  void saveSnapshot(member)
  return publish()
}

export function setDongleState(state: DongleState): EntitlementState {
  currentDongle = state
  return publish()
}

export function getEntitlementState(): EntitlementState {
  return currentState
}

export function stopEntitlementService(): void {
  if (testFileTimer) clearInterval(testFileTimer)
  testFileTimer = null
  broadcast = () => {}
  initialized = false
}

/** 测试用：重置模块状态（不写入快照）。 */
export function resetEntitlementServiceForTests(): void {
  if (testFileTimer) clearInterval(testFileTimer)
  testFileTimer = null
  lastTestFileKey = ''
  broadcast = () => {}
  currentMember = null
  currentDongle = ABSENT_DONGLE
  currentState = DEFAULT_ENTITLEMENT
  testOverride = null
  initialized = false
}
