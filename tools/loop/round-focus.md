本轮先看 `parity/FAILURES.md` 与 `tools/loop/last-gates.md`：有失败就先修失败。然后做 **DIFF-13（对象属性交互方式）**，它是我（验收方）实测确认的核心操作习惯差异。

## 实测证据（我已跑通复刻版的对象链路）

复刻版对象创建**可用**：场景脚本 `tools/parity/scenarios/object-flow.json`（进入编辑态 → `clicktitle:"文字"` 选工具 → `clickxy` 在画布放置 → 双击）。产物截图：
- `parity/reference/maxlabel/B1-text-placed.png`：选中态——右侧出现内嵌「属性」面板，页签为 `数据源` / `文本样式` / `常规`；画布上是 `文字内容` 对象（25.25, 22.75 / 40×8mm）；状态栏对象信息段显示 `X:25.25, Y:22.75; W:40.00, H:8.00 毫米` ✓
- `parity/reference/maxlabel/B2-text-props.png`：**双击对象后**——属性面板消失、退回「打印」面板，对象被取消选中，**没有打开任何属性界面**

## 原版行为（必须对标）

1. **双击对象 = 打开该对象的属性对话框**。帮助原文 `app/docs/labelshop-help-zh/label_object_edit.html` 与真机状态栏提示「选取对象、移动对象，双击修改对象属性」都明确写了；`Alt+Enter` 是同一入口。
2. 属性界面是**模态对话框**，按对象类型有不同页签，页签名以帮助原文为准：
   - 通用页 `label_object_page_general.html`、文字页 `label_object_page_text.html`、字体页 `label_object_page_font.html`、数据页 `label_object_page_data.html`
   - 条码对象还有码制专页（`label_object_page_barcode_*.html`）
3. 对话框底部按钮顺序按帮助原文（一般为 `确定` / `取消` / `应用` / `帮助`，以 `61-dlg-custom-label.png` 与 `FINDINGS.md` 记录的「标签格式设置」为准）。

## 要求

1. **双击对象必须打开属性对话框**（不是取消选中）；`Alt+Enter` 打开同一对话框；对象未选中时 `Alt+Enter` 给出提示而不是静默。
2. 属性对话框的**页签名称与顺序**对齐帮助原文；字段与默认值延续 round-10 的实现（若 round-10 已把页签做进右侧面板，本轮把它做成模态对话框，或保留面板但把所有页签名/字段对齐原版并在 `parity/diffs.md` 注明「等价替代」）。
3. 右侧内嵌面板的去留存由你判断，但要满足：**入口与操作习惯与原版一致**（双击/Alt+Enter 开属性），且不能出现"两个地方都能改同一属性却不同步"。
4. 新增 CDP 断言（`app/scripts/ui-vNN.cjs`，挂进 `app/scripts/run-regression.ps1`）：双击对象后对话框出现且标题/页签正确；`Alt+Enter` 同样能打开；关闭后画布对象仍被选中。
5. 用 `tools/parity/scenarios/object-flow.json` 重抓证据截图（`B1`/`B2` 会被覆盖），并在 `parity/diffs.md` 更新 DIFF-13 状态、`parity/matrix.md` 标注对应 B 章节条目（证据写测试名 + 截图名）。
6. 顺带把上面实测里已达标的两点写进矩阵证据：状态栏标签规格 `100mm x 70mm 圆角8枚/页 20页/盒`（A-166）与对象信息段（A-169）。
7. 边做边提交；提交前 `powershell -File tools/parity/Check-Matrix.ps1` 必须 exit 0。不要改 `parity/reference/labelshop/` 下真机证据；不要改 `tools/parity/LabelShopCtl.ps1`。
