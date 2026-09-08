// ---------- 打印机真机兼容矩阵（对标"适配市面上大多数"） ----------
// 数据来源：厂商公开 SDK / 官方文档（佳博 gainscha.github.io、汉印、芯烨、得力、启锐等），
// 属"参考口径"，真机输出须按下方清单实测确认。未收录品牌沿用原版策略：先试 TSPL/ZPL/CPCL 三套。
import type { PrinterConfig } from '../model'

export interface CompatEntry {
  brand: string
  model: string
  /** 该机型官方支持/常用的指令集（按推荐优先级；esc 为信息参考，本软件未生成 ESC 指令） */
  engines: Array<'tspl' | 'zpl' | 'cpcl' | 'esc'>
  /** 常见端口 */
  ports: Array<'driver' | 'file' | 'tcp' | 'com' | 'usb' | 'bluetooth'>
  dpi: number[]
  note: string
}

export const COMPAT_MATRIX: CompatEntry[] = [
  { brand: '佳博 Gprinter', model: 'GP-M32 / GP-1424D 等桌面机', engines: ['tspl', 'cpcl', 'esc'], ports: ['driver', 'usb', 'com', 'tcp'], dpi: [203], note: '官方 SDK 支持 TSPL/ESC/ZPL/CPCL；热敏/热转印两用' },
  { brand: '佳博 Gprinter', model: 'GP-M323', engines: ['tspl', 'cpcl', 'esc'], ports: ['driver', 'usb', 'com', 'tcp'], dpi: [203], note: '官方页面列明 TSPL / CPCL / ESC-POS' },
  { brand: '汉印 HPRT', model: 'N41 / N31 桌面机', engines: ['tspl', 'esc'], ports: ['driver', 'usb', 'com'], dpi: [203], note: '主流走 TSPL；CPCL 多见于工业/便携机型' },
  { brand: '汉印 HPRT', model: '便携/工业机型', engines: ['cpcl', 'tspl'], ports: ['driver', 'usb', 'bluetooth'], dpi: [203], note: 'CPCL 多在工业级，ZPL 仅部分跨界型号支持' },
  { brand: '芯烨 Xprinter', model: 'XP-D 系列桌面机', engines: ['tspl', 'esc'], ports: ['driver', 'usb', 'com', 'tcp'], dpi: [203, 300], note: '兼容 TSPL 为主，部分型号支持 ZPL' },
  { brand: '得力 deli', model: 'DL-7 / DL-9 系列', engines: ['tspl'], ports: ['driver', 'usb'], dpi: [203], note: '兼容 TSPL，走驱动或指令均可' },
  { brand: '启锐 QIRUI', model: 'QR-588 / QR-668', engines: ['tspl'], ports: ['driver', 'usb'], dpi: [203], note: '兼容 TSPL 指令' },
  { brand: 'Zebra', model: 'ZD / ZT 系列', engines: ['zpl'], ports: ['driver', 'usb', 'tcp', 'com'], dpi: [203, 300], note: 'ZPL 原生，原生指令打印精度最佳' },
  { brand: 'TSC', model: 'TTP-244 / T-4502', engines: ['tspl', 'zpl'], ports: ['driver', 'usb', 'tcp', 'com'], dpi: [203, 300], note: 'TSPL 原生，也支持 ZPL' },
  { brand: '其他未收录品牌', model: '—', engines: ['tspl', 'zpl', 'cpcl'], ports: ['driver', 'usb', 'com', 'tcp'], dpi: [203], note: '与原版同策略：依次试 TSPL→ZPL→CPCL，不保证 100% 输出正确' }
]

export interface CompatRecommendation {
  engine: PrinterConfig['driver']
  reason: string
}

/** 根据厂商/型号给出推荐的指令集与依据 */
export function recommendEngine(model: string, brand?: string): CompatRecommendation {
  const text = ((brand ?? '') + ' ' + (model ?? '')).toLowerCase()
  if (text.includes('zebra')) return { engine: 'zpl', reason: 'Zebra 原生 ZPL，指令打印精度最佳' }
  if (text.includes('tsc')) return { engine: 'tspl', reason: 'TSC 原生 TSPL，同时兼容 ZPL' }
  if (text.includes('汉印') || text.includes('hprt')) return { engine: 'tspl', reason: '汉印桌面机主流兼容 TSPL' }
  if (text.includes('佳博') || text.includes('gprinter') || text.includes('gainscha')) return { engine: 'tspl', reason: '佳博官方 SDK 以 TSPL 为主，兼容 ZPL/CPCL' }
  if (text.includes('芯烨') || text.includes('xprinter')) return { engine: 'tspl', reason: '芯烨桌面机兼容 TSPL' }
  if (text.includes('得力') || text.includes('deli')) return { engine: 'tspl', reason: '得力兼容 TSPL' }
  if (text.includes('启锐') || text.includes('qirui')) return { engine: 'tspl', reason: '启锐兼容 TSPL' }
  return { engine: 'tspl', reason: '未收录品牌默认先试 TSPL，不行再切 ZPL / CPCL（与原版同策略）' }
}

/** 针对给定打印机配置生成真机验证清单 */
export function buildCompatChecklist(printer: PrinterConfig): string[] {
  const items: string[] = []
  const dpiOk = [203, 300, 600].includes(printer.dpi)
  items.push(`指令集 ${printer.driver.toUpperCase()}：首张打印「文字+Code128 条码+矩形」用于对位与清晰度`)
  items.push(`尺寸 ${printer.labelType === 'continuous' ? '连续纸' : '间隔/标记定位'}：打印 3 张检查定位误差（间隔/标记机需确认传感器类型）`)
  items.push(`分辨率 ${printer.dpi} dpi：确认与实际打印头一致${dpiOk ? '' : '（非 203/300/600，可能自动缩放）'}`)
  items.push(`速度 ${printer.speed} · 浓度 ${printer.density}：打印 50 张检查黑度稳定与虚边`)
  if (printer.port.type === 'com' || printer.port.type === 'bluetooth') {
    items.push(`串口 ${printer.port.comPort ?? '?'} @ ${printer.port.baudRate ?? 115200}：确认波特率与打印机面板一致（常见 9600/115200）`)
  }
  if (printer.port.type === 'tcp') items.push(`TCP ${printer.port.tcpHost}:${printer.port.tcpPort ?? 9100}：确认打印机网络端口（默认 9100）`)
  if (printer.port.encoding === 'gbk') items.push(`编码 GBK：打印含中文标签，核对中文不乱码`)
  items.push(`条码可读性：用扫码枪扫描 Code128 / QR / DataMatrix，验证可正常识读`)
  if (printer.port.type === 'driver') items.push('驱动打印：确认系统安装对应品牌驱动，标签纸张尺寸与驱动设置一致')
  return items
}
