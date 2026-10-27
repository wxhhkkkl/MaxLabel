import { useEffect, useState } from 'react'
import type { UpdateStateDto } from '../../../../shared/ipcContract'

/** 订阅主进程更新状态；对话框重开/延迟安装时也能拿到当前状态。 */
export function useUpdateState(): UpdateStateDto | null {
  const [state, setState] = useState<UpdateStateDto | null>(null)
  useEffect(() => {
    let live = true
    void window.maxlabel.update.state().then((next) => {
      if (live) setState(next)
    }).catch(() => {})
    const off = window.maxlabel.update.onChanged((next) => {
      if (live) setState(next)
    })
    return () => {
      live = false
      off()
    }
  }, [])
  return state
}
