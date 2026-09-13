export type CommandSet = 'tspl' | 'zpl' | 'cpcl'
export type PortType = 'driver' | 'file' | 'tcp' | 'com' | 'lpt' | 'usb' | 'bluetooth'

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
