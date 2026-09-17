import React from 'react'

/**
 * MaxLabel 图标库（SVG 描边风格，24 viewBox）
 * 各图标对应 LabelShop 工具栏/格式栏/对齐栏的按钮功能。
 */

export function Icon({ children, size = 19, color = 'currentColor', title }: { children: React.ReactNode; size?: number; color?: string; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

/** 空心/实心切换用 helper */
function F({ children, size = 19, color = 'currentColor' }: { children: React.ReactNode; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none" aria-hidden="true">
      {children}
    </svg>
  )
}

/* ---------- 文件 / 编辑 ---------- */
export const INew = () => (
  <Icon>
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <path d="M10 12v5M7.5 14.5h5" />
  </Icon>
)
export const IOpen = () => (
  <Icon>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M3 10h18" />
  </Icon>
)
export const ISave = () => (
  <Icon>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 3v5h8V3" />
    <path d="M8 21v-6h8v6" />
  </Icon>
)
export const ICut = () => (
  <Icon>
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <path d="M8.2 7.6 20 18M8.2 16.4 20 6" />
  </Icon>
)
export const ICopy = () => (
  <Icon>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Icon>
)
export const IPaste = () => (
  <Icon>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="M9 12h6M9 16h6" />
  </Icon>
)
export const IDelete = () => (
  <Icon>
    <path d="M4 7h16" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    <path d="M10 11v6M14 11v6" />
  </Icon>
)
export const IUndo = () => (
  <Icon>
    <path d="M8 6 4 10l4 4" />
    <path d="M4 10h11a5 5 0 0 1 0 10h-3" />
  </Icon>
)
export const IRedo = () => (
  <Icon>
    <path d="M16 6l4 4-4 4" />
    <path d="M20 10H9a5 5 0 0 0 0 10h3" />
  </Icon>
)

/* ---------- 打印 / 标签 ---------- */
export const ILabelFormat = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 9h18M9 9v10" />
  </Icon>
)
export const IPreview = () => (
  <Icon>
    <rect x="3" y="4" width="14" height="11" rx="2" />
    <path d="M17 9h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-1" />
  </Icon>
)
export const IPrint = () => (
  <Icon>
    <path d="M7 8V4h10v4" />
    <rect x="4" y="8" width="16" height="8" rx="1.5" />
    <path d="M7 14h10v6H7z" />
  </Icon>
)

/* ---------- 对象工具 ---------- */
export const ISelect = () => (
  <F>
    <path d="M5 3l14 8-6.2 1.6L9.5 19 5 3z" fill="currentColor" />
  </F>
)
export const IBarcode = () => (
  <Icon>
    <path d="M4 6v12M8 6v12M12 6v12M16 6v12M20 6v12" strokeWidth={2.2} />
  </Icon>
)
export const IText = () => (
  <F>
    <path d="M5 5h14M12 5v14M9 19h6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
  </F>
)
export const ILine = () => (
  <Icon>
    <path d="M3 17 21 7" />
    <path d="M21 4v6M21 7h-3" />
  </Icon>
)
export const IDiagonal = () => (
  <Icon>
    <path d="M4 20 20 4" />
  </Icon>
)
export const IRect = () => <Icon><rect x="4" y="6" width="16" height="12" rx="1" /></Icon>
export const IEllipse = () => <Icon><ellipse cx="12" cy="12" rx="8" ry="5.5" /></Icon>
export const IImage = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="9" r="1.6" />
    <path d="M4 18l5-5 4 4 3-3 4 4" />
  </Icon>
)
export const ITable = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="M3 9h18M3 15h18M9 9v11M15 9v11" />
  </Icon>
)
export const IRfid = () => (
  <Icon>
    <rect x="6" y="6" width="12" height="12" rx="1.5" />
    <path d="M9.5 12h5M12 9.5v5" strokeWidth={2} />
    <path d="M15 17.5l1.2 1.8M9 17.5l-1.2 1.8M15 6.5l1.2-1.8M9 6.5L7.8 4.7" />
  </Icon>
)
export const IData = () => (
  <Icon>
    <ellipse cx="12" cy="5" rx="7" ry="2.6" />
    <path d="M5 5v14c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V5" />
    <path d="M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" />
  </Icon>
)

/* ---------- 数据库导航 ---------- */
export const IDbConfig = () => (
  <Icon>
    <ellipse cx="12" cy="5" rx="7" ry="2.6" />
    <path d="M5 5v9c0 1.4 3.1 2.6 7 2.6.6 0 1.2 0 1.7-.1" />
    <path d="M5 9.5c0 1.4 3.1 2.6 7 2.6" />
    <circle cx="17.5" cy="17" r="3" />
    <path d="M17.5 15.6v.8M17.5 17.6v.8M16.1 17h.8M18.1 17h.8" />
  </Icon>
)
export const IRecord = () => (
  <Icon>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.4" />
    <path d="M12 1v3M12 20v3M1 12h3M20 12h3" />
  </Icon>
)
export const IRefresh = () => (
  <Icon>
    <path d="M20 12a8 8 0 1 1-2.3-5.6" />
    <path d="M20 3v4h-4" />
  </Icon>
)
export const IFirst = () => (
  <Icon>
    <path d="M7 5v14" strokeWidth={2.4} />
    <path d="M19 6l-7 6 7 6" />
  </Icon>
)
export const IPrev = () => (
  <Icon>
    <path d="M15 6l-6 6 6 6" />
  </Icon>
)
export const INext = () => (
  <Icon>
    <path d="M9 6l6 6-6 6" />
  </Icon>
)
export const ILast = () => (
  <Icon>
    <path d="M17 5v14" strokeWidth={2.4} />
    <path d="M5 6l7 6-7 6" />
  </Icon>
)

