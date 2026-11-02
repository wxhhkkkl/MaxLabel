export interface CachedPrinter {
  name: string
  displayName: string
  status?: number
  port?: string
  isDefault?: boolean
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
      snapshot = {
        printers: (result.printers ?? []).map((printer) => ({
          name: printer.name,
          displayName: printer.displayName || printer.name,
          ...(printer.status === undefined ? {} : { status: printer.status }),
          ...(printer.port ? { port: printer.port } : {}),
          ...(printer.isDefault ? { isDefault: true } : {})
        })),
        ...(result.message ? { message: result.message } : {}),
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
