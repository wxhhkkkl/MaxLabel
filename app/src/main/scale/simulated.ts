import type { ScaleTransport } from './transport'

export type SimulationMode =
  | 'stable'
  | 'unstable'
  | 'overload'
  | 'underload'
  | 'zero'
  | 'negative'
  | 'malformed'
  | 'disconnected'

const SIM_MODES: readonly SimulationMode[] = [
  'stable',
  'unstable',
  'overload',
  'underload',
  'zero',
  'negative',
  'malformed',
  'disconnected'
]

export function simulationModeFromEnv(): SimulationMode | null {
  const value = String(process.env['MAXLABEL_SCALE_SIM'] ?? '').trim() as SimulationMode
  return SIM_MODES.includes(value) ? value : null
}

function standardFrames(mode: SimulationMode, value: number, unit: string): string[] {
  const formatted = `${Math.abs(value).toFixed(3)}${unit}`
  switch (mode) {
    case 'stable':
      return [`ST,GS,+${formatted}\r\n`]
    case 'unstable':
      return [`US,GS,+${formatted}\r\n`, `US,GS,+${formatted}\r\n`]
    case 'overload':
      return ['OL\r\n']
    case 'underload':
      return ['UL\r\n']
    case 'zero':
      return ['ST,GS,+000.000kg\r\n']
    case 'negative':
      return ['ST,GS,-001.234kg\r\n']
    case 'malformed':
      return ['ST,GS,+00x.234kg\r\n']
    case 'disconnected':
      return []
  }
}

/** Scripted transport for development/E2E; enabled only by `MAXLABEL_SCALE_SIM`. */
export function createSimulatedTransport(mode: SimulationMode): ScaleTransport {
  const value = Number(process.env['MAXLABEL_SCALE_VALUE'] ?? '1.234')
  const unit = String(process.env['MAXLABEL_SCALE_UNIT'] ?? 'kg')
  const frames = standardFrames(mode, Number.isFinite(value) ? value : 1.234, unit)
  const listeners: Array<(chunk: string | Buffer) => void> = []
  let timer: ReturnType<typeof setInterval> | null = null
  let index = 0
  return {
    async open() {
      if (mode === 'disconnected') throw new Error('simulated scale disconnected')
    },
    onData(callback) {
      listeners.push(callback)
      if (timer) return
      timer = setInterval(() => {
        const frame = frames[index % Math.max(1, frames.length)]
        index += 1
        for (const listener of listeners) listener(frame)
      }, 200)
      timer.unref?.()
    },
    async close() {
      if (timer) clearInterval(timer)
      timer = null
    }
  }
}
