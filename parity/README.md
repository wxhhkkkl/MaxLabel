# Parity 工程说明（复刻 LabelShop 的验收基准）

本目录是「MaxLabel 复刻真机 LabelShop」这件事的**证据与判定中心**。代码可以改，这里的东西是判定依据。

## 目录

| 路径 | 用途 |
| --- | --- |
| `matrix.md` | 功能清单，逐条列原版行为要点与复刻状态（`待核`/`部分`/`未实现`/`已实现`）+ 证据 |
| `matrix-sources.md` | 帮助文档文件 → 清单编号区间对照 |
| `backlog.md` | 按优先级的攻坚队列（每轮从这里取活） |
| `progress.md` | 每轮循环的自动记录（codex 汇报 + 门禁结果） |
| `FAILURES.md` | 最近一次门禁失败详情；非空时下一轮必须先修它 |
| `diffs.md` | 已识别但尚未收口的界面/行为差异（逐条消项） |
| `reference/labelshop/` | **真机截图与窗口取证**（权威基准，只读） |
| `reference/maxlabel/` | 复刻版同场景截图（对照用） |

## 真机取证与截图对照

```powershell
# 真机：启动并抓主界面（窗口会最大化，截图进 reference/labelshop）
powershell -File tools/parity/LabelShopCtl.ps1 -Action capture -Label main

# 真机：脚本化驱动（Alt 加速键打开菜单、Ctrl+N 打开模板向导、截图、关对话框）
powershell -File tools/parity/LabelShopCtl.ps1 -Action run -Steps 'keys:%f','sleep:1200','shotscreen:10-menu-file','close'

# 复刻版：构建 + 启动 + CDP 驱动截图（场景脚本在 tools/parity/scenarios/）
powershell -File tools/parity/MaxLabelCtl.ps1 -Action capture
powershell -File tools/parity/MaxLabelCtl.ps1 -Action run -Scenario tools/parity/scenarios/editor.json
```

- 真机是 MFC Feature Pack（Ribbon 风格菜单 + 工具栏 + 格式栏 + 对齐栏 + 状态栏，无经典 Win32 菜单），**点击菜单栏不可靠，用 Alt 加速键**（`文件(F)` → `%f`，`查看(V)` → `%v`，`账户(A)` → `%a`，`云马通(C)` → `%c`，`选项(O)` → `%o`，`帮助(H)` → `%h`）。
- 启动时会弹「管理软件许可」模态框，取证脚本会自动关掉；如需留证用 `-KeepDialogs`。
- 复刻版截图用 DOM 文本定位（`{"op":"click","text":"新建标签"}`），真机用坐标/快捷键定位。

## “相似度很高”的判定标准（全部满足才算达标）

1. **功能 parity**：`matrix.md` 中 P0 条目 100% `已实现` 且有可复现证据；P1 ≥ 90%；不存在"入口存在但点了没反应/是占位"的条目。
2. **界面 parity**：下列核心界面与 `reference/labelshop/` 同名场景截图逐项对照，布局层级、控件位置关系、文案、默认值一致（允许因技术栈不同的绘制风格差异）：
   启动页、主框架（菜单/工具栏/格式栏/对齐栏/标签页/状态栏）、选择标签格式、编辑画布（标尺/网格/选中手柄）、对象属性页各页签、数据源、数据库、打印对话框、打印机配置、打印预览、选项、关于。
3. **操作习惯 parity**：`shortcut_main.html` 的快捷键全量可用；菜单项与工具栏按钮全部接线；未保存关闭流程、多标签页流程、右键菜单流程与原版一致。
4. **打印链路 parity**：TSPL/ZPL/CPCL 指令输出有快照测试；打印到文件/预览/日志链路在无真机条件下可验证；RFID、拼版、序列号推进顺序与原版一致。
5. **门禁全绿**：`typecheck`、`test:architecture`、`test:editor`、`test:geometry`、`test:history`、`test:print`、`test:render`、`test:workspace`、`test:ui`、`build` 全部通过，且新增行为有对应回归测试。

## 循环怎么跑

