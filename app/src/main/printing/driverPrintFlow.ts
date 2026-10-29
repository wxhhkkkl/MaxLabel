/**
 * 驱动端口（`port.type === 'driver'`）的打印顺序。
 *
 * 原版是 Win32 GDI：`StartDoc` 直接把页面交给打印驱动，驱动本身不弹任何窗口，
 * 所以带微软雅黑这类系统字体也是点完就出纸。复刻版借 Chromium 打印，
 * `silent: false` 会弹系统对话框 —— 这里按原版行为先静默打，
 * 只有静默被拒（驱动不接受当前页面尺寸等）或没绑定具体打印机时才退回系统对话框。
 */
export interface DriverPrintOutcome {
  /** 打印是否被接受。 */
  ok: boolean
  /** 是否走了系统对话框。 */
  usedDialog: boolean
  /** 是否被用户取消（取消后不再弹对话框）。 */
  canceled: boolean
}

export interface DriverPrintHooks {
  /** 用户已取消当前任务：不再进行下一次尝试。 */
  isCanceled?: () => boolean
  /** 即将弹系统对话框（调用方用来把隐藏窗口显示出来，否则对话框不可见）。 */
  onDialog?: () => void
}

export async function runDriverPrint(
  printerName: string | undefined,
  print: (silent: boolean) => Promise<boolean>,
  hooks: DriverPrintHooks = {}
): Promise<DriverPrintOutcome> {
  const isCanceled = hooks.isCanceled ?? (() => false)
  const showDialog = async (): Promise<DriverPrintOutcome> => {
    hooks.onDialog?.()
    const ok = await print(false)
    if (isCanceled()) return { ok: false, usedDialog: true, canceled: true }
    return { ok, usedDialog: true, canceled: false }
  }

  // 没有目标打印机时不能静默：Chromium 会打到系统默认打印机，可能根本不是标签机。
  if (!printerName?.trim()) return showDialog()

  if (await print(true)) return { ok: true, usedDialog: false, canceled: false }
  if (isCanceled()) return { ok: false, usedDialog: false, canceled: true }
  return showDialog()
}
