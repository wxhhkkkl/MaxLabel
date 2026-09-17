import { useEffect, useRef } from 'react'
import type { UpdateCheckResultDto } from '../../../../shared/ipcContract'

/**
 * 启动时自动检查更新（帮助 install_upgrade.html：签赋LabelShop 启动时会自动检查更新程序，
 * 如果有新的版本需要更新会自动给出更新提示）。
 * 只在确有新版本时弹提示；网络失败/未配置服务器一律静默，不打扰用户。
 */
export function useUpdateStartup(
  serverUrlKey: string,
  onUpdate: (result: UpdateCheckResultDto) => void
): void {
  const notify = useRef(onUpdate)
  notify.current = onUpdate
  useEffect(() => {
    let disposed = false
    const serverUrl = localStorage.getItem(serverUrlKey)?.trim() ?? ''
    void window.maxlabel.checkForUpdate(serverUrl).then((result) => {
      if (disposed || result?.status !== 'update') return
      notify.current(result)
    }).catch(() => {})
    return () => { disposed = true }
  }, [serverUrlKey])
}