```powershell
# 后台连续跑 N 轮（每轮 = 新 codex 会话 + 独立门禁 + 失败反馈 + 零进展/失败自动停）
powershell -File tools/loop/Run-ParityLoop.ps1 -Rounds 12
```

- `tools/loop/round-prompt.md`：每轮交给 Codex 的契约（流程、门禁、禁止事项）。
- `tools/loop/round-focus.md`：给**下一轮**的附加指令（可选，循环控制者写）。
- `tools/loop/round-images.txt`：每行一个图片路径，会以 `-i` 附件形式喂给 Codex（视觉对照）。
- `tools/loop/STOP` / `tools/loop/PAUSE`：优雅停止开关。
- `tools/loop/logs/`：每轮 codex 原始输出与门禁日志。

## 护栏

- 门禁由**循环控制者**（验收方）执行，不采信 Codex 自述。
- 连续 3 轮门禁失败 → 回滚到上一个全绿提交（改动进 stash 保留）。
- 连续 3 轮零进展（HEAD 未变、工作区干净、matrix/backlog 未更新）→ 循环自动停止并报告。

## 已知取证边界（不要再重复尝试）

- **原版画布上的「拖拽创建对象」无法用本工装复现**：本机鼠标注入（`mouse_event`）对原版无效；改用窗口消息（`postclick`/`postdbl`/`postdrag` 投递 WM_LBUTTONDOWN/MOUSEMOVE/UP 到文档视图）虽能触发「双击空白画布 → 标签格式设置」这类逻辑，但**不会真的生成对象**（已验证：拖拽后标签区域仍为纯白）。
- 因此 **62 数据源对话框、67 文字对象属性、68 条码对象属性** 三份真机截图**无法采集**；`64 打印机配置` 只拿到「高级打印选项」两个页签（`64a`/`64b`）。
- 结论：**B（编辑器对象能力）与 C（数据源与数据库）模块以帮助原文为准**（`app/docs/labelshop-help-zh/label_object_page_*.html`、`datasource_*.html`、`database_*.html`），矩阵条目本身就是从这些原文提炼的；不要为了拿截图而反复尝试鼠标操作。
- 原版软件未激活（`[ 标准版 - 未激活 ]`），部分联网功能（云标签库、云数据库）在真机上不可用；这类条目在矩阵里注明「未激活不可取证」。

## 复刻版 UI 自动化的两个要点（已踩通，后续轮次直接复用）

1. **fabric 6/7 监听的是 PointerEvent**：只派发 `MouseEvent` 点不中画布。`tools/parity/maxlabel-cdp.cjs` 的 `clickxy` / `dblclickxy` 已同时派发 `pointerdown`/`mousedown`/`pointerup`/`mouseup`/`click`，用它们可以在画布上放置对象。
2. **工具栏图标按钮没有文字**，用 `clicktitle`（匹配 `title` / `aria-label` / `data-tool`）点击，例如 `{"op":"clicktitle","text":"文字"}`。
3. 现成链路：`tools/parity/scenarios/object-flow.json` = 进入编辑态 → 选文字工具 → 画布放置 → 双击，用于验证对象创建与属性入口。

## D 模块（打印链路）能验到什么程度（验收方已核查）

- **可以做**：打印对话框/打印机配置/预览/日志的字段与流程对照（真机 `63-dlg-print.png`、`64a`/`64b`、帮助 `print_*.html`）；指令输出的**结构合规性**（`cd app; npm run fixtures:print` 产出的 `fixtures/protocol/{tspl,zpl,cpcl}-80x60-203dpi.prn`，逐条核对标准语法）；位图/预览/指令三路共用 `ResolvedPrintScene` 的一致性（`npm run test:print` / `test:render`）。
- **不能做**：真机指令方言、内建字体、RFID/切刀/回卷/状态回读、各 DPI 下的实际偏差 —— 需要目标打印机硬件；真机软件为**未激活版**，`导出打印机指令文件` 与 `打印到文件`（专业版）不可用，因此拿不到原版指令样本。此类条目在矩阵证据列统一注明「需硬件实测」。
