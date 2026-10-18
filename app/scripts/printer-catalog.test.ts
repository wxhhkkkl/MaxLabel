/*
 * 打印机安装目录与「已安装打印机」偏好的单元测试（真机取证 round-105 的数据面）。
 *   数据集：parity/reference/labelshop/probe-08-install-list.txt（125 行）
 *           parity/reference/labelshop/probe-10-install-filter.txt（品牌过滤 39 项）
 *   生成器：app/scripts/generate-printer-catalog.cjs
 */
import assert from 'node:assert'
import { PRINTER_BRAND_FILTER, PRINTER_CATALOG } from '../src/shared/domain/printerCatalog.generated'
import { LABEL_FORMATS } from '../src/shared/domain/labelFormats.generated'
import { PORT_TYPE_OPTIONS, defaultPrinterConfig, formatUsbPrinterPort, portConfigError, usbPortName } from '../src/shared/domain/printer'
import {
  INSTALLED_PRINTERS_STORAGE_KEY,
  commandSetOfCatalogEntry,
  configFromCatalogEntry,
  installLabelShopPrinter,
  installedLabelShopPrinters,
  isRollPrinter,
  labelShopPrinterById,
  labelShopPrinterValue,
  parseLabelShopPrinterValue,
  readInstalledPrinterIds,
  removeLabelShopPrinter
} from '../src/renderer/src/features/shell/installedPrinters'

function check(name: string, fn: () => void): void {
  fn()
  console.log(`ok - ${name}`)
}

// 极简 localStorage 替身（node 环境没有 DOM）
const store = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  setItem: (key: string, value: string) => { store.set(key, String(value)) },
  removeItem: (key: string) => { store.delete(key) },
  clear: () => { store.clear() },
  key: () => null,
  length: 0
} as unknown as Storage

check('目录为真机的 125 行、品牌过滤为全部 + 38 项', () => {
  assert.strictEqual(PRINTER_CATALOG.length, 125)
  assert.strictEqual(PRINTER_BRAND_FILTER.length, 39)
  assert.strictEqual(PRINTER_BRAND_FILTER[0], '全部')
})

check('目录首行与末行同真机列表', () => {
  assert.strictEqual(PRINTER_CATALOG[0].name, 'Gprinter GPL-N (203 dpi)')
  assert.strictEqual(PRINTER_CATALOG[124].name, 'Argox PPLB-N (600 dpi)')
})

check('条目 id 唯一且都带品牌标签', () => {
  const ids = new Set(PRINTER_CATALOG.map((entry) => entry.id))
  assert.strictEqual(ids.size, PRINTER_CATALOG.length)
  assert.ok(PRINTER_CATALOG.every((entry) => entry.brandLabel.length > 0))
})

check('佳博 (Gprinter) 共 7 条，含 GPL-N / GPLZ-N / ESCPOS-N', () => {
  const rows = PRINTER_CATALOG.filter((entry) => entry.brandLabel === '佳博 (Gprinter)')
  assert.strictEqual(rows.length, 7)
  const models = new Set(rows.map((entry) => entry.model))
  assert.deepStrictEqual([...models].sort(), ['ESCPOS', 'GPL', 'GPLZ'])
})

check('指令集映射：ZPL/EPL→zpl、CPCL/ESCPOS→cpcl、其余（GPL/TSPL/PPLA…）→tspl', () => {
  const byName = (name: string) => PRINTER_CATALOG.find((entry) => entry.name === name)!
  assert.strictEqual(commandSetOfCatalogEntry(byName('Zebra ZPL-N (203 dpi)')), 'zpl')
  assert.strictEqual(commandSetOfCatalogEntry(byName('Zebra EPL-N (203 dpi)')), 'zpl')
  assert.strictEqual(commandSetOfCatalogEntry(byName('Zebra CPCL-N (203 dpi)')), 'cpcl')
  assert.strictEqual(commandSetOfCatalogEntry(byName('Gprinter GPL-N (203 dpi)')), 'tspl')
  assert.strictEqual(commandSetOfCatalogEntry(byName('TSC TSPL-N (300 dpi)')), 'tspl')
  assert.strictEqual(commandSetOfCatalogEntry(byName('Argox PPLB-N (600 dpi)')), 'tspl')
})