/* ---------- 显示 ---------- */
export const IZoomIn = () => (
  <Icon>
    <circle cx="10" cy="10" r="6" />
    <path d="M14.5 14.5 20 20" />
    <path d="M10 7.5v5M7.5 10h5" />
  </Icon>
)
export const IZoomOut = () => (
  <Icon>
    <circle cx="10" cy="10" r="6" />
    <path d="M14.5 14.5 20 20" />
    <path d="M7.5 10h5" />
  </Icon>
)
export const IFitWidth = () => (
  <Icon>
    <rect x="4" y="5" width="16" height="14" rx="1" />
    <path d="M8 10l-2 2 2 2M16 10l2 2-2 2" />
  </Icon>
)
export const IFitHeight = () => (
  <Icon>
    <rect x="5" y="4" width="14" height="16" rx="1" />
    <path d="M10 8l-2 2 2 2M14 8l2 2-2 2M12 6v12" />
  </Icon>
)
export const IFitWindow = () => (
  <Icon>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
  </Icon>
)
export const IHelp = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.6-2.4 2-2.4 3.3" />
    <path d="M12 16.6v.2" />
  </Icon>
)

/* ---------- 格式栏：文字样式 ---------- */
export const IBold = () => (
  <F>
    <path d="M7 4h6a3.5 3.5 0 0 1 0 7H7zM7 11h7a3.5 3.5 0 0 1 0 7H7z" fill="currentColor" />
  </F>
)
export const IItalic = () => (
  <F>
    <path d="M10 4h7M7 20h7M14 4l-4 16" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </F>
)
export const IUnderline = () => (
  <F>
    <path d="M7 4v6a5 5 0 0 0 10 0V4M5 20h14" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
  </F>
)
export const IReverse = () => (
  <Icon>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M9 16l3-8 3 8M10 13.5h4" />
  </Icon>
)
export const IColor = () => (
  <Icon>
    <path d="M12 3a7 7 0 0 0-7 7v1a3 3 0 0 0 3 3h1a2 2 0 0 1 2 2v1a3 3 0 0 0 3 3 7 7 0 0 0 7-7V10a7 7 0 0 0-7-7z" />
    <circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="16" cy="10" r="1.2" fill="currentColor" stroke="none" />
  </Icon>
)
export const IColorBg = () => (
  <Icon>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M9 16l3-8 3 8M10 13.5h4" />
  </Icon>
)
export const IAlignLeft = () => (
  <Icon>
    <path d="M4 6h12M4 10h16M4 14h12M4 18h7" />
  </Icon>
)
export const IAlignCenter = () => (
  <Icon>
    <path d="M4 6h12M2 10h16M4 14h12M6 18h12" />
  </Icon>
)
export const IAlignRight = () => (
  <Icon>
    <path d="M8 6h12M4 10h16M8 14h12M13 18h7" />
  </Icon>
)
export const IAlignJustify = () => (
  <Icon>
    <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </Icon>
)
export const IGroup = () => (
  <Icon>
    <rect x="4" y="9" width="7" height="9" rx="1" />
    <rect x="13" y="5" width="7" height="9" rx="1" />
    <path d="M11 13h2" />
  </Icon>
)
export const IUngroup = () => (
  <Icon>
    <rect x="4" y="9" width="7" height="9" rx="1" />
    <rect x="14" y="5" width="7" height="9" rx="1" />
  </Icon>
)
export const IProps = () => (
  <Icon>
    <path d="M5 4v7M5 15v5M12 4v3M12 11v9M19 4v9M19 17v3" />
    <circle cx="5" cy="13" r="2" />
    <circle cx="12" cy="9" r="2" />
    <circle cx="19" cy="15" r="2" />
  </Icon>
)

