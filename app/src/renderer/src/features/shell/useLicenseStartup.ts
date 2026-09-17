import { useEffect, useState } from 'react'
import type { LicenseStateDto } from '../../../../shared/ipcContract'

/** Runs the cached-license recheck without coupling startup policy to the editor shell.
 *  返回本地授权状态，供程序标题栏（帮助 interface_interface.html 元素 1）显示激活状态。 */
export function useLicenseStartup(serverUrlKey: string): LicenseStateDto | null {
  const [state, setState] = useState<LicenseStateDto | null>(null)
  useEffect(() => {
    let disposed = false
    void window.maxlabel.license.status().then((result) => {
      if (disposed) return
      setState(result?.state ?? null)
      if (!result?.state?.active || !result.state.key) return
      const serverUrl = localStorage.getItem(serverUrlKey)?.trim()
      if (serverUrl) void window.maxlabel.license.check(serverUrl)
    }).catch(() => { if (!disposed) setState(null) })
    return () => { disposed = true }
  }, [serverUrlKey])
  return state
}