check('安装/移除只影响「已安装打印机」偏好，且顺序 = 安装顺序', () => {
  store.clear()
  const gprinter = PRINTER_CATALOG.find((entry) => entry.name === 'Gprinter GPL-N (203 dpi)')!.id
  const zebra = PRINTER_CATALOG.find((entry) => entry.name === 'Zebra ZPL-N (203 dpi)')!.id
  assert.deepStrictEqual(readInstalledPrinterIds(), [])
  installLabelShopPrinter(gprinter)
  installLabelShopPrinter(zebra)
  assert.deepStrictEqual(readInstalledPrinterIds(), [gprinter, zebra])
  assert.deepStrictEqual(installedLabelShopPrinters().map((entry) => entry.name), ['Gprinter GPL-N (203 dpi)', 'Zebra ZPL-N (203 dpi)'])
  removeLabelShopPrinter(gprinter)
  assert.deepStrictEqual(readInstalledPrinterIds(), [zebra])
  removeLabelShopPrinter(zebra)
  assert.deepStrictEqual(readInstalledPrinterIds(), [])
})

check('无效目录 id 不写入、脏偏好读取时被过滤', () => {
  store.clear()
  installLabelShopPrinter('ls-999')
  assert.deepStrictEqual(readInstalledPrinterIds(), [])
  store.set(INSTALLED_PRINTERS_STORAGE_KEY, JSON.stringify(['ls-002', 'ls-999', 42]))
  assert.deepStrictEqual(readInstalledPrinterIds(), ['ls-002'])
})

check('下拉取值前缀可往返（ls: 前缀区分 LabelShop 打印机与 Windows 打印机）', () => {
  const value = labelShopPrinterValue('ls-001')
  assert.strictEqual(value, 'ls:ls-001')
  assert.strictEqual(parseLabelShopPrinterValue(value), 'ls-001')
  assert.strictEqual(parseLabelShopPrinterValue('Microsoft Print to PDF'), null)
})

check('条目 → PrinterConfig：指令集/分辨率/型号/名称，默认端口为 USB（真机默认）', () => {
  const entry = labelShopPrinterById(PRINTER_CATALOG.find((item) => item.name === 'Gprinter GPL-N (203 dpi)')!.id)!
  const config = configFromCatalogEntry(entry, undefined, 'USB001 (Gprinter GP-1324D)')
  assert.strictEqual(config.driver, 'tspl')
  assert.strictEqual(config.dpi, 203)
  assert.strictEqual(config.model, 'GPL')
  assert.strictEqual(config.profile, 'Gprinter')
  assert.strictEqual(config.printerName, 'Gprinter GPL-N (203 dpi)')
  assert.strictEqual(config.port.type, 'usb')
  assert.strictEqual(config.port.usbPort, 'USB001 (Gprinter GP-1324D)')
  const zpl = configFromCatalogEntry(labelShopPrinterById(PRINTER_CATALOG.find((item) => item.name === 'Zebra ZPL-N (300 dpi)')!.id)!)
  assert.strictEqual(zpl.driver, 'zpl')
  assert.strictEqual(zpl.dpi, 300)
  assert.strictEqual(zpl.port.type, 'usb')
  assert.strictEqual(zpl.port.usbPort, undefined)
})

check('USB 端口名提取：USB001 (Gprinter GP-1324D) → USB001（供 spooler 找队列用）', () => {
  assert.strictEqual(usbPortName('USB001 (Gprinter GP-1324D)'), 'USB001')
  assert.strictEqual(usbPortName('usb002 (标签机)'), 'USB002')
  assert.strictEqual(usbPortName('USB003'), 'USB003')
  assert.strictEqual(usbPortName(''), '')
  assert.strictEqual(usbPortName(undefined), '')
})

// ---- 标签格式目录的介质分类（「选择标签格式」页的品牌/类型/名称数量口径）----
const roll = LABEL_FORMATS.filter((format) => format.type === 0)
const sheet = LABEL_FORMATS.filter((format) => format.type === 1)

check('卷筒目录：1 个品牌 / 7 个类型 / 高级铜版纸标签 31 项（真机 probe-09）', () => {
  assert.strictEqual(new Set(roll.map((format) => format.brandName)).size, 1)
  const categories = [...new Set(roll.map((format) => format.categoryName))]
  assert.strictEqual(categories.length, 7)
  assert.deepStrictEqual(categories, ['高级铜版纸标签', '优质铜版纸标签', '高级热敏纸标签', '合成纸标签', '白PET标签', '哑银PET标签', '优质热敏标签'])
  assert.strictEqual(roll.filter((format) => format.categoryName === '高级铜版纸标签').length, 31)
  // 卷筒编码段：6020xx / 6030xx / 6040xx / 6060xx / 6070xx（平张是 6080xx）
  assert.ok(roll.every((format) => /^60[2-7]0\d\d$/.test(format.code)))
  assert.ok(roll.every((format) => !format.code.startsWith('6080')))
})

