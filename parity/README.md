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
