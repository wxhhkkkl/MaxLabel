import { useCallback, useEffect, useRef, useState } from 'react'
import type { LabelDoc } from '../../../../shared/domain'
import { translate } from '../../../../shared/i18n/translate'
import type { Language } from '../../../../shared/i18n/types'
import {
  DEFAULT_SCALE_CLIENT,
  resolveWeights,
  ScaleResolutionError,
  scaleErrorMessage,
  type ScaleReadClient
} from './resolveWeights'

export interface AutoPrintLoopOptions {
  doc: LabelDoc
  language: Language
  /** Runs the normal print action for exactly one logical label. */
  printOne: (scaleValues: Record<string, string[]>) => Promise<void>
  onStatus: (message: string) => void
  /** Notifies the UI when the loop starts or stops (including error stops). */
  onStateChange?: (active: boolean) => void
  client?: ScaleReadClient
}

export interface AutoPrintLoop {
  start: () => void
  stop: () => void
  isActive: () => boolean
}

/**
 * Stable reading -> exactly one logical label -> next reading. The print count is
 * ignored while active; stopping aborts the pending read and releases the port.
 */
export function createAutoPrintLoop(options: AutoPrintLoopOptions): AutoPrintLoop {
  let running = false
  let generation = 0
  let controller: AbortController | null = null
  const client = options.client ?? DEFAULT_SCALE_CLIENT

  const stop = (): void => {
    if (!running) return
    running = false
    generation += 1
    controller?.abort()
    controller = null
    options.onStateChange?.(false)
  }

  const run = async (current: number, signal: AbortSignal): Promise<void> => {
    while (running && generation === current) {
      let values: Record<string, string[]>
      try {
        values = await resolveWeights(options.doc, { count: 1, language: options.language, signal, client })
      } catch (error) {
        if (!running || signal.aborted || (error instanceof ScaleResolutionError && error.canceled)) return
        options.onStatus(scaleErrorMessage(options.language, error))
        stop()
        return
      }
      if (!running || signal.aborted || generation !== current) return
      try {
        await options.printOne(values)
      } catch (error) {
        if (!running || signal.aborted) return
        options.onStatus(scaleErrorMessage(options.language, error))
        stop()
        return
      }
    }
  }

  const start = (): void => {
    if (running) return
    running = true
    generation += 1
    controller = new AbortController()
    options.onStatus(translate(options.language, 'scale.autoActive'))
    options.onStateChange?.(true)
    void run(generation, controller.signal)
  }

  return { start, stop, isActive: () => running }
}

/** React wrapper: owns the loop lifetime and re-renders the active flag. */
export function useAutoPrint(createOptions: () => AutoPrintLoopOptions | null) {
  const loopRef = useRef<AutoPrintLoop | null>(null)
  const createRef = useRef(createOptions)
  createRef.current = createOptions
  const [active, setActive] = useState(false)

  const stop = useCallback(() => {
    loopRef.current?.stop()
    loopRef.current = null
    setActive(false)
  }, [])

  const start = useCallback(() => {
    const options = createRef.current()
    if (!options) return
    loopRef.current?.stop()
    loopRef.current = createAutoPrintLoop({ ...options, onStateChange: setActive })
    loopRef.current.start()
  }, [])

  useEffect(() => () => { loopRef.current?.stop() }, [])

  return { active, start, stop }
}
