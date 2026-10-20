import type { ScaleTransport } from '@main/scale/transport'

export interface ScriptedTransportOptions {
  /** Reject open with this message. */
  openError?: string
  /** Delay between frames in milliseconds (default 0, emitted on next tick). */
  intervalMs?: number
}

/** In-memory transport used by lifecycle tests; emits frames to every listener. */
export class FakeScaleTransport implements ScaleTransport {
  readonly frames: string[]
  readonly opened: Array<{ port: string; baud: string }> = []
  closed = 0
  private listeners: Array<(chunk: string | Buffer) => void> = []
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(frames: string[], private readonly options: ScriptedTransportOptions = {}) {
    this.frames = frames
  }

  async open(options: { port: string; baud: string }): Promise<void> {
    if (this.options.openError) throw new Error(this.options.openError)
    this.opened.push(options)
    if (this.options.intervalMs === undefined) {
      for (const frame of this.frames) this.emit(frame)
      return
    }
    let index = 0
    this.timer = setInterval(() => {
      if (index >= this.frames.length) return
      this.emit(this.frames[index++])
    }, this.options.intervalMs)
    this.timer.unref?.()
  }

  onData(callback: (chunk: string | Buffer) => void): void {
    this.listeners.push(callback)
  }

  emit(frame: string): void {
    for (const listener of this.listeners) listener(frame)
  }

  async close(): Promise<void> {
    this.closed += 1
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }
}

/** Standard-protocol frames for the common simulator states. */
export const STANDARD_FRAMES = {
  stable: 'ST,GS,+001.234kg\r\n',
  stableAgain: 'ST,GS,+001.234kg\r\n',
  unstable: 'US,GS,+001.234kg\r\n',
  overload: 'OL\r\n',
  underload: 'UL\r\n',
  zero: 'ST,GS,+000.000kg\r\n',
  negative: 'ST,GS,-001.234kg\r\n',
  malformed: 'ST,GS,+00x.234kg\r\n',
  otherValue: 'ST,GS,+002.000kg\r\n'
} as const

/** Build a KASDA/TONDE text frame. */
export function kasdaTextFrame(value: string, unit = 'kg', stable = true): string {
  return `${stable ? 'ST' : 'US'},GS,${value}${unit}\r\n`
}

/**
 * Build a Yaohua-compatible 12-byte frame:
 * STX, status (bit0 stable, bit1 overload, bit2 negative), 6 ASCII digits,
 * decimals byte, XOR high/low nibbles as ASCII, ETX.
 */
export function kasdaBinaryFrame(value: number, decimals = 3, stable = true, negative = false, overload = false): Buffer {
  const digits = String(Math.round(Math.abs(value) * 10 ** decimals)).padStart(6, '0').slice(-6)
  let status = 0
  if (stable) status |= 0x01
  if (overload) status |= 0x02
  if (negative) status |= 0x04
  const body = [status, ...digits.split('').map((ch) => ch.charCodeAt(0)), 0x30 + decimals]
  const xor = body.reduce((acc, byte) => acc ^ byte, 0)
  const hex = xor.toString(16).toUpperCase().padStart(2, '0')
  return Buffer.from([0x02, ...body, hex.charCodeAt(0), hex.charCodeAt(1), 0x03])
}
