本轮先看 `parity/FAILURES.md` 与 `tools/loop/last-gates.md`：

## 第一优先：修掉门禁失败（若 FAILURES.md 非空）

**已确认的回归（round-05 引入，必须修）**：
1. `test:workspace` 失败：渲染层抛 `paper origin must coincide with horizontal ruler zero: 32 vs 47.33...`
   —— 断言在 `app/scripts/workspace-regression.tsx:38`，含义是**纸张左边缘的 X 必须与水平标尺的零点刻度重合**（原版 LabelShop 就是标尺零点对齐纸张原点）。第 5 轮改了 `WorkArea.tsx`/`FormatBar.tsx`/`AlignmentBar` 后，纸张原点(32) 与标尺零点(47.33) 差了约 15px。
   修的时候要**同时保证**：纸张在两轴标尺下的可见区域、标尺零点刻度、网格原点三者一致；并且 `test:workspace` 与 `test:ui` 都要重新全绿。
2. `test:ui` 失败：第 5 轮新写的 `app/scripts/ui-v52.cjs` 有两条断言失败：
   - `空格+左键拖动平移` —— 原版行为：按住空格进入平移模式，此时左键拖动应平移工作区（`label_view_scale.html` / 快捷键表）。
   - `Ctrl+W 关闭当前文档` —— 原版行为：关闭当前标签模板（快捷键表 `文件操作` 组）。注意要保留未保存文档的「保存/不保存/取消」流程。
   这两条要么实现掉，要么如果判定断言写法不对就修正断言并在汇报里说明依据。

## 第二优先：继续 P0-A（若 FAILURES.md 已空）

按 `parity/diffs.md` 收口这几条（原版证据见括号里的真机截图）：

- **DIFF-5/6/7 状态栏**（`44-statusbar.png`，真机为 6 段）：第 1 段只放打印机名（不要 `TSPL @203dpi ·` 前缀）；第 2 段格式 `<宽>x<高>mm <形状名><N>枚/页 <M>页/盒`；**保留「对象信息」段**（原版有）；鼠标位置/对象信息**无内容时只显示图标、不显示占位文字**；缩放段只显示一个百分比（去掉 `76% ⇄ 100%` 双值）
- **DIFF-8 打印面板瘦身**（`46-right-print-panel.png`、`63-dlg-print.png`）：面板只保留「输入数据」+「打印机（名称 + 设置）」+「打印数量 / 单签拷贝」+「打印」按钮；把 5 个复选框移进 `Ctrl+P` 打印对话框
- **DIFF-9 图层面板**（`45-left-panel.png`）：6 个工具按钮（新建图层/设置/复制图层/删除图层/重命名/图层属性）+ 列表三列（眼睛/图层名/锁）
- **DIFF-10**：打印面板标题 = `打印 - <当前文档名>`

## 完成标准

- 每收口 1-2 条就提交，提交前跑 `powershell -File tools/parity/Check-Matrix.ps1`（必须 exit 0）。
- `parity/matrix.md` 对应条目改 `已实现` + 写证据；`parity/diffs.md` 勾掉对应行；`parity/backlog.md` 勾掉已完成项。
- 改完必须重抓复刻版截图留证：`powershell -File tools/parity/MaxLabelCtl.ps1 -Action run -Scenario tools/parity/scenarios/editor.json`（产物在 `parity/reference/maxlabel/`），并在汇报里说明与真机截图的对应关系。
- 不要改 `parity/reference/labelshop/` 下的真机证据；不要改 `tools/parity/LabelShopCtl.ps1`。
