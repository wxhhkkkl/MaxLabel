import type { PlatformTransportAdapter } from './types'
import { windowsTransportAdapter } from './windows'
import { unixTransportAdapter } from './unix'

export type { PlatformTransportAdapter, PrinterFacts, SerialDevice, UsbDevice } from './types'
export { windowsTransportAdapter, unixTransportAdapter }

/** Select the adapter for a platform; exposed for tests and IO boundaries. */
export function createTransportAdapter(platform: NodeJS.Platform): PlatformTransportAdapter {
  return platform === 'win32' ? windowsTransportAdapter : unixTransportAdapter
}

export const transportAdapter = createTransportAdapter(process.platform)
