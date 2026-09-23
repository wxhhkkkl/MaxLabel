/**
 * MFC 控件标题 → 屏幕显示文本（DIFF-83）。
 *
 * 原版是 MFC 程序，控件标题里嵌的是 **Windows 加速键标记**：
 * 真机控件树 dump 里读到的是 `条码符号类型(码制)(&B):`，但 MFC 渲染到屏幕上是
 * `条码符号类型(码制)(B):` —— `&` 本身**不显示**，只是把后面的字符变成带下划线的加速键。
 * 这张并排图（`parity/review/cmp-propsbarcode-1741523.png`，左＝真机实拍、
 * 右＝复刻版）是直接证据：真机整页没有一处 `&`，复刻版每处都多渲染了一个 `&`。
 *
 * 复刻版为了"照抄真机控件树原文"把 dump 里的 `(&X)` 原样写进了 React 标签，
 * 于是用户看到的是字面量 `(&B)` —— 与真机可见行为不符。本模块是**唯一**的转换点。
 *
 * 规则（与 MFC `CWnd::SetWindowText` + `DrawItem` 的加速键语义一致）：
 * - `&&` → 输出一个 `&`（转义写法，屏幕上就是一个 `&`）；
 * - 单个 `&` → 加速键标记，**不输出**；
 * - 末尾孤立的 `&` → 同上，不输出。
 */
export function displayMfcCaption(caption: string): string {
  let out = ''
  for (let i = 0; i < caption.length; i += 1) {
    if (caption[i] !== '&') {
      out += caption[i]
      continue
    }
    if (caption[i + 1] === '&') {
      out += '&'
      i += 1
    }
    // 单个 `&`：加速键标记，渲染时不显示。
  }
  return out
}

/**
 * 取出 MFC 标题里的加速键字符（真机屏幕上看不到它，但按键可用）。
 * 没有加速键时返回 `null`。
 */
export function acceleratorOf(caption: string): string | null {
  for (let i = 0; i < caption.length; i += 1) {
    if (caption[i] !== '&') continue
    const next = caption[i + 1]
    if (next === undefined || next === '&') {
      i += 1
      continue
    }
    return next
  }
  return null
}

/** 源码里是否残留**字面量**加速键（`(&X)` 形态）——供静态校验使用。 */
export const LITERAL_ACCELERATOR_PATTERN = /\(&[A-Za-z0-9]\)/
