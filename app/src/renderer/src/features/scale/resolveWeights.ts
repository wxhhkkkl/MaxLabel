import { uid, type DataSource, type KeyboardSource, type LabelDoc, type LabelObject } from '../../../../shared/domain'
import { localizeIpcMessage } from '../../../../shared/i18n/translate'
import type { Language } from '../../../../shared/i18n/types'
import type { ScaleReadRequest, ScaleReadResult, ScaleReading } from '../../../../shared/scale/types'
import { DEFAULT_SCALE_TIMEOUT_MS } from '../../../../shared/scale/types'
import { convertWeight, formatWeight, normalizeUnitToken } from '../../../../shared/scale/units'

export class ScaleResolutionError extends Error {
  constructor(public readonly messageKey: string, public readonly rawMessage: string, public readonly canceled = false) {
    super(rawMessage || messageKey)
    this.name = 'ScaleResolutionError'
  }
}

export interface ScaleReadClient {
  read(payload: ScaleReadRequest): Promise<ScaleReadResult>
  cancel(requestId: string): Promise<unknown>
}

export interface WeighSourceEntry {
  label: string
  source: KeyboardSource
}

export const DEFAULT_SCALE_CLIENT: ScaleReadClient = {
  read: (payload) => window.maxlabel.scale.read(payload),
  cancel: (requestId) => window.maxlabel.scale.cancel(requestId)
}

/** Every unique electronic-scale source used by the label, in document order. */
export function collectWeighSources(doc: LabelDoc): WeighSourceEntry[] {
  const found: WeighSourceEntry[] = []
  const seen = new Set<string>()
  const add = (source: DataSource | undefined): void => {
    if (!source || source.kind !== 'keyboard' || source.inputDevice !== 'weigh') return
    const label = source.label || '请输入'
    if (seen.has(label)) return
    seen.add(label)
    found.push({ label, source })
  }
  const walk = (objects: LabelObject[]): void => {
    for (const object of objects) {
      if (object.type === 'group') {
        walk(object.children)
        continue
      }
      add(('source' in object ? object.source : undefined) as DataSource | undefined)
      for (const sub of ('subSources' in object ? object.subSources : undefined) ?? []) add(sub)
    }
  }
  walk(doc.objects)
  return found
}

export function hasWeighSources(doc: LabelDoc): boolean {
  return collectWeighSources(doc).length > 0
}

/** The configured label output target, or the scale-reported unit when conversion is off. */
export function formatScaleValue(source: KeyboardSource, reading: ScaleReading): string {
  const target = normalizeUnitToken(source.weighUnit) ?? 'kg'
  const reported = normalizeUnitToken(reading.unit) ?? target
  const convert = source.weighUnitConv === true
  const value = convert ? convertWeight(reading.value, reported, target) : reading.value
  return formatWeight(value, convert ? target : reported, source.weighDecimals ?? 2)
}

function requestFor(source: KeyboardSource, requestId: string): ScaleReadRequest {
  return {
    requestId,
    protocol: source.weighProtocol ?? 'kasda',
    port: (source.weighPort ?? '').trim(),
    baud: source.weighBaud ?? '9600',
    unit: normalizeUnitToken(source.weighUnit) ?? 'kg',
    decimals: source.weighDecimals ?? 2,
    unitConv: source.weighUnitConv === true,
    timeoutMs: DEFAULT_SCALE_TIMEOUT_MS
  }
}

export interface ResolveWeightsOptions {
  /** Number of logical labels that need a reading. */
  count: number
  language?: Language
  signal?: AbortSignal
  client?: ScaleReadClient
}

/**
 * Read one stable weight per weigh source for every logical label. Returns the
 * formatted, language-independent values keyed by data-source label.
 */
export async function resolveWeights(doc: LabelDoc, options: ResolveWeightsOptions): Promise<Record<string, string[]>> {
  const sources = collectWeighSources(doc)
  if (!sources.length) return {}
  const client = options.client ?? DEFAULT_SCALE_CLIENT
  const count = Math.max(1, Math.trunc(options.count))
  const values: Record<string, string[]> = {}
  for (const { label, source } of sources) {
    const row: string[] = []
    for (let labelIndex = 1; labelIndex <= count; labelIndex += 1) {
      if (options.signal?.aborted) throw new ScaleResolutionError('status.exportCanceled', '', true)
      const port = (source.weighPort ?? '').trim()
      if (!port) throw new ScaleResolutionError('error.scalePort', options.language ? localizeIpcMessage(options.language, { message: '', messageKey: 'error.scalePort' }) : '')
      const requestId = uid()
      const cancel = () => { void client.cancel(requestId).catch(() => undefined) }
      options.signal?.addEventListener('abort', cancel, { once: true })
      let result: ScaleReadResult
      try {
        result = await client.read(requestFor(source, requestId))
      } finally {
        options.signal?.removeEventListener('abort', cancel)
      }
      if (result.canceled || options.signal?.aborted) throw new ScaleResolutionError('status.exportCanceled', result.message ?? '', true)
      if (!result.ok || !result.reading) {
        throw new ScaleResolutionError(result.messageKey ?? 'error.scaleFrame', result.message ?? '')
      }
      row.push(formatScaleValue(source, result.reading))
    }
    values[label] = row
  }
  return values
}

/** Localized, user-facing text for a scale resolution failure. */
export function scaleErrorMessage(language: Language, error: unknown): string {
  if (error instanceof ScaleResolutionError) {
    if (error.canceled) return localizeIpcMessage(language, { message: '', messageKey: 'status.exportCanceled' })
    return localizeIpcMessage(language, { message: error.rawMessage, messageKey: error.messageKey })
  }
  return localizeIpcMessage(language, { message: error instanceof Error ? error.message : String(error) })
}