check('平张目录：京成云马标签只有 1 个类型 42 项（真机 probe-09）', () => {
  const jcy = sheet.filter((format) => format.brandName === '京成云马标签')
  const categories = [...new Set(jcy.map((format) => format.categoryName))]
  assert.deepStrictEqual(categories, ['云马优质打印纸标签'])
  assert.strictEqual(jcy.length, 42)
  assert.ok(jcy.every((format) => /^6080\d\d$/.test(format.code)))
  assert.strictEqual(new Set(sheet.map((format) => format.brandName)).size, 2)
})

// ---- 打印机属性 → 端口（真机 probe-14：<打印机名> 属性 对话框）----
check('端口类型下拉 7 项，文字与顺序同真机（含蜂打打云盒）', () => {
  assert.deepStrictEqual(PORT_TYPE_OPTIONS.map((option) => option.label), [
    '打印机端口(LPT)',
    '串行端口(COM)',
    '标准 TCP/IP 打印机端口',
    'USB 打印机端口',
    '蓝牙',
    '蜂打打云盒',
    '打印机驱动程序端口'
  ])
  assert.deepStrictEqual(PORT_TYPE_OPTIONS.map((option) => option.value), ['lpt', 'com', 'tcp', 'usb', 'bluetooth', 'cloudbox', 'driver'])
})

check('USB 端口显示格式同真机：USB001 (Gprinter GP-1324D)（多余空格折叠）', () => {
  assert.strictEqual(formatUsbPrinterPort('USB001', 'Gprinter  GP-1324D'), 'USB001 (Gprinter GP-1324D)')
  assert.strictEqual(formatUsbPrinterPort('USB002', '  标签机  '), 'USB002 (标签机)')
  assert.strictEqual(formatUsbPrinterPort('USB003', ''), 'USB003')
})

check('端口校验：USB 必须选端口、TCP 必须填地址、云盒空地址是正常态', () => {
  const base = { encoding: 'utf8' } as const
  assert.ok(portConfigError({ ...base, type: 'usb' }))
  assert.strictEqual(portConfigError({ ...base, type: 'usb', usbPort: 'USB001 (Gprinter GP-1324D)' }), undefined)
  // 真机「端口」页的云盒下拉就是发现结果：没发现云盒显示「未检测到云盒」且**没有任何报错**、
  // 「确定」可用（同态并排图 parity/review/cmp-printerportbox-r119.png）→ 空主机名不阻断。
  // 复刻版此前在这里返回「TCP 地址不能为空」，属过度校验（红字提示 + 禁用「保存」）。
  assert.strictEqual(portConfigError({ ...base, type: 'cloudbox' }), undefined)
  assert.strictEqual(portConfigError({ ...base, type: 'cloudbox', tcpHost: '', tcpPort: 9100 }), undefined)
  // 但格式错误仍然报错（放宽的是「必填」，不是「不校验」）
  assert.ok(portConfigError({ ...base, type: 'cloudbox', tcpHost: 'bad host' }))
  assert.strictEqual(portConfigError({ ...base, type: 'cloudbox', tcpHost: '192.168.1.50', tcpPort: 9100 }), undefined)
  assert.strictEqual(portConfigError({ ...base, type: 'cloudbox', tcpHost: 'box.local' }), undefined)
  // 标准 TCP/IP 端口仍然必须填地址（本次只放宽云盒）
  assert.ok(portConfigError({ ...base, type: 'tcp' }))
  assert.ok(portConfigError({ ...base, type: 'tcp', tcpHost: '   ' }))
})

check('卷筒判定：LabelShop 打印机一律卷筒；Windows 驱动按名称识别', () => {
  // 无打印机 / 普通页式驱动 → 平张
  assert.strictEqual(isRollPrinter(undefined), false)
  assert.strictEqual(isRollPrinter(configFromCatalogEntry(labelShopPrinterById('ls-001')!)), true)
  assert.strictEqual(isRollPrinter({ ...defaultPrinterConfig(), printerName: 'Microsoft Print to PDF' }), false)
  assert.strictEqual(isRollPrinter({ ...defaultPrinterConfig(), printerName: 'OneNote (Desktop)' }), false)
  // 装的是标签机驱动（佳博/斑马…）→ 卷筒
  assert.strictEqual(isRollPrinter({ ...defaultPrinterConfig(), printerName: 'Gprinter  GP-1324D' }), true)
  assert.strictEqual(isRollPrinter({ ...defaultPrinterConfig(), printerName: 'Zebra ZD421' }), true)
})

console.log('\nprinter catalog checks passed')