/* ---------- 对齐栏：对齐 ---------- */
export const IAlignL = () => (
  <Icon>
    <rect x="4" y="6" width="6" height="4" />
    <rect x="4" y="14" width="10" height="4" />
    <path d="M4 4v16" />
  </Icon>
)
export const IAlignT = () => (
  <Icon>
    <rect x="6" y="4" width="4" height="6" />
    <rect x="14" y="4" width="4" height="10" />
    <path d="M4 4h16" />
  </Icon>
)
export const IAlignR = () => (
  <Icon>
    <rect x="14" y="6" width="6" height="4" />
    <rect x="10" y="14" width="10" height="4" />
    <path d="M20 4v16" />
  </Icon>
)
export const IAlignB = () => (
  <Icon>
    <rect x="6" y="14" width="4" height="6" />
    <rect x="14" y="10" width="4" height="10" />
    <path d="M4 20h16" />
  </Icon>
)
export const IAlignMidV = () => (
  <Icon>
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="8" width="4" height="8" />
    <path d="M12 3v18" />
  </Icon>
)
export const IAlignMidH = () => (
  <Icon>
    <rect x="4" y="6" width="16" height="4" />
    <rect x="8" y="14" width="8" height="4" />
    <path d="M3 12h18" />
  </Icon>
)

/* ---------- 对齐栏：旋转 ---------- */
export const IRotateLeft = () => (
  <Icon>
    <path d="M4 8a8 8 0 1 1-1 4" />
    <path d="M4 4v4h4" />
  </Icon>
)
export const IRotate180 = () => (
  <Icon>
    <path d="M4 6h16M4 18h16" />
    <path d="M8 3l-4 3 4 3M16 15l4 3-4 3" />
  </Icon>
)
export const IRotateRight = () => (
  <Icon>
    <path d="M20 8a8 8 0 1 0 1 4" />
    <path d="M20 4v4h-4" />
  </Icon>
)

/* ---------- 对齐栏：尺寸 ---------- */
export const ISameW = () => (
  <Icon>
    <rect x="3" y="5" width="12" height="6" />
    <rect x="9" y="13" width="12" height="6" />
    <path d="M3 8h18M3 16h18" />
  </Icon>
)
export const ISameH = () => (
  <Icon>
    <rect x="4" y="3" width="6" height="12" />
    <rect x="14" y="9" width="6" height="12" />
    <path d="M7 3v18M17 9v12" />
  </Icon>
)
export const ISameWH = () => (
  <Icon>
    <rect x="3" y="6" width="12" height="6" />
    <rect x="9" y="12" width="12" height="6" />
  </Icon>
)

/* ---------- 对齐栏：居中 ---------- */
export const ICenterH = () => (
  <Icon>
    <rect x="6" y="7" width="12" height="10" rx="1" />
    <path d="M12 4v16" />
  </Icon>
)
export const ICenterV = () => (
  <Icon>
    <rect x="7" y="6" width="10" height="12" rx="1" />
    <path d="M4 12h16" />
  </Icon>
)

/* ---------- 对齐栏：间距 ---------- */
export const IDistH = () => (
  <Icon>
    <rect x="3" y="6" width="3" height="12" />
    <rect x="10.5" y="6" width="3" height="12" />
    <rect x="18" y="6" width="3" height="12" />
  </Icon>
)
export const IDistV = () => (
  <Icon>
    <rect x="6" y="3" width="12" height="3" />
    <rect x="6" y="10.5" width="12" height="3" />
    <rect x="6" y="18" width="12" height="3" />
  </Icon>
)

/* ---------- 对齐栏：顺序 ---------- */
export const IToFront = () => (
  <Icon>
    <rect x="8" y="8" width="8" height="8" rx="1" />
    <path d="M5 5h10M5 5v6" />
  </Icon>
)
export const IForward = () => (
  <Icon>
    <rect x="4" y="4" width="8" height="8" rx="1" />
    <rect x="12" y="12" width="8" height="8" rx="1" />
  </Icon>
)
export const IBackward = () => (
  <Icon>
    <rect x="12" y="12" width="8" height="8" rx="1" />
    <rect x="4" y="4" width="8" height="8" rx="1" />
  </Icon>
)
export const IToBack = () => (
  <Icon>
    <rect x="8" y="8" width="8" height="8" rx="1" />
    <path d="M5 16h10M5 16v-6" />
  </Icon>
)

/* ---------- 对齐栏：位置（贴标签边） ---------- */
export const ISnapTop = () => (
  <Icon>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <rect x="10" y="4" width="4" height="7" />
    <path d="M4 4h16" strokeWidth={2.4} />
  </Icon>
)
export const ISnapLeft = () => (
  <Icon>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <rect x="4" y="10" width="7" height="4" />
    <path d="M4 4v16" strokeWidth={2.4} />
  </Icon>
)
export const ISnapRight = () => (
  <Icon>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <rect x="13" y="10" width="7" height="4" />
    <path d="M20 4v16" strokeWidth={2.4} />
  </Icon>
)
export const ISnapBottom = () => (
  <Icon>
    <rect x="4" y="4" width="16" height="16" rx="1" />
    <rect x="10" y="13" width="4" height="7" />
    <path d="M4 20h16" strokeWidth={2.4} />
  </Icon>
)

/** 「添加或删除按钮」：工具条 + 加号 + 下拉箭头（帮助 toolbar_mainbar.html）。 */
export const ICustomize = () => (
  <Icon>
    <rect x="2.5" y="6" width="19" height="6" rx="1" />
    <path d="M6 16.5h12" />
    <path d="M12 15v6" />
    <path d="M9 18h6" />
  </Icon>
)
