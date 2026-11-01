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

/** 与打印机做一次“查询-回读”的结果（计数器/状态等）。 */
export interface PrinterQueryResult {
  ok: boolean
  /** 打印机原始响应（ASCII/Latin-1 解码）。 */
  text?: string
  message?: string
  canceled?: boolean
}

export interface PrinterQueryOptions {
  /** 整次查询的超时（含连接）。 */
  timeoutMs?: number
  /** 收到首包后等待静默多久就结束读取。 */
  quietMs?: number
}

export interface PlatformTransportAdapter {
  readonly kind: 'windows' | 'unix'
  sendCommand(data: Buffer, port: PortConfig, signal?: AbortSignal): Promise<PrintTransportResult>
  /** 双向查询；不支持的端口返回 ok:false 并说明原因。 */
  queryCommand(data: Buffer, port: PortConfig, options?: PrinterQueryOptions, signal?: AbortSignal): Promise<PrinterQueryResult>
  listSerialPorts(): Promise<SerialDevice[]>
  listUsbPrinterPorts(): Promise<string[]>
  listPrinterFacts(): Promise<PrinterFacts>
}
