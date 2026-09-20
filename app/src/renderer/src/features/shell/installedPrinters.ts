import { PRINTER_CATALOG, type PrinterCatalogEntry } from '../../../../shared/domain/printerCatalog.generated'
import type { CommandSet, PrinterConfig } from '../../../../shared/domain/printer'
import { defaultPrinterConfig } from '../../../../shared/domain/printer'

/**
 * 「安装 LabelShop 打印机」装出来的打印机（真机取证 `parity/reference/labelshop/probe-07-install-printer.png`
 * 与 `probe-08-install-list.txt`）：它们是签赋 LabelShop 自带的软件打印机条目（品牌 + 型号/指令集 + 分辨率），
 * 安装在软件里而不是 Windows 里，装完后会出现在「选择标签格式」页的「打印机」下拉里，
 * 并且把标签格式目录切到**卷筒标签**（品牌名带「 (卷筒标签)」）。
 *
 * 这里只做两件事：记住装了哪些条目（顺序 = 安装顺序），以及把条目翻译成打印用的 PrinterConfig。
 */
export const INSTALLED_PRINTERS_STORAGE_KEY = 'maxlabel.installedPrinters'

/** 下拉里用来区分「LabelShop 打印机」与「Windows 打印机」的取值前缀。 */
export const LABELSHOP_PRINTER_PREFIX = 'ls:'

export function labelShopPrinterValue(id: string): string {
  return LABELSHOP_PRINTER_PREFIX + id
}

export function parseLabelShopPrinterValue(value: string): string | null {
  return value.startsWith(LABELSHOP_PRINTER_PREFIX) ? value.slice(LABELSHOP_PRINTER_PREFIX.length) : null
}

export function labelShopPrinterById(id: string): PrinterCatalogEntry | undefined {
  return PRINTER_CATALOG.find((entry) => entry.id === id)
}

export function readInstalledPrinterIds(): string[] {
  try {
    const raw = localStorage.getItem(INSTALLED_PRINTERS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    // 目录换代后可能留下无效 id：读的时候顺手过滤，避免下拉出现空条目。
    return parsed.filter((id): id is string => typeof id === 'string' && PRINTER_CATALOG.some((entry) => entry.id === id))
  } catch {
    return []
  }
}

export function writeInstalledPrinterIds(ids: string[]): void {
  try {
    localStorage.setItem(INSTALLED_PRINTERS_STORAGE_KEY, JSON.stringify([...new Set(ids)]))
  } catch {
    // 偏好项写不进去不应影响其它流程。
  }
}

/** 已安装的 LabelShop 打印机（按安装顺序；真机里它们排在下拉的系统打印机之前）。 */
export function installedLabelShopPrinters(): PrinterCatalogEntry[] {
  return readInstalledPrinterIds()
    .map((id) => labelShopPrinterById(id))
    .filter((entry): entry is PrinterCatalogEntry => Boolean(entry))
}

export function installLabelShopPrinter(id: string): string[] {
  if (!labelShopPrinterById(id)) return readInstalledPrinterIds()
  const next = [...readInstalledPrinterIds(), id]
  writeInstalledPrinterIds(next)
  return readInstalledPrinterIds()
}

export function removeLabelShopPrinter(id: string): string[] {
  const next = readInstalledPrinterIds().filter((item) => item !== id)
  writeInstalledPrinterIds(next)
  return readInstalledPrinterIds()
}

/** 真机列表里的型号段就是该品牌的原生指令集（GPL/TSPL/PPLA/CLNX…），映射到我们支持的三种。 */
export function commandSetOfCatalogEntry(entry: PrinterCatalogEntry): CommandSet {
  const token = `${entry.model} ${entry.commandSet}`.toUpperCase()
  if (token.includes('ZPL') || token.includes('EPL')) return 'zpl'
  if (token.includes('CPCL') || token.includes('ESCPOS')) return 'cpcl'
  return 'tspl'
}

/** 把已安装的 LabelShop 打印机翻译成打印链路用的 PrinterConfig（分辨率/指令集/型号随条目走）。 */
export function configFromCatalogEntry(entry: PrinterCatalogEntry, base: PrinterConfig = defaultPrinterConfig()): PrinterConfig {
  return {
    ...base,
    driver: commandSetOfCatalogEntry(entry),
    dpi: entry.dpi || base.dpi,
    model: entry.model,
    profile: entry.brand,
    printerName: entry.name,
    port: { ...base.port, type: 'file' }
  }
}

/**
 * 当前文档绑定的打印机是不是「签赋LabelShop 打印机」（安装打印机装出来的那些，即原版的**内置驱动**）。
 *
 * 真机实测（`parity/reference/labelshop/probe-19-filemenu.png` vs `probe-20-filemenu-sheet.png`）：
 * 卷筒文档用 `Gprinter GPL-N (203 dpi)`（内置驱动）时，文件菜单里的**「打印预览(V)」是灰的**；
 * 换成 `Microsoft Print to PDF`（Windows 驱动端口）后同一项可用。这与帮助
 * `print_preview.html` 的「LabelShop 打印机内置驱动不支持打印预览」一致。
 */
export function isLabelShopBuiltInPrinter(printer: PrinterConfig | undefined | null): boolean {
  const name = printer?.printerName?.trim()
  if (!name) return false
  return installedLabelShopPrinters().some((entry) => entry.name === name)
}
