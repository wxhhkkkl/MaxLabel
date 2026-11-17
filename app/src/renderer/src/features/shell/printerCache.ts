export interface CachedPrinter {
  name: string
  displayName: string
  status?: number
  port?: string
  isDefault?: boolean
  /** true = 有 Windows 打印队列；false = 只有 USB 设备、没装驱动/队列。 */
  hasQueue?: boolean
  /** 应用自己创建的 USB 直连队列（内部通道），不在列表里展示。 */
  internal?: boolean
}

export interface PrinterListSnapshot {
  printers: CachedPrinter[]
  message?: string
  loadedAt: number
}

let snapshot: PrinterListSnapshot | null = null
let inflight: Promise<PrinterListSnapshot> | null = null

/** 已缓存的打印机列表（启动时预取）；没有则返回 null。 */
export function peekPrinterList(): PrinterListSnapshot | null {
  return snapshot
}

/**
 * 打印机列表缓存：应用启动时预取一次，新建标签/打印面板打开时直接用，
 * 不再每次等主进程跑 PowerShell。`force` = 用户点刷新时重新枚举。
 *
 * 并发调用共享同一个请求；刷新失败保留旧列表（用户至少还能看到上次的结果）。
 */
export function loadPrinterList(force = false): Promise<PrinterListSnapshot> {
  if (!force && snapshot) return Promise.resolve(snapshot)
  if (inflight) return inflight
  inflight = window.maxlabel
    .listPrinters()
    .then((result) => {
      const listed = (result.printers ?? []).map((printer) => ({
        name: printer.name,
        displayName: printer.displayName || printer.name,
        ...(printer.status === undefined ? {} : { status: printer.status }),
        ...(printer.port ? { port: printer.port } : {}),
        ...(printer.isDefault ? { isDefault: true } : {}),
        ...(printer.hasQueue === undefined ? {} : { hasQueue: printer.hasQueue }),
        ...(printer.internal ? { internal: true } : {})
      }))
      // 只出现在设备树、没有打印队列的 USB 打印机不进「Windows 打印机」列表：
      // 选中它打印必然失败，设备本身应在「打印机设置 → 端口 → USB 端口」里选。
      const hidden = listed.filter((printer) => printer.hasQueue === false).length
      const printers = listed.filter((printer) => printer.hasQueue !== false && printer.internal !== true)
      const notes = [result.message, hidden ? '未安装打印队列的 USB 打印设备已隐藏，可在「打印机设置 → 端口」的 USB 端口里选择' : undefined]
        .filter((value): value is string => Boolean(value))
      snapshot = {
        printers,
        ...(notes.length ? { message: notes.join('；') } : {}),
        loadedAt: Date.now()
      }
      return snapshot
    })
    .catch((error) => {
      const fallback: PrinterListSnapshot = snapshot ?? {
        printers: [],
        message: error instanceof Error ? error.message : String(error),
        loadedAt: Date.now()
      }
      return fallback
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}
