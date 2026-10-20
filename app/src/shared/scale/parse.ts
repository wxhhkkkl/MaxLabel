import { SCALE_PROTOCOLS } from './protocols'
import type { ParsedScaleFrame, ScaleProtocol } from './types'

/**
 * Parse one complete frame. Returns null for malformed/unrecognised frames;
 * callers must never treat null as a weight.
 */
export function parseScaleFrame(protocol: ScaleProtocol, frame: string | Buffer): ParsedScaleFrame | null {
  const spec = SCALE_PROTOCOLS[protocol]
  if (!spec) return null
  return spec.parse(frame)
}

/** A value usable for a label: stable and strictly positive. */
export function isUsableReading(parsed: ParsedScaleFrame | null): parsed is ParsedScaleFrame & { status: 'stable' } {
  return parsed !== null && parsed.status === 'stable' && parsed.value > 0
}

/** True when two consecutive frames represent the same stable value. */
export function isSameStableValue(a: ParsedScaleFrame | null, b: ParsedScaleFrame | null): boolean {
  return isUsableReading(a) && isUsableReading(b) && a.value === b.value && (a.unit ?? null) === (b.unit ?? null)
}
