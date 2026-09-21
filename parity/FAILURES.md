# 门禁失败 —— 已修（round-117）

- 上一轮门禁：round-116（2026-09-21 18:30:37，HEAD `b73855c`）
- 唯一失败项：`test:ui` → `FAILED SCRIPTS: ui-v108.cjs`（7/8）

## 结论：**真阳性**（回归，不是抖动）

- 复现：`MAXLABEL_UI_SCRIPT=ui-v108.cjs npm run test:ui` → **7/8，确定性失败**
  （失败断言：`A-201 USB 直连的条码标签打印机不可选择彩色打印（变色设置不提供）`）。
- 根因：round-116 提交 `fec35d6` 把「颜色变化模式」并入「常规」页的 `颜色(&C):` 时，
  渲染条件从 `colorChangeEnabled`（＝`colorGranularities.length > 0 && printerSupportsColor`）
  降成了 `colorGranularities.length > 0`（**只判对象类型、丢了打印机判据**）
  → USB 直连的普通条码标签打印机下，颜色模式下拉仍然渲染（实测 7 项可选），
  与帮助 `getstart_color.html`「普通条码标签打印机无法选择彩色打印」冲突。
- 修法：`app/src/renderer/src/dialogs/ObjectPropsDialog.tsx` 该行渲染条件改回 `colorChangeEnabled`。
  **未改任何断言、未降强度。**

## 复验

| 命令 | 结果 |
| --- | --- |
| `MAXLABEL_UI_SCRIPT=ui-v108.cjs npm run test:ui` | **8/8 PASS** |
| `MAXLABEL_UI_SCRIPT=ui-v74.cjs npm run test:ui` | 10/10 |
| `MAXLABEL_UI_SCRIPT=ui-v85.cjs npm run test:ui` | 7/7 |
| `MAXLABEL_UI_SCRIPT=ui-v92.cjs npm run test:ui` | 11/11 |
| `MAXLABEL_UI_SCRIPT=ui-v125.cjs npm run test:ui` | 19/19 |
| `npm test` / `npm run typecheck` | exit 0 |

台账：`parity/diffs.md` DIFF-72 段已补「round-117 回归修复」小节。
