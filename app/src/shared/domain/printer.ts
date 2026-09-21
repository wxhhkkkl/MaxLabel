export type CommandSet = 'tspl' | 'zpl' | 'cpcl'
export type PortType = 'driver' | 'file' | 'tcp' | 'com' | 'lpt' | 'usb' | 'bluetooth' | 'cloudbox'

export const COMMON_BAUD_RATES = [9600, 19200, 38400, 57600, 115200] as const

/**
 * 「打印机属性 → 端口 → 串行端口(COM)」的五个参数，选项与默认值逐项照抄真机
 * `parity/reference/labelshop/probe-18-com-port-combos.txt`：
 *   速率(B) 15 档（默认 9600）、数据位(D) 7/8（默认 8）、奇偶检验(P) 无/奇/偶/标志/空格（默认 无）、
 *   停止位(S) 1/1.5/2（默认 1）、流控制(F) 无/硬件（RTS/CTS）/软件（XON/XOFF）（默认 无）。
 */
export const SERIAL_BAUD_RATES = [1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 128000, 153600, 230400, 460800, 921600, 1500000, 2000000] as const
export const SERIAL_DEFAULT_BAUD_RATE = 9600
export const SERIAL_DATA_BITS = [7, 8] as const
export const SERIAL_PARITY_OPTIONS = [
  { value: 'none', label: '无' },
  { value: 'odd', label: '奇' },
  { value: 'even', label: '偶' },
  { value: 'mark', label: '标志' },
  { value: 'space', label: '空格' }
] as const
export const SERIAL_STOP_BITS_OPTIONS = [
  { value: 'one', label: '1' },
  { value: 'onePointFive', label: '1.5' },
  { value: 'two', label: '2' }
] as const
export const SERIAL_FLOW_OPTIONS = [
  { value: 'none', label: '无' },
  { value: 'rtsCts', label: '硬件（RTS/CTS）' },
  { value: 'xonXoff', label: '软件（XON/XOFF）' }
] as const
export type SerialParity = (typeof SERIAL_PARITY_OPTIONS)[number]['value']
export type SerialStopBits = (typeof SERIAL_STOP_BITS_OPTIONS)[number]['value']
export type SerialFlowControl = (typeof SERIAL_FLOW_OPTIONS)[number]['value']

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

/**
 * 从 `USB001 (Gprinter GP-1324D)` 里取出端口名 `USB001`。
 * 复刻版没有内置驱动，USB 指令输出要靠 Windows 打印后台（spooler）：先按端口名找到打印队列，再 raw 写入。
 */
export function usbPortName(label: string | undefined): string {
  const value = (label ?? '').trim()
  if (!value) return ''
  const matched = /^([A-Za-z0-9_.-]+)/.exec(value)
  return matched ? matched[1].toUpperCase() : ''
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
  /** 串行端口参数（真机「端口」页 COM 类型的 5 项），缺省即真机默认值。 */
  dataBits?: 7 | 8
  parity?: SerialParity
  stopBits?: SerialStopBits
  flowControl?: SerialFlowControl
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
    // 真机「端口」页选「蜂打打云盒」时，下拉内容就是发现结果：没发现云盒时显示「未检测到云盒」，
    // 页面**没有任何报错**，底排「确定」照样可用（同态并排图 parity/review/cmp-printerportbox-r119.png）。
    // 所以空主机名对云盒是正常态，不是校验失败——复刻版此前拿它当阻断错误（红字 + 禁用「保存」）属过度校验。
    // 主机名**格式**错了仍报错；标准 TCP/IP 端口本来就要求填地址，规则不变。
    // 真的拿空地址去打印时，发送链路会给「TCP 端口未配置主机 / IP 或端口号」这条更准确的提示
    // （见 main/printing/commandTransport.ts sendCommand），不会静默失败。
    if (port.type === 'tcp' && !host) return 'TCP 地址不能为空'
    if (host && !/^(?:\[[0-9a-f:]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/i.test(host)) return 'TCP 地址格式无效'
    const tcpPort = port.tcpPort ?? 9100
    if (!Number.isInteger(tcpPort) || tcpPort < 1 || tcpPort > 65535) return 'TCP 端口超出范围（1-65535）'
  }
  if (port.type === 'com' || port.type === 'bluetooth') {
    if (!/^COM[1-9][0-9]*$/i.test(port.comPort?.trim() ?? '')) return '请选择有效的串口（例如 COM3）'
    const baudRate = port.baudRate ?? SERIAL_DEFAULT_BAUD_RATE
    if (!Number.isInteger(baudRate) || baudRate < 300 || baudRate > 4000000) return '波特率超出范围（300-4000000）'
    if (port.dataBits !== undefined && port.dataBits !== 7 && port.dataBits !== 8) return '数据位只能是 7 或 8'
    if (port.stopBits !== undefined && !['one', 'onePointFive', 'two'].includes(port.stopBits)) return '停止位只能是 1 / 1.5 / 2'
    if (port.parity !== undefined && !['none', 'odd', 'even', 'mark', 'space'].includes(port.parity)) return '奇偶检验取值无效'
    if (port.flowControl !== undefined && !['none', 'rtsCts', 'xonXoff'].includes(port.flowControl)) return '流控制取值无效'
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
