# round-107b P0 追加 4 真机取证：`孔洞 = 矩形` 的尺寸框与几何

日期：2026-09-21。真机 `C:\Program Files (x86)\LabelShop\LabelShop\LabelShop.exe` V6.39。
（文件名用 `round107b` 前缀，避免与本轮另一条已入库的 `PROBE-round107.md`（打印机「工具」页）撞名。）

## 取证路径

1. `LabelShopCtl.ps1 -Action run -KeepOpen -Steps @('click:900,60','sleep:800','keys:^{n}','sleep:3000','btn:新建标签模板','sleep:1500','btn:下一步','btn:自定义')`
   → 进入「标签格式设置」，当前页「标签」，当前格式 `[608053] 100mm x 70mm 圆角8枚/页 20页/盒`。
2. `Probe-LabelShopCombos.ps1 -TitleLike '*标签格式设置*' -SetCombo 0 -SetIndex 2` 把 `孔洞` 切到「矩形」。
3. `Read-LabelShopDialogValues.ps1 -TitleLike '*标签格式设置*' -IncludeDisabled` 读值。
4. `Read-LabelShopDialogTree.ps1 -TitleLike '*标签格式设置*' -MaxDepth 6` 读控件树（含 enabled/可见性）。
5. `shotdlg:r107b-hole-rect-zero` / 手工把尺寸框设为 20 后再 `shotdlg:r107b-hole-rect-20` 看预览。

## 证据文件

- `probe-round107b-hole-rect-combos.txt`：`孔洞` 3 项 `无 / 圆洞 / 矩形`，`形状` 3 项 `方角矩形 / 圆角矩形 / 圆形`。
- `probe-round107b-hole-rect-tree.txt`：切到「矩形」后的控件树。
- `probe-round107b-hole-rect-values.txt`：切「无」与切「矩形」两次的值 dump。
- `r107b-hole-rect-zero.png`：`孔洞 = 矩形`、尺寸 `0.00` 时的对话框（1065x948）。
- `r107b-hole-rect-20.png`：同上、尺寸框手工填 20 之后。
- `r107b-editor-rect-hole.png`：点「确定」后回到的新标签编辑器。

## 结论三态

### `孔洞 = 矩形` 有几个数值：原版有（**一个**）

`孔洞` 组在真机上有 **一个** 尺寸 Edit（id 未公开，xy=(1335,1087) 80x36）＋ 一个 `毫米` Static。
切到「矩形」后仍然只有这一个，**没有第二个数值框**；`-IncludeDisabled` 两次 dump 都只列出这一个 Edit。

### 尺寸框的启用规则：原版有

- `孔洞 = 无`：该 Edit 在树里是 `DISABLED`，值 dump 里根本不出现（空框）。
- `孔洞 = 矩形`：同一 Edit 变 `enabled`，值自动为 `0.00`。
（`孔洞 = 圆洞` 为 round-105/106 已采信的启用形态，同一控件。）

→ 复刻版据此把尺寸框的 `disabled` 从 `hole !== 'circle'` 改成 `hole === 'none'`，
并把无孔格式的兜底尺寸由 `15` 改成 `0`（真机切过去显示 `0.00`）。

### `矩形` 孔在预览里长什么样：**取不到证据**（登记为待取证）

真机该对话框的预览区（上方 8 格示意图 + `100mm` / `70mm` 标注）在 `矩形 + 0.00` 与 `矩形 + 20` 两张截图
之间**完全相同**——预览不渲染孔洞；帮助 `label_page_label.html` 也只说「孔洞位于标签的中心」，
且「重要说明：标签的形状/孔洞 **只在编辑标签时显示，并不会实际输出**」。
点「确定」回到编辑器（`r107b-editor-rect-hole.png`，261% 缩放）后，画布上同样看不到孔。

试过但没取到像素证据的手法（写清以免重复踩）：
- `WM_SETTEXT` + `EN_CHANGE`/`EN_UPDATE` 注入尺寸 → `Read-LabelShopDialogValues` 回读到 `20`，但预览无变化；
- 直接截图预览区逐像素比对 → 两张图一致；
- 「确定」后编辑器画布 → 无孔。

→ 因此 `矩形` 孔的**精确画法（正方形边长 / 对角 / 是否圆角）没有真机像素证据**。
按"单一尺寸框 + 单一毫米值"这一**已确证**的事实，实现取 **居中正方形、边长 = 输入值(mm)**；
圆洞保持"直径 = 输入值"。若日后取到真机像素，只需改 `paper.ts:paperPath()` 一处。

### `应用(A)` 按钮：原版有但**隐藏**

真机控件树里它是 `[ ] class=Button DISABLED text='应用(&A)'`——`[ ]` 表示窗口不可见；
`r107b-hole-rect-zero.png` 底排只有 `确定 / 取消 / 帮助` 三个按钮。
所以复刻版把该按钮改为 `hidden`（保留 testid 供断言），而不是画一个真机没有的灰按钮。

## 实现映射（单一来源）

| 消费点 | 改动 |
| --- | --- |
| `app/src/shared/domain/paper.ts` | `PaperGeometry` 加 `innerShape?: 'circle' \| 'rectangle'`；`paperPath()` 里 `cutout` 按 `innerShape` 分叉（矩形＝四条直线，无弧） |
| `CustomLabelFormatDialog.tsx` | `hole !== 'none' && holeSize > 0` 时写 `{ innerDiameterMm, innerShape }`；尺寸框 `disabled={hole === 'none'}` |
| `NewLabelDialog.tsx` | 无孔格式的 `holeSize` 兜底 `15 → 0`（对齐真机 `0.00`） |
| `PaperFields` / `LabelEditor` / `renderLabel` / `print/scene.ts` | **不改**——全部只经 `paperPath()`，未传 `innerShape` 即保持历史圆洞语义 |

断言：`app/scripts/ui-v130.cjs`（已注册 `run-regression.ps1`），逐条钉住
`无 → 尺寸框禁用且无切孔`、`圆洞 → 弧线切孔`、`矩形 → 直线切孔且逐字等于 `M 45 30 H 55 V 40 H 45 Z`（100x70 居中 10mm 正方形）`、
`圆角矩形轮廓半径仍为 1mm`。
