本轮做两件 **P0-A** 的事（同一模块，不要跨模块）：

## 一、修掉 DIFF-6（上一轮标了已修但口径不对，已重开）

`app/src/renderer/src/App.tsx` 里 `labelSpecOf()` 现在这样做：`toFixed(2)` 强制两位小数 + 末尾写死 `20页/盒`。真机（`parity/reference/labelshop/44-statusbar.png`）是：

```
100mm x 70mm 圆角8枚/页 20页/盒
```

要求：
1. **毫米数不强制两位小数**：整数就不带小数位（`100mm` 而不是 `100.00mm`）；非整数才保留必要位数（最多两位）。
2. 形状名按布局：圆角 / 圆形 / 直角（对应 roundRect / ellipse|disc / rect）。
3. `N枚/页` = `layout.rows × layout.cols`；无布局信息或只有 1 枚时不追加后缀。
4. `M页/盒` **必须来自标签格式数据**，不能写死 `20`。若当前模板没有该数据就不显示这一段（退化为 `100mm x 70mm 圆角8枚/页`）。
5. `app/scripts/ui-v53.cjs` 里那条「状态栏标签规格含两位小数」的断言与真机不符，改成「整数/去尾零 + 形状名 + N枚/页（+ M页/盒 当有数据时）」的口径。
6. 注意区分：`选择标签格式` / `标签格式设置` 对话框里的只读行**仍然是两位小数 + 毫米**（真机：`标签：  100.00 毫米 X 70.00 毫米`，见 FINDINGS 第 11 条），不要跟着改成整数。

## 二、补 DIFF-3：新建标签的「模板向导」第一步

真机 `Ctrl+N` 先弹**模板向导**（`parity/reference/labelshop/30-wizard-1.png`），再弹 `选择标签格式`（`31-wizard-2.png`）；复刻版目前只有一步。要求：

1. 弹窗标题 `模板向导`，正文 `您可以选择打开一个现有的标签模板文档进行工作，也可以新建一个标签模板。`
2. `请选择：` 四个单选：`打开一个现有的标签模板` / `新建标签模板`（默认选中）/ `查看 LabelShop 联机帮助` / `查看 LabelShop 在线使用教程`
3. 底部复选框 `下次启动时不再使用向导`；按钮 `下一步`（默认）/ `取消`
4. 选「新建标签模板」→ `下一步` 进入现有的 `选择标签格式` 流程；选「打开一个现有的标签模板」→ 走打开文件流程；帮助/教程两项按等价方式动作（可在 `parity/diffs.md` 注明等价替代）
5. 「下次启动时不再使用向导」为真时，下次 `Ctrl+N` 直接进 `选择标签格式`（与真机行为一致）；该项要持久化（写 userData 配置）
6. 新增 CDP 断言：`ui-vNN.cjs` 覆盖「Ctrl+N 先出向导」「默认选中新建标签模板」「勾选不再提示后跳过向导」

## 完成标准

- 每收口一条就提交；提交前 `powershell -File tools/parity/Check-Matrix.ps1` 必须 exit 0。
- `parity/diffs.md` 的 DIFF-6 / DIFF-3 行更新为准确状态（DIFF-6 要写清小数与页/盒的来源）；`parity/matrix.md` 对应条目（A-166、A-33/A-34、A-41 等）标状态 + 证据。
- 改完重抓截图：`powershell -File tools/parity/MaxLabelCtl.ps1 -Action run -Scenario tools/parity/scenarios/editor.json`，以及 `main.json`；产物留在 `parity/reference/maxlabel/`。
- 不要改 `parity/reference/labelshop/` 证据文件；不要改 `tools/parity/LabelShopCtl.ps1`。
