import type { PrinterConfig } from '../domain/printer'

export type ProtocolWarningSeverity = 'warning' | 'error'

export interface ProtocolWarning {
  code: string
  message: string
  severity: ProtocolWarningSeverity
  driver?: PrinterConfig['driver']
}

/** Adapter warning sink. Arrays remain supported for legacy fixture callers. */
export type WarningTarget = string[] | { add: (warning: ProtocolWarning) => void }

export function pushProtocolWarning(
  target: WarningTarget,
  code: string,
  message: string,
  severity: ProtocolWarningSeverity = 'warning'
): void {
  if (Array.isArray(target)) target.push(message)
  else target.add({ code, message, severity })
}

export class ProtocolWarningCollector {
  readonly entries: ProtocolWarning[] = []
  add(warning: ProtocolWarning): void { this.entries.push(warning) }
  get messages(): string[] { return this.entries.map((warning) => warning.message) }
}
