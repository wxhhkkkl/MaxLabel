import { isUsableReading, parseScaleFrame } from '../../shared/scale/parse'
import {
  DEFAULT_SCALE_TIMEOUT_MS,
  MAX_SCALE_TIMEOUT_MS,
  type ParsedScaleFrame,
  type ScaleReadRequest,
  type ScaleReading,
  type ScaleErrorKey,
  type ScaleTestRequest,
  type ScaleTestResult
} from '../../shared/scale/types'
import { createSimulatedTransport, simulationModeFromEnv } from './simulated'
import { createSerialTransport, type ScaleTransport, type ScaleTransportFactory } from './transport'

export class ScaleError extends Error {
  constructor(public readonly messageKey: ScaleErrorKey, message: string) {
    super(message)
    this.name = 'ScaleError'
  }
}

export class ScaleCanceledError extends Error {
  constructor() {
    super('scale read canceled')
    this.name = 'ScaleCanceledError'
  }
}

let activeRead: { requestId: string; controller: AbortController } | null = null

async function defaultTransport(): Promise<ScaleTransport> {
  const mode = simulationModeFromEnv()
  return mode ? createSimulatedTransport(mode) : createSerialTransport()
}

/** Abort the active read; unknown/finished request ids are a no-op. */
export function cancelScaleRead(requestId: string): { ok: boolean; canceled: boolean } {
  if (!activeRead || activeRead.requestId !== requestId) return { ok: true, canceled: false }
  activeRead.controller.abort()
  return { ok: true, canceled: true }
}

/** Release the port on window close or application shutdown. */
export function cancelActiveScaleRead(): void {
  activeRead?.controller.abort()
}

function drainFrames(buffer: Buffer): { frames: Buffer[]; rest: Buffer } {
  const frames: Buffer[] = []
  let start = 0
  for (let index = 0; index < buffer.length; index += 1) {
    const byte = buffer[index]
    if (byte === 0x03 || byte === 0x0a) {
      frames.push(buffer.subarray(start, index + (byte === 0x03 ? 1 : 0)))
      start = index + 1
    }
  }
  return { frames, rest: buffer.subarray(start) }
}

function timeoutFor(value: number | undefined): number {
  const requested = value ?? DEFAULT_SCALE_TIMEOUT_MS
  return Math.max(1, Math.min(MAX_SCALE_TIMEOUT_MS, requested))
}

/** Read one stable weight. One read may be active at a time; the port always closes. */
export async function readScale(
  request: ScaleReadRequest,
  factory: ScaleTransportFactory = defaultTransport,
  externalSignal?: AbortSignal
): Promise<ScaleReading> {
  if (activeRead) throw new ScaleError('error.scaleBusy', 'another scale read is active')
  const controller = new AbortController()
  activeRead = { requestId: request.requestId, controller }
  const abort = () => controller.abort()
  externalSignal?.addEventListener('abort', abort, { once: true })
  let transport: ScaleTransport | null = null
  try {
    transport = await factory()
    return await new Promise<ScaleReading>((resolve, reject) => {
      let buffer: Buffer = Buffer.alloc(0)
      let previous: ParsedScaleFrame | null = null
      let settled = false
      const timer = setTimeout(() => finish(new ScaleError('error.scaleTimeout', 'no stable weight before timeout')), timeoutFor(request.timeoutMs))
      const onAbort = () => finish(new ScaleCanceledError())

      function cleanup(): void {
        clearTimeout(timer)
        controller.signal.removeEventListener('abort', onAbort)
      }
      function finish(error?: Error, reading?: ScaleReading): void {
        if (settled) return
        settled = true
        cleanup()
        if (error) reject(error)
        else if (reading) resolve(reading)
      }

      controller.signal.addEventListener('abort', onAbort, { once: true })
      transport!.onData((chunk) => {
        if (settled || controller.signal.aborted) return
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'latin1')
        buffer = Buffer.concat([buffer, bytes])
        const drained = drainFrames(buffer)
        buffer = drained.rest
        for (const frame of drained.frames) {
          const parsed = parseScaleFrame(request.protocol, frame)
          if (!parsed) continue
          if (parsed.status === 'overload' || parsed.status === 'underload' || parsed.status === 'zero' || parsed.status === 'negative') {
            finish(new ScaleError('error.scaleInvalid', `invalid scale status: ${parsed.status}`))
            return
          }
          if (!isUsableReading(parsed)) {
            previous = null
            continue
          }
          const unit = parsed.unit ?? request.unit
          if (previous && isUsableReading(previous) && previous.value === parsed.value && (previous.unit ?? request.unit) === unit) {
            finish(undefined, {
              value: parsed.value,
              unit,
              stable: true,
              raw: frame.toString('latin1').replace(/[\r\n\x02\x03]+/g, '').trim(),
              timestamp: Date.now()
            })
            return
          }
          previous = parsed
        }
      })
      transport!.open({ port: request.port, baud: request.baud }).catch((error) => {
        finish(new ScaleError('error.scalePort', error instanceof Error ? error.message : String(error)))
      })
    })
  } catch (error) {
    if (error instanceof ScaleError || error instanceof ScaleCanceledError) throw error
    throw new ScaleError('error.scalePort', error instanceof Error ? error.message : String(error))
  } finally {
    externalSignal?.removeEventListener('abort', abort)
    await transport?.close().catch(() => undefined)
    if (activeRead?.controller === controller) activeRead = null
  }
}

/** Open the port, collect a short diagnostic window and report stability. */
export async function testScale(
  request: ScaleTestRequest,
  factory: ScaleTransportFactory = defaultTransport
): Promise<ScaleTestResult> {
  if (activeRead) throw new ScaleError('error.scaleBusy', 'another scale read is active')
  let transport: ScaleTransport | null = null
  const frames: string[] = []
  try {
    transport = await factory()
    return await new Promise<ScaleTestResult>((resolve) => {
      let settled = false
      const finish = (result: ScaleTestResult) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(result)
      }
      const timer = setTimeout(() => finish({
        ok: false,
        portOpened: true,
        frames,
        stable: false,
        message: 'no stable weight before timeout',
        messageKey: 'error.scaleTimeout'
      }), Math.min(3000, timeoutFor(request.timeoutMs)))
      transport!.onData((chunk) => {
        if (settled) return
        const text = Buffer.isBuffer(chunk) ? chunk.toString('latin1') : chunk
        for (const frame of text.split(/\r\n|\r|\n|\x03/)) {
          if (!frame) continue
          if (frames.length < 10) frames.push(frame)
          const parsed = parseScaleFrame(request.protocol, frame)
          if (parsed && isUsableReading(parsed)) {
            finish({
              ok: true,
              portOpened: true,
              frames,
              stable: true,
              value: parsed.value,
              unit: parsed.unit ?? request.unit
            })
            return
          }
        }
      })
      transport!.open({ port: request.port, baud: request.baud }).catch((error) => {
        finish({
          ok: false,
          portOpened: false,
          frames,
          stable: false,
          message: error instanceof Error ? error.message : String(error),
          messageKey: 'error.scalePort'
        })
      })
    })
  } finally {
    await transport?.close().catch(() => undefined)
  }
}
