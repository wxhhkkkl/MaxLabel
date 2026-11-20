import { uid, type DataSource, type KeyboardSource, type LabelDoc } from '../../../../shared/domain'
import { compilePrintTemplate } from '../../../../shared/print/scene'
import { localizeIpcMessage } from '../../../../shared/i18n/translate'
import type { Language } from '../../../../shared/i18n/types'
import type { ScaleReadRequest, ScaleReadResult, ScaleReading } from '../../../../shared/scale/types'
import { DEFAULT_SCALE_TIMEOUT_MS } from '../../../../shared/scale/types'
import { normalizeScaleSettings, type ScaleSettings } from '../../../../shared/scale/settings'
import { readScaleSettings } from './scalePreferences'
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

/** Every unique electronic-scale source used by the printed objects. */
export function collectWeighSources(doc: LabelDoc, includeSuppressed = false): WeighSourceEntry[] {
  const found: WeighSourceEntry[] = []
  const seen = new Set<string>()
  const add = (source: DataSource | undefined): void => {
    if (!source || source.kind !== 'keyboard' || source.inputDevice !== 'weigh') return
    const label = source.label || '请输入'
    if (seen.has(label)) return
    seen.add(label)
    found.push({ label, source })
  }
  for (const object of compilePrintTemplate(doc, { includeSuppressed })) {
    if ('source' in object) add(object.source)
    for (const sub of ('subSources' in object ? object.subSources : undefined) ?? []) add(sub)
  }
  return found
}

export function hasWeighSources(doc: LabelDoc, includeSuppressed = false): boolean {
  return collectWeighSources(doc, includeSuppressed).length > 0
}

/** The configured label output target, or the scale-reported unit when conversion is off. */
export function formatScaleValue(source: KeyboardSource, reading: ScaleReading): string {
  const target = normalizeUnitToken(source.weighUnit) ?? 'kg'
  const reported = normalizeUnitToken(reading.unit) ?? target
  const convert = source.weighUnitConv === true
  const value = convert ? convertWeight(reading.value, reported, target) : reading.value
  return formatWeight(value, convert ? target : reported, source.weighDecimals ?? 2)
}

/**
 * 设备参数（协议 / 端口 / 速率）取**全局设置**；单位、小数位与换算属于标签语义，仍取数据源。
 * 020 之前这些设备参数挂在数据源上，现在全局一份，避免同一个秤在每张标签里重复配置。
 */
function requestFor(source: KeyboardSource, settings: ScaleSettings, requestId: string): ScaleReadRequest {
  const device = normalizeScaleSettings(settings)
  return {
    requestId,
    protocol: device.protocol,
    port: device.port,
    baud: device.baud,
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
  includeSuppressed?: boolean
  /** 全局设备设置；不传则读本地偏好（020） */
  settings?: ScaleSettings
}

async function readWeight(
  source: KeyboardSource,
  settings: ScaleSettings,
  options: Omit<ResolveWeightsOptions, 'count'>,
  mode?: ScaleReadRequest['mode']
): Promise<ScaleReading> {
  if (options.signal?.aborted) throw new ScaleResolutionError('status.exportCanceled', '', true)
  if (!settings.port) throw new ScaleResolutionError('error.scalePort', '')
  const client = options.client ?? DEFAULT_SCALE_CLIENT
  const requestId = uid()
  const cancel = () => { void client.cancel(requestId).catch(() => undefined) }
  options.signal?.addEventListener('abort', cancel, { once: true })
  try {
    const result = await client.read({ ...requestFor(source, settings, requestId), ...(mode ? { mode } : {}) })
    if (result.canceled || options.signal?.aborted) throw new ScaleResolutionError('status.exportCanceled', result.message ?? '', true)
    if (!result.ok || !result.reading) throw new ScaleResolutionError(result.messageKey ?? 'error.scaleFrame', result.message ?? '')
    return result.reading
  } finally {
    options.signal?.removeEventListener('abort', cancel)
  }
}

export async function readAutoPrintWeights(
  doc: LabelDoc,
  waitForUnload: boolean,
  options: Omit<ResolveWeightsOptions, 'count'>
): Promise<Record<string, string[]>> {
  const sources = collectWeighSources(doc, options.includeSuppressed)
  const first = sources[0]
  if (!first) throw new ScaleResolutionError('error.scaleFrame', '')
  const settings = normalizeScaleSettings(options.settings ?? readScaleSettings())
  const waitFor = async (mode: NonNullable<ScaleReadRequest['mode']>): Promise<ScaleReading> => {
    for (;;) {
      try {
        return await readWeight(first.source, settings, options, mode)
      } catch (error) {
        if (!(error instanceof ScaleResolutionError) || error.messageKey !== 'error.scaleWaiting') throw error
      }
    }
  }
  if (waitForUnload) await waitFor('unload')
  const reading = await waitFor('load')
  return Object.fromEntries(sources.map(({ label, source }) => [label, [formatScaleValue(source, reading)]]))
}

/**
 * Read one stable weight per weigh source for every logical label. Returns the
 * formatted, language-independent values keyed by data-source label.
 */
export async function resolveWeights(doc: LabelDoc, options: ResolveWeightsOptions): Promise<Record<string, string[]>> {
  const sources = collectWeighSources(doc, options.includeSuppressed)
  if (!sources.length) return {}
  const settings = normalizeScaleSettings(options.settings ?? readScaleSettings())
  const count = Math.max(1, Math.trunc(options.count))
  const values: Record<string, string[]> = {}
  for (const { label, source } of sources) {
    const row: string[] = []
    for (let labelIndex = 1; labelIndex <= count; labelIndex += 1) {
      row.push(formatScaleValue(source, await readWeight(source, settings, options)))
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
