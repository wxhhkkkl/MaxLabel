import { SCALE_BAUD_RATES, SCALE_PROTOCOLS, type ScaleProtocol } from './types'

/**
 * 电子称的**全局设备设置**（020）。
 *
 * 「全局一份」是所有者决定：协议 / 端口 / 速率属于设备，不是每张标签各配一遍。
 * 标签级语义（单位、小数位、是否换算、是否自动打印）仍在 `KeyboardSource.weigh*` 上。
 */
export interface ScaleSettings {
  protocol: ScaleProtocol
  /** 串口路径，如 COM3 或 /dev/ttyUSB0；空 = 尚未配置 */
  port: string
  baud: string
  /** 打开含称重数据源的模板时，自动做一次连接检查 */
  autoConnect: boolean
}

/** 一个可选的串口；`manufacturer` 用于在下拉里区分蓝牙串口等。 */
export interface ScalePortInfo {
  path: string
  manufacturer?: string
}

export const DEFAULT_SCALE_SETTINGS: ScaleSettings = {
  protocol: 'kasda',
  port: '',
  baud: '9600',
  autoConnect: false
}

/** 与主进程 `validateScaleReadPayload` 的端口长度上限一致 */
const MAX_PORT_LENGTH = 32

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

/** 归一化来自 localStorage 的不可信设置；任何越界都回退默认，不抛异常。 */
export function normalizeScaleSettings(value: unknown): ScaleSettings {
  if (!isRecord(value)) return { ...DEFAULT_SCALE_SETTINGS }
  const protocol = SCALE_PROTOCOLS.includes(value.protocol as ScaleProtocol)
    ? value.protocol as ScaleProtocol
    : DEFAULT_SCALE_SETTINGS.protocol
  const baud = SCALE_BAUD_RATES.includes(value.baud as typeof SCALE_BAUD_RATES[number])
    ? String(value.baud)
    : DEFAULT_SCALE_SETTINGS.baud
  const port = typeof value.port === 'string' ? value.port.trim().slice(0, MAX_PORT_LENGTH) : ''
  return { protocol, port, baud, autoConnect: value.autoConnect === true }
}
