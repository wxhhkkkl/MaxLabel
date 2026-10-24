import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_ENTITLEMENT, type EntitlementState } from '../../../../shared/domain/entitlement'

/**
 * 订阅主进程的授权状态。
 *
 * 初值取保守的只读状态，直到 `entitlement:status` 返回；登录/续费/加密狗插拔后
 * 主进程会推送 `entitlement:changed`，无需重启。
 */
export function useEntitlements(): { state: EntitlementState; refresh: () => void } {
  const [state, setState] = useState<EntitlementState>(DEFAULT_ENTITLEMENT)

  const refresh = useCallback(() => {
    void window.maxlabel.entitlement.status()
      .then((result) => { if (result.ok && result.state) setState(result.state) })
      .catch(() => { /* 读取失败时保持保守的只读状态。 */ })
  }, [])

  useEffect(() => {
    let live = true
    refresh()
    const unsubscribe = window.maxlabel.entitlement.onChanged((next) => {
      if (live) setState(next)
    })
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      live = false
      unsubscribe()
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  return { state, refresh }
}
