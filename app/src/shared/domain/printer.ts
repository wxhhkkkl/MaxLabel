export type CommandSet = 'tspl' | 'zpl' | 'cpcl'
export type PortType = 'driver' | 'file' | 'tcp' | 'com' | 'lpt' | 'usb' | 'bluetooth' | 'cloudbox'

export const COMMON_BAUD_RATES = [9600, 19200, 38400, 57600, 115200] as const

/**
 * 「打印机属性 → 端口 → 类型」下拉的全部取值与文字 —— 逐项照抄真机
 * `parity/reference/labelshop/probe-14-printer-props-combos.txt`（`<打印机名> 属性` 对话框，
 * 类型下拉 7 项：打印机端口(LPT) / 串行端口(COM) / 标准 TCP/IP 打印机端口 / USB 打印机端口 /
 * 蓝牙 / 蜂打打云盒 / 打印机驱动程序端口）。
 */
export const PORT_TYPE_OPTIONS: ReadonlyArray<{ value: PortType; label: string }> = [
  { value: 'lpt', label: '打印机端口(LPT)' },
  { value: 'com', label: '串行端口(COM)' },
  { value: 'tcp', label: '标准 TCP/IP 打印机端口' },
  { value: 'usb', label: 'USB 打印机端口' },
  { value: 'bluetooth', label: '蓝牙' },
  { value: 'cloudbox', label: '蜂打打云盒' },
  { value: 'driver', label: '打印机驱动程序端口' }
]

/** 真机「端口(O)」下拉里 USB 端口的显示格式：`USB001 (Gprinter GP-1324D)`（设备名折叠多余空格）。 */
export function formatUsbPrinterPort(portName: string, deviceName: string): string {
  const port = portName.trim()
  const device = deviceName.replace(/\s+/g, ' ').trim()
  return device ? `${port} (${device})` : port
}

export interface PortConfig {
  type: PortType
  /** Parallel printer device, e.g. LPT1. */
  lptPort?: string
  tcpHost?: string
  tcpPort?: number
  comPort?: string
  /** USB 打印机端口，形如 `USB001 (Gprinter GP-1324D)`（真机属性对话框的「端口(O)」）。 */
  usbPort?: string
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
  if (port.type === 'tcp' || port.type === 'cloudbox') {
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
  if (port.type === 'usb' && !(port.usbPort?.trim())) return '请选择 USB 打印机端口（可点「刷新USB端口」重新枚举）'
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
  /** SQL Server authentication mode; Windows integrated auth is the default. */
  authMode?: 'windows' | 'sql'
  dsn?: string
  server?: string
  database?: string
  user?: string
  password?: string
  filePath?: string
  timeoutSec?: number
  datasetName?: string
  tableName?: string
  autoRefresh?: boolean
  sql?: string
}
