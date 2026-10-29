import { useEffect, useRef } from 'react'
import type { UpdateCheckResultDto } from '../../../../shared/ipcContract'

/**
 * 启动时自动检查更新（帮助 install_upgrade.html：内置驱动 启动时会自动检查更新程序，
 * 如果有新的版本需要更新会自动给出更新提示）。
 *
 * `enabled` 来自 AppOptions.updateCheckOnStartup（设置项「不提示更新」的反向值）：
 * - 关闭时连启动检查都不发起，只保留手动检查；
 * - 开启时只在确有新版本时弹提示；失败一律静默，不打扰用户。
 */
export function useUpdateStartup(
  enabled: boolean,
  onUpdate: (result: UpdateCheckResultDto) => void
): void {
  const notify = useRef(onUpdate)
  notify.current = onUpdate
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    void window.maxlabel.update.check().then((result) => {
      if (disposed || result?.status !== 'update') return
      notify.current(result)
    }).catch(() => {})
    return () => { disposed = true }
  }, [enabled])
}
