export type ScaleProtocol =
  | 'kasda'
  | 'tonde'
  | 'ad'
  | 'mettler'
  | 'ohaus'
  | 'sartorius'
  | 'standard'
  | 'custom'

export type WeighUnit = 'g' | 'kg' | 'lb' | 'oz' | 'jin'

export type ScaleStatus = 'stable' | 'unstable' | 'overload' | 'underload' | 'zero' | 'negative'

/** One parsed frame. `unit` is omitted when the frame carries no unit token. */
export interface ParsedScaleFrame {
  value: number
  unit?: WeighUnit
  status: ScaleStatus
}

/** A usable reading injected into the label data source (formatted later). */
export interface ScaleReading {
  value: number
  unit: WeighUnit
  stable: true
  raw: string
  timestamp: number
}

export interface ScaleReadRequest {
  requestId: string
  protocol: ScaleProtocol
  port: string
  baud: string
  unit: WeighUnit
  decimals: number
  unitConv: boolean
  timeoutMs?: number
}

export type ScaleErrorKey =
  | 'error.scalePort'
  | 'error.scaleFrame'
  | 'error.scaleTimeout'
  | 'error.scaleInvalid'
  | 'error.scaleCustom'
  | 'error.scaleBusy'
  | 'error.invalidPayload'

export interface ScaleReadResult {
  ok: boolean
  canceled?: boolean
  reading?: ScaleReading
  message?: string
  messageKey?: ScaleErrorKey
  messageParams?: Record<string, string | number>
}

export interface ScaleTestRequest {
  protocol: ScaleProtocol
  port: string
  baud: string
  unit: WeighUnit
  decimals: number
  timeoutMs?: number
}

export interface ScaleTestResult {
  ok: boolean
  portOpened: boolean
  frames: string[]
  stable: boolean
  value?: number
  unit?: WeighUnit
  message?: string
  messageKey?: ScaleErrorKey
}

/** Default read timeout in milliseconds. */
export const DEFAULT_SCALE_TIMEOUT_MS = 5000
/** Maximum accepted timeout. */
export const MAX_SCALE_TIMEOUT_MS = 30000
export const SCALE_BAUD_RATES = ['2400', '4800', '9600', '19200', '38400'] as const
export const SCALE_PROTOCOLS: readonly ScaleProtocol[] = [
  'kasda',
  'tonde',
  'ad',
  'mettler',
  'ohaus',
  'sartorius',
  'standard',
  'custom'
]
export const SCALE_UNITS: readonly WeighUnit[] = ['g', 'kg', 'lb', 'oz', 'jin']
