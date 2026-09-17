// 程序标题栏文案（帮助 interface_interface.html 元素 1「程序标题栏：显示程序版本、登录状态等信息」）。
//
// 原版 MFC 标题栏形如：
//   签赋LabelShop [标准版 - 未激活] V6.39 (请登录 LabelShop) - 新标签模板1
// 即「产品名 [版本 - 激活状态] V版本号 (登录状态) - 当前文档」。
//
// 复刻版按 app/docs/labelshop-compatibility-audit.md 的单一版本策略只有一套授权
// （无标准版/专业版/企业版分层，见 E-06~E-10 已记录边界），因此方括号内只保留
// 激活状态；其余分段（产品名、V 版本号、登录状态、当前文档）与原版同构。

export interface WindowTitleParts {
  /** 产品名，如 MaxLabel */
  productName: string
  /** 授权是否有效 */
  activated: boolean
  /** 版本号，如 0.1.0 */
  version: string
  /** 云端登录账号；null/空表示未登录 */
  loginEmail: string | null
  /** 当前文档标题；null 表示停留在起始页 */
  documentTitle: string | null
}

/** 未登录时的登录提示，取自原版真机截图 parity/reference/labelshop/00-main.png 标题栏原文。 */
export const SIGNED_OUT_HINT = '请登录 LabelShop'

/** 未打开模板时的文档段，取自原版真机截图（起始页标题栏以「起始页」结尾）。 */
export const START_PAGE_TITLE = '起始页'

export function composeWindowTitle(parts: WindowTitleParts): string {
  const product = parts.productName.trim() || 'MaxLabel'
  const version = parts.version.trim()
  const activation = parts.activated ? '已激活' : '未激活'
  const login = parts.loginEmail?.trim() ? parts.loginEmail.trim() : SIGNED_OUT_HINT
  const document = parts.documentTitle?.trim() ? parts.documentTitle.trim() : START_PAGE_TITLE
  const versionSegment = version ? ` V${version}` : ''
  return `${product} [${activation}]${versionSegment} (${login}) - ${document}`
}
