import { useEffect, useState } from 'react'
import { composeWindowTitle } from '../../../../shared/appTitle'

/**
 * 程序标题栏（帮助 interface_interface.html 元素 1：显示程序版本、登录状态等信息）。
 *
 * 原版 MFC 标题栏承载「产品名 [版本 - 激活状态] V版本号 (登录状态) - 当前文档」，
 * 复刻版把同一分段拼装后回写 Electron 主窗口标题。版本号只在挂载时取一次
 * （主进程 `app:version`，取值与「帮助 → 关于」同一来源），授权与登录状态变化时重算。
 */
export function useWindowTitle(options: {
  activated: boolean
  loginEmail: string | null
  documentTitle: string | null
}): string {
  const [version, setVersion] = useState('')
  const { activated, loginEmail, documentTitle } = options

  useEffect(() => {
    let live = true
    void window.maxlabel.appVersion()
      .then((result) => { if (live && result?.ok) setVersion(result.version) })
      .catch(() => {})
    return () => { live = false }
  }, [])

  const title = composeWindowTitle({
    productName: 'MaxLabel',
    activated,
    version: version || '0.0.0',
    loginEmail,
    documentTitle
  })

  useEffect(() => {
    // 版本号到达前不写标题，避免闪过 V0.0.0。
    if (!version) return
    // document.title 由 Electron 同步到主窗口标题栏（OS 标题栏即原版的「程序标题栏」），
    // IPC 再显式落一次，保证渲染进程标题被其它来源改写时仍以本函数的拼装结果为准。
    document.title = title
    void window.maxlabel.setWindowTitle(title).catch(() => {})
  }, [title, version])

  return title
}
