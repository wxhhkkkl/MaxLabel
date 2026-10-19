// Public transport facade. Platform implementations live in ./transports.
import type { PortConfig } from '../../shared/domain/printer'
import type { PrintTransportResult } from '../../shared/ipcContract'
import { transportAdapter } from './transports'
import { listWindowsPrinterDevices } from './transports/windows'

export type { WindowsPrinterDevice, WindowsPrinterFacts } from './transports/windows'
export { listWindowsPrinterDevices }

export function sendCommand(data: Buffer, port: PortConfig, signal?: AbortSignal): Promise<PrintTransportResult> {
  return transportAdapter.sendCommand(data, port, signal)
}

export async function listWindowsComPorts(): Promise<string[]> {
  return (await transportAdapter.listSerialPorts()).map((device) => device.path)
}

export function listWindowsUsbPrinterPorts(): Promise<string[]> {
  return transportAdapter.listUsbPrinterPorts()
}

export function listWindowsPrinterFacts() {
  return transportAdapter.listPrinterFacts()
}
