export type CommandSet = 'tspl' | 'zpl' | 'cpcl'
export type PortType = 'driver' | 'file' | 'tcp' | 'com' | 'lpt' | 'usb' | 'bluetooth'

export const COMMON_BAUD_RATES = [9600, 19200, 38400, 57600, 115200] as const

export interface PortConfig {
  type: PortType
  /** Parallel printer device, e.g. LPT1. */
  lptPort?: string
  tcpHost?: string
  tcpPort?: number
  comPort?: string
  baudRate?: number
  encoding: 'utf8' | 'gbk'
}

/**
 * Validate the fields that are meaningful for a LabelShop output port.
 * Keeping this in the shared domain lets the editor and the IPC boundary
 * present the same rules instead of accepting a value in one place and
 * rejecting it only when a job is already being sent.
 */
export function portConfigError(port: PortConfig): string | undefined {
  if (port.type === 'tcp') {
    const host = port.tcpHost?.trim() ?? ''
    if (!host) return 'TCP 地址不能为空'
    if (!/^(?:\[[0-9a-f:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/i.test(host)) return 'TCP 地址格式无效'
    const tcpPort = port.tcpPort ?? 9100
    if (!Number.isInteger(tcpPort) || tcpPort < 1 || tcpPort > 65535) return 'TCP 端口超出范围（1-65535）'
  }
  if (port.type === 'com' || port.type === 'bluetooth') {
    if (!/^COM[1-9][0-9]*$/i.test(port.comPort?.trim() ?? '')) return '请选择有效的串口（例如 COM3）'
    const baudRate = port.baudRate ?? 115200
    if (!Number.isInteger(baudRate) || baudRate < 300 || baudRate > 4000000) return '波特率超出范围（300-4000000）'
  }
  if (port.type === 'lpt' && !/^LPT[1-9][0-9]*$/i.test(port.lptPort?.trim() || 'LPT1')) return 'LPT 端口名称无效（例如 LPT1）'
  return undefined
}

export interface PrinterConfig {
  driver: CommandSet
  /** 可选的机型/固件能力档案；generic 表示只按协议标准判断。 */
  profile?: string
  model?: string
  firmware?: string
  dpi: number
  speed: number
  density: number
  printMode: 'default' | 'thermal' | 'transfer'
  labelType: 'default' | 'gap' | 'continuous' | 'mark'
  topOffsetMm: number
  mediaHandle: 'tear' | 'peel' | 'cut' | 'none'
  backfeedMm: number
  preCmd?: string
  contentCmd?: string
  postCmd?: string
  saveAsDefault?: boolean
  port: PortConfig
  /** Target Windows printer stored with the template, matching LabelShop's
   * printer binding. Only used when port.type === 'driver'. */
  printerName?: string
}

export function defaultPrinterConfig(): PrinterConfig {
  return {
    driver: 'tspl',
    dpi: 203,
    speed: 4,
    density: 8,
    printMode: 'thermal',
    labelType: 'gap',
    topOffsetMm: 0,
    mediaHandle: 'tear',
    backfeedMm: 0,
    port: { type: 'driver', encoding: 'utf8' }
  }
}

export type DbDriver = 'sqlserver' | 'mysql' | 'sqlite' | 'dsn'

export interface DbConnectionConfig {
  id: string
  name: string
  driver: DbDriver
  dsn?: string
  server?: string
  database?: string
  user?: string
  password?: string
  filePath?: string
  timeoutSec?: number
  datasetName?: string
  autoRefresh?: boolean
  sql?: string
}
