import type { PortConfig } from '../../../shared/domain/printer'
import type { PrintTransportResult } from '../../../shared/ipcContract'

export interface SerialDevice {
  path: string
  manufacturer?: string
  serialNumber?: string
  vendorId?: string
  productId?: string
  accessible?: boolean
}

export interface UsbDevice {
  vendorId: number
  productId: number
  busNumber?: number
  deviceAddress?: number
  manufacturer?: string
  product?: string
  accessible?: boolean
}

export interface PrinterFacts {
  ports: Record<string, string>
  defaultName: string
}

export interface PlatformTransportAdapter {
  readonly kind: 'windows' | 'unix'
  sendCommand(data: Buffer, port: PortConfig, signal?: AbortSignal): Promise<PrintTransportResult>
  listSerialPorts(): Promise<SerialDevice[]>
  listUsbPrinterPorts(): Promise<string[]>
  listPrinterFacts(): Promise<PrinterFacts>
}
