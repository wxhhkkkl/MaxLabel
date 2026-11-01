import type { ScalePortInfo } from '../../shared/scale/settings'

/** 与 `validateScaleReadPayload` 的端口上限一致 */
const MAX_PORT_LENGTH = 32

/**
 * 归一化 `SerialPort.list()` 的返回。
 *
 * 它来自操作系统/驱动，形状不可信：可能重复、可能缺 `path`、可能夹带空串。
 * 先按 path 去重（保留首条，保住 manufacturer），再按路径排序，保证下拉顺序稳定。
 */
export function normalizeScalePortList(value: unknown): ScalePortInfo[] {
  if (!Array.isArray(value)) return []
  const byPath = new Map<string, ScalePortInfo>()
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    if (typeof record.path !== 'string') continue
    const path = record.path.trim().slice(0, MAX_PORT_LENGTH)
    if (!path || byPath.has(path)) continue
    const manufacturer = typeof record.manufacturer === 'string' && record.manufacturer.trim()
      ? record.manufacturer.trim()
      : undefined
    byPath.set(path, manufacturer ? { path, manufacturer } : { path })
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path))
}

/** 枚举本机串口；`serialport` 是可选原生依赖，按需加载。 */
export async function listSerialPorts(): Promise<ScalePortInfo[]> {
  const { SerialPort } = await import('serialport')
  return normalizeScalePortList(await SerialPort.list())
}
