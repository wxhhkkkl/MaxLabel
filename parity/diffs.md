# 已识别的界面/行为差异台账（逐条消项）

规则：每条必须有**原版证据**与**复刻版证据**，收口后勾掉并在 `matrix.md` 对应条目写证据。
证据目录：原版 `parity/reference/labelshop/`，复刻版 `parity/reference/maxlabel/`，并排对照图 `parity/review/`。

| 编号 | 差异 | 原版证据 | 复刻版证据 | 目标 | 状态 |
| --- | --- | --- | --- | --- | --- |
| DIFF-1 | 菜单文案「云服务(C)」应为「云马通(C)」 | `40-editor.png` | round4 前 `00-main.png` | 逐字一致 | ✅ 已修（round4，`labelShopMenus.ts`） |
| DIFF-2 | 起始页内容区为简化版，缺原版「重要通知/签赋学堂/各类不干胶标签」内容块与客服/最近区结构 | `00-main.png` + `START-PAGE-SPEC.md` | `00-main.png` + `ui-v54.cjs` | 分区、文案、数据来源对齐 | ✅ 已修（round-08，StartPage.tsx + styles.css；运营位为等价自制素材） |
| DIFF-3 | 原版「新建标签」是「模板向导 → 选择标签格式」两步；复刻版原先只有一步 | `32-dlg-template-wizard.png`、`60-dlg-choose-label.png` | `TemplateWizardDialog.tsx`、`ui-v55.cjs`、`parity/review/r09-wizard.png` | 两步流程 + 「下次启动时不再使用向导」持久化 | ✅ 已修并由验收方核对（round-09） |
| DIFF-4 | 状态栏文案与字段（见 DIFF-5/6/7 细化） | `44-statusbar.png` | `02-editor.png`、`ui-v53` | 六段字段顺序与空值显示规则已对齐 | ✅ 已修（round-07，StatusBar.tsx + App.tsx） |
| DIFF-5 | 状态栏第 1 段：复刻版 `TSPL @203dpi · OneNote (Desktop)`，原版只有打印机名 `Microsoft Print to PDF` | `44-statusbar.png` | `02-editor.png`、`ui-v53` | 第 1 段只放打印机名；指令集/端口信息不应挤在状态栏 | ✅ 已修（round-07，ui-v53「打印机段仅显示名称」） |
| DIFF-6 | 状态栏第 2 段格式已按真机收口：整数毫米不显示小数，非整数最多保留两位；形状按布局显示圆角/圆形/直角；`N枚/页` 使用 rows×cols；`M页/盒` 只从标签格式数据 `layout.pagesPerBox` 读取，缺失时省略 | `44-statusbar.png`、`LABEL-FORMAT-SPEC.md`（Label_TotalLabels 语义） | `features/workspace/labelSpec.ts`、`NewLabelDialog.tsx`、`document.ts` | `100mm x 70mm 圆角8枚/页 20页/盒`；无页/盒数据时退化为 `Wmm x Hmm 形状N枚/页`；只读对话框仍保留两位小数 | ✅ 已修（round-09）并由**验收方实测复核**：状态栏实测 `100mm x 70mm 圆角8枚/页 20页/盒`，证据 `parity/reference/maxlabel/B1-text-placed.png` |
| DIFF-7 | 复刻版缩放显示为滑块 + `76% ⇄ 100%` 双值；原版状态栏只有一个百分比（`201%`）。**注意：原版状态栏确实有「对象信息」段（帮助文档 A-169 + `44-statusbar.png` 第 5 个图标），不要删掉它**；原版空值字段只显示图标、不显示占位文字 | `44-statusbar.png` | `02-editor.png`、`ui-v53` | 六段状态栏保留对象信息；鼠标/对象信息空值只留图标；缩放只显示一个百分比且范围 50–400 | ✅ 已修（round-07，StatusBar.tsx + ui-v53 空值/选中对象断言） |
| DIFF-8 | 复刻版把 5 个打印复选框放在右侧打印面板；原版打印面板只有「输入数据」+「打印机（名称+设置）」+「打印数量/单签拷贝」+「打印」按钮 | `46-right-print-panel.png`、`63-dlg-print.png` | `02-editor.png`、`ui-v53` | 面板瘦身；复选框按原版归属与**原文标签**搬进 `Ctrl+P` 打印对话框 | ✅ 已修（round-07，ui-v53「打印面板仅保留原版基础字段」与「Ctrl+P承载高级选项」） |

**DIFF-8 补充：这些选项在原版里的确切归属与标签**（来自帮助原文 `print_dlg_main.html`、`print_dlg_dbs.html`，复刻时必须照抄标签文字）

- 打印对话框分组：`打印机`（名称 / 位置 / 打印机属性）、`打印范围`（打印数量 / 单签拷贝 / **启始记录** / `只打印数据表中当前记录行的数据`）、`设置`（`打印后更新变量数据` / **`打印标签边框`** / `旋转180度输出`）
- 按钮：`预览` / `打印` / `测试打印`（测试打印不写日志、不自动更新变量）
- 右侧另有 `选择起始标签（仅页式打印机有效）` 与 `自动跟踪起始标签位置`
- `高级选项` → 页签 `页眉页脚` / `定位裁切标记`；**数据库打印高级选项**包含：
  `打印时自动设置数据库记录数量`（复刻版现写作"打印时自动更新数据库记录数量"，标签错）、`拷贝数量从数据库字段引入`、`字段名称`、`允许打印时输入第一个标签的拷贝数量`
- 复刻版面板上的 `打印时数据查重` / `打印拷贝序列号/数量` 在帮助里没有对应原文标签，需按帮助重新命名或删除（`print_dupcheck.html` 只提到查重功能，未给出复选框文字）
| DIFF-9 | 左侧「图层」面板：原版 6 个工具按钮（新建图层/设置/复制图层/删除图层/重命名/图层属性）+ 列表三列（眼睛/图层名/锁）；复刻版按钮与列结构需对齐 | `45-left-panel.png` | `02-editor.png`、`ui-v53` | 按钮数量、顺序、列表列对齐 | ✅ 已修（round-07，ui-v53「图层面板六个工具按钮顺序正确」与「图层列表三列且保留默认层」） |
| DIFF-10 | 右侧打印面板标题：原版 `打印 - <文档名>`；复刻版需确认同样跟随文档名 | `46-right-print-panel.png` | `02-editor.png`、`ui-v53` | 标题 = `打印 - <当前文档名>` | ✅ 已修（round-07，ui-v53「打印面板标题跟随当前文档」） |
| DIFF-11 | 菜单加速键冲突与缺失：原版 `排列(A)` 与 `账户(A)` 抢同一加速键（实际落到账户），`建议与反馈` 无加速键 | `40-editor.png`、`54`/`59` | `labelShopMenus.ts`、`ui-v51.cjs` | 复刻版**原样复现**该行为（`排列(A)`/`账户(A)` 并存、`Alt+A` 打开账户、`排列` 仍可点击），非等价替代而是行为一致 | ✅ 已收口（验收方复核：ui-v51.cjs「重复加速键Alt+A按原版打开账户」断言通过） |

## 起始页差异细分（DIFF-2，已用并排对照图核实：`parity/review/r04-startpage-compare.png`）

| 子项 | 原版（`00-main.png`） | 复刻版（`00-main.png`） | 要求 |
| --- | --- | --- | --- |
| ✅ 2.1 左栏顶部 | 吉祥物头像图 + `未登录` | 吉祥物头像图 + `未登录`，无 `MaxLabel` 品牌标题行 | 去掉品牌标题行，改成头像图 + `未登录`（登录态显示账号） |
| ✅ 2.2 计数格 | `优惠券`/`待支付`/`待收货` 三格（示例值 0/0/0） | 结构一致 | 保持一致，计数来源与刷新时机需与缓存一致 |
| ✅ 2.3 开始列表 | 7 行，顺序：`客服1QQ：1669809392` / `客服2QQ：3395913685` / `客服电话：4000-987-360` / `新建标签模版` / `打开标签模版` / `打开本机模版` / `下载云马通APP`（橙色）；`开始` 行右侧橙色 `云马通首页`。**用字是「模版」不是「模板」**（真机 2 倍放大件 `parity/review/real-startpage-left.png` 逐字核对） | 7 行，顺序、文案与原版一致，客服三行在前，保留协议 href | 按原版 7 行原文与顺序；云服务/授权入口放菜单或账户菜单 |
| ✅ 2.4 客服三行 | 在 `开始` 列表**内**（无独立容器），位于「新建/打开」四项之前 | 三行均在 `开始` 列表内且位于新建/打开四项之前 | 归位到 `开始` 列表内，号码照抄：`客服1QQ：1669809392` / `客服2QQ：3395913685` / `客服电话：4000-987-360` |
| ✅ 2.5 最近 | 有示例条目 `test`（本地最近文件列表） | 读取 `RecentFile` 镜像数据；无记录显示 `暂无最近文件`，有记录显示文件标题并保留路径 | 结构与数据源对齐（本地最近文件），空态显示 `暂无最近文件`，点击生成 `LabelShop:OpenDocument:<路径>` |
| ✅ 2.6 右侧内容区 | 上排 `重要通知` 卡（蓝色渐变 + 两段正文 + `购买点击` 按钮）与 `签赋学堂` 卡（深蓝）并排；下接 `各类不干胶标签` 大横幅（`整箱下单·更优惠`、`厂家直销`、购买按钮）；再下 `最新文章` 列表（3 条，含日期） | 按顶部广告位、`最新文章`、下载块三段展示；广告图文采用等价自制素材 | 按原版分区结构重排；运营图文（吉祥物/横幅/文章）用等价自制素材占位，尺寸与位置对齐，矩阵里注明「等价替代」 |


## ✅ DIFF-12 选择标签格式对话框（最新对照图 `parity/review/r09-choose.png`，原版 `60-dlg-choose-label.png`）

**已收口**：标题、预览尺寸标注、只读信息行、`选择标签` 分组框、打印机安装入口、四个按钮及 275 条原始标签格式库均已对齐；默认记录为 `[608053] 100mm x 70mm 圆角8枚/页 20页/盒`。

| 子项 | 原版 | 复刻版 | 要求 |
| --- | --- | --- | --- |
| 12.1 预览尺寸标注 | 预览网格上方标 `100mm`、右侧标 `70mm`（带尺寸线） | 已实现 `100mm` / `70mm` 及尺寸线 | `ui-v72.cjs`、`DIFF12-choose-label.png` |
| 12.2 只读行格式 | `纸张：  210 毫米 X 297 毫米` / `标签：  100.00 毫米 X 70.00 毫米` | 已逐字对齐 | `ui-v72.cjs`、`DIFF12-choose-label.png` |
| 12.3 「选择标签」分组框 | 四个下拉包在 `选择标签` 分组框内 | 已实现 `fieldset` 分组框 | `ui-v72.cjs`、`DIFF12-choose-label.png` |
| 12.4 打印机行 | `打印机(P):` 下拉 + `安装(I)` 按钮 | 已实现，接入打印机安装入口 | `ui-v72.cjs`、`ModalHost.tsx` |
| 12.5 多余字段 | 无 `外形形状` / `孔洞` 字段（它们在 `标签格式设置` 对话框里） | 已从本对话框移除 | `ui-v72.cjs` |
| 12.6 按钮 | `选择(Q)` / `自定义(N)` / `取消(C)` / `帮助(H)`，`选择(Q)` 为默认按钮 | 已实现按钮顺序、加速键与默认高亮 | `ui-v72.cjs`、`DIFF12-choose-label.png` |
| 12.7 标签名称数据 | 275 条（品牌 2 / 类型 17），原件见 `LABEL-FORMAT-SPEC.md` 与 `sources/LabelFormat360.fmt` | 已导入 275 条原顺序记录，按品牌/CateName 联动，不 Trim | `labelFormats.generated.ts`、`generate-label-formats.cjs`、`label-formats.test.ts` |

证据：`app/scripts/ui-v72.cjs`（8/8）、`npm run test:label-formats`（12/12）、`parity/reference/maxlabel/DIFF12-choose-label.png`。

## ✅ DIFF-13 对象属性交互方式（模块 B 核心操作习惯，round-11 已收口）

| 子项 | 原版 | 复刻版实测 | 要求 |
| --- | --- | --- | --- |
| 13.1 双击对象 | 打开该对象的**属性对话框**（帮助 `label_object_edit.html`；真机状态栏提示原文就是「选取对象、移动对象，双击修改对象属性」） | 双击对象逻辑框打开模态属性对话框，并同步 Fabric/图层选中态 | 双击对象必须打开属性编辑界面 |
| 13.2 属性界面形态 | **模态属性对话框**，多页签（通用 / 文字 / 字体 / 数据 …，逐对象类型不同） | `ObjectPropsDialog` 以模态遮罩呈现，文字页签为 `通用` / `文字` / `字体` / `数据`；单击选中时保留内嵌面板作为即时编辑补充 | 对齐为模态对话框 + 原版页签名；内嵌面板与同一对象模型同步 |
| 13.3 `Alt+Enter` | 打开当前选中对象的属性对话框 | 与双击复用同一 `props` 模态入口；关闭/取消后图层行仍保持选中 | 与 13.1 复用同一入口 |

状态：✅ 已修。证据：`parity/reference/maxlabel/B1-text-placed.png`（选中态与内嵌面板）、`parity/reference/maxlabel/B2-text-props.png`（双击后的模态属性框）、`app/scripts/ui-v57.cjs`（基础 75%/100%/200% 命中，8/8）、`app/scripts/ui-v73.cjs`（当前适配缩放 + 工作区滚动后直接向监听容器派发 dblclick、关闭保留选中、Alt+Enter，3/3）；场景命令 `powershell -File tools/parity/MaxLabelCtl.ps1 -Action run -Scenario tools/parity/scenarios/object-flow.json`。
### ✅ DIFF-13.4 非 100% 缩放下双击对象打不开属性对话框（round-11 已修）

**复现**（`app/scripts` 之外的自建场景，直接用 CDP 驱动）：
```powershell
powershell -File tools/parity/MaxLabelCtl.ps1 -Action run -Scenario tools/parity/scenarios/dblclick-root.json -NoBuild
powershell -File tools/parity/MaxLabelCtl.ps1 -Action run -Scenario tools/parity/scenarios/dblclick-grid.json -NoBuild
```
两者都是：进入编辑态 → `clicktitle:"文字"` → `clickxy` 在画布放置文字对象 → 派发 `dblclick`。

根因是旧实现把已除以 zoom 的场景点与 Fabric 视口矩形直接比较；文字逻辑框还可能大于实际字形边界，因此双击没有命中。现改为以文档对象逻辑框命中，并同步 Fabric/图层选中态。

验证：`app/scripts/ui-v57.cjs` 8/8 覆盖默认约 79%、100%、200%、75% 缩放下双击，且 75% 下对象框内 3×3 九点直接向监听容器派发均可开框；`app/scripts/ui-v73.cjs` 3/3 补充工作区滚动后的当前非 100% 缩放命中；同时覆盖未选中 `Alt+Enter` 提示及双击/Alt+Enter 共用模态入口；证据 `parity/reference/maxlabel/B1-text-placed.png`、`parity/reference/maxlabel/B2-text-props.png`。
**验收方独立复现验证（round-11 构建产物，用我先前提交的复现脚本，非 Codex 自测）**：
- `tools/parity/scenarios/dblclick-root.json` → `[data-testid=object-props-dialog]` = **true**（修前 false）
- `tools/parity/scenarios/dblclick-grid.json` → 对象周围 3×3 共 9 个点**全部 true**，且每次都能用「取消」关闭（修前 0/9）
- **round-16 补充复验**：`ui-v57.cjs` 扩到 8 条断言，覆盖 `75% / 100% / 200% 缩放`、对象九点网格、以及直接向监听容器派发 `dblclick`；验收方用自建网格探针（`dblclick-grid.json`）在默认 79% 缩放下复测 **9/9 全部通过**。
- 状态：✅ 已修并独立验证通过
## DIFF-14 打印对话框字段与按钮 → ✅ 已收口并由验收方探针验证通过（round-18）
- 收口结果：`tools/parity/scenarios/print-dialog-check.json`（构建为 round-18 产物）输出 **`missingCount: 0`**，16 项分组/字段/按钮全部存在；`打印标签边框` 实测为**禁用**（`borderDisabled: true`，与原版一致）；`设置`/`启始记录`/`高级选项`/`打印机属性`/`预览`/`测试打印`/`帮助` 全部补齐。
- 证据：`parity/reference/maxlabel/D2-print-dialog-check.png`

## DIFF-14（原始描述与对照表，保留备查）

**复刻版现状**（验收方实测，场景 `tools/parity/scenarios/print-dialog.json`，证据 `parity/reference/maxlabel/D1-print-dialog.png`）：
`打印机`（名称：/ 模板：）→ `打印范围`（打印数量 / 单签拷贝 / 起始标签）→ **自造的**`数据库与序列号`（6 个复选框）→ `选取起始标签`（1..8 网格）+ `自动跟踪起始标签位置`；按钮只有 `取消` / `打印`。

**原版结构与文案（照抄）**：

| 分区 | 原版字段（顺序） |
| --- | --- |
| `打印机` | `名称`（只读显示打印机名）、`位置`（只读，显示端口/网络路径，例如 `PORTPROMPT:`）、`打印机属性`（按钮/入口） |
| `打印范围` | `打印数量`、`单签拷贝`、`启始记录`、`只打印数据表中当前记录行的数据`（复选框） |
| `设置` | `打印后更新变量数据`、`打印标签边框`（**原版为禁用态**）、`旋转180度输出` |
| 右侧 | `选取起始标签` 网格 + `自动跟踪起始标签位置`（真机 63-dlg-print.png 实测用词是「**选取**起始标签」；帮助 `print_dlg_main.html` 写作「选择起始标签」，以真机为准） |
| `高级选项` | 页签 `页眉页脚` / `定位裁切标记`（真机 `64a`/`64b`：页眉页脚页「使用全局设置」默认不勾选、定位裁切标记页默认已勾选；`位置偏移` 默认 `-5.00 毫米`；模板默认值 `&D &T &F - &P`） |
| 按钮 | `预览`、`打印`、`测试打印`、`取消`、`帮助`（**测试打印：不写日志、不自动更新变量**） |
| 数据库打印高级选项（在 `高级选项` 内） | `打印时自动设置数据库记录数量`、`拷贝数量从数据库字段引入`、`字段名称`、`允许打印时输入第一个标签的拷贝数量` |

**要求**：
1. 分区名与顺序改为 `打印机` → `打印范围` → `设置`；把现有 6 个复选框按原版归属与**原文标签**归位（`打印时自动更新数据库记录数量` → 原文是 `打印时自动设置数据库记录数量`；`仅打印当前数据记录` → 原文 `只打印数据表中当前记录行的数据`；`打印时输入第一个标签的拷贝数量` → 原文 `允许打印时输入第一个标签的拷贝数量`；查重项帮助未给文字，需另择或去掉）。
2. 补 `位置`（只读端口/路径）与 `打印机属性` 入口；补 `启始记录` 字段。
3. 补 `设置` 分区的三个选项（`打印标签边框` 默认禁用）。
4. 补按钮 `预览` / `测试打印` / `帮助`，并保留 `取消` / `打印`。
5. 补 `高级选项` 入口（`页眉页脚` / `定位裁切标记` 两页，含默认值）。
6. 打印面板上的 `打印数量` 默认 1，与本对话框默认 8（=单页枚数）**保持两处不同**（真机如此，见 FINDINGS 第 4 条）。**round-88 补记**：这是**默认值**的两处不同，不是下限。此前的实现用 `Math.max(activeTab.count, rows × cols)` 把对话框的值**钉死**在单页枚数上，用户输入更小的数量会被立刻弹回（写 3 回显 8），与帮助 `print_dlg_main.html`「如果要打印二十个标签，只要…在打印数量编辑框输入20」（未给任何下限）不符。现拆成独立字段 `DocTab.printCount`：打开文档时默认一页枚数（8），可自由改为任意 ≥1 的值；停靠面板继续用自己的 `DocTab.count`（默认 1）。打印对话框的「预览」按对话框自己的数量渲染（`handlePreview(countOverride)`）。回归：`app/scripts/ui-v109.cjs` 12/21→**21/21**（已登记进 `run-regression.ps1`），`ui-v62.cjs`/`ui-v63.cjs` 断言的默认 8 仍通过。
7. 新增 CDP 断言：分区名与顺序、上述字段存在、`打印标签边框` 禁用、按钮集合完整。

**本轮收口（round-18）**：✅ `PrintDialog.tsx` 已按原版分成 `打印机` → `打印范围` → `设置`，补齐名称/位置/打印机属性、启始记录、当前记录行、更新变量、禁用边框、旋转180度、预览/打印/测试打印/取消/帮助及 1–8 起始标签网格；`PrintAdvancedDialog.tsx` 补齐页眉页脚、定位裁切标记、数据库打印高级选项和原版默认值。`PrinterSettings.tsx` 补充独立端口页，端口枚举覆盖 USB/LPT/COM/TCP/IP/蓝牙/Windows 驱动/文件。
- 验收：`powershell -File tools/parity/MaxLabelCtl.ps1 -Action run -Scenario tools/parity/scenarios/print-dialog-check.json -NoBuild` 输出 `missingCount: 0`。
- 回归：`app/scripts/ui-v63.cjs` 覆盖分区、字段、按钮、默认值、起始标签、三页高级选项、打印机属性和端口枚举；证据 `parity/reference/maxlabel/D1-print-dialog.png`、`D2-print-advanced-header.png`、`D2-print-advanced-cropmark.png`、`D3-printer-properties.png`、`D3-printer-port.png`。
- 输出链路：`printExecutor.ts` 与预览服务统一应用 `rotateDocumentForPrint`；`print-engine.test.ts` 断言测试打印提交一次且不写日志/不推进序列号，并核对 `print_printlog.html` 要求的 CSV 表头。
## DIFF-15 状态栏「数据库」段格式 → ✅ 已修（round-48 复核，`ui-v61.cjs` 2/2；`C10-database-status-3rows.png`）
- 修复：`App.tsx` 的 `dbStatus` 改为 `${currentDbRecord}/${dbRecordCount}（${currentDbCopies}）`。
- 复验（场景 `tools/parity/scenarios/xlsx-import.json`，构建 19:03:06 晚于提交 19:01:05）：导入 3 行 xlsx 后状态栏该段 DOM 实测为 **`▥1/3（1）`**（修复前 `▥数据库：1 个数据集`），与帮助 `toolbar_status.html` 的「当前记录号/总记录数（当前记录的打印拷贝数）」一致。

## DIFF-15（原始描述，保留备查）

- 帮助原文（帮助 `toolbar_status.html`，矩阵 A-167）：数据库段显示当前标签模板连接的数据库信息，**格式为「当前记录号/总记录数（当前记录的打印拷贝数）」**。
  - ~~复刻版实测：导入数据集后状态栏该段渲染为 `▥数据库：1 个数据集`（DOM `[data-testid=status-database]` 实测文本，源码 `App.tsx:975`），**格式不符**。证据 `parity/reference/maxlabel/C5-xlsx-imported.png`。~~
  - ✅ 已修：`App.tsx` 按当前数据集记录索引、总记录数和当前标签拷贝数渲染 `1/3（1）`；未连库仍显示 `未使用数据库`。
  - ✅ CDP 回归 `app/scripts/ui-v61.cjs` 与取证场景 `tools/parity/scenarios/database-status-3rows.json` 均以三行中文 CSV 断言状态栏包含 `1/3（1）`；证据 `parity/reference/maxlabel/C10-database-status-3rows.png`。

## DIFF-16 分隔文本导入的编码处理 → ✅ 已修（round-48 复核，`print-engine.test.ts` BOM/GB18030 断言；`C6-encoding-import.png`）

**修复**：`dataImport.ts` 新增 `decodeDelimitedText(bytes)`：按 BOM 判定 UTF-8/UTF-16LE/UTF-16BE，**无 BOM 默认 GB18030**，`TextDecoder` 不支持时回退 UTF-8 并保留导入。

**验收方实测**（场景 `tools/parity/scenarios/encoding-import.json`，构建为 round-15 产物）：
- 同一份中文 CSV（列 `名称,数量`，行 `中文甲,7` / `中文乙,8`）分别存为 **UTF-8 带 BOM** 与 **GBK(code page 936, 无 BOM)**，依次导入
- 结果：两次都得到 `首行：名称=中文甲，数量=7`，`共 2 个数据集，4 行记录`（修复前 GBK 文件解出 `����=���ļ�` 乱码）
- 证据：`parity/reference/maxlabel/C6-encoding-import.png`

### DIFF-16（原始描述，保留备查）

- 帮助要求：文本文件编码**优先按 BOM 自动识别**；没有 BOM 时按**本机默认非 Unicode 编码（GBK/GB18030）**处理。
- ~~复刻版实测：`app/src/renderer/src/editor/dataImport.ts` 用 `FileReader` 文本读取（默认 UTF-8），未见 BOM 识别与 GBK 回退。~~
- ✅ 已修：`dataImport.ts` 的 `decodeDelimitedText` 按 UTF-8/UTF-16 BOM 选择解码器，无 BOM 回退 GB18030；`print-engine.test.ts` 对同一份中文 CSV 的 UTF-8 BOM、UTF-16LE BOM、GB18030 三种编码均断言列名和值正确。
## DIFF-17 图形对象的对象模型与属性页（验收方实测 + 帮助原文，模块 B） ✅

**帮助原文给出的原版模型**（`label_object_page_rect.html` 标题「直线和方框对象的属性」）：
- 图形对象只有**一种**，形状由属性页的 `形状` 决定：`矩形 / 圆角矩形 / 椭圆`（"当椭圆的高度和宽度相等时，就是正圆形"）
- 「方框和圆形属性」字段：`线宽`、`线条色`、`形状`、`高度和宽度`、`圆角半径`、`填充方框内部`、`填充色`
- 主工具栏对象按钮清单（`toolbar_mainbar.html`）：`选取 / 条码 / 文字 / 线条 / 斜线 / 矩形 / 图片 / 表格 / RFID / 数据` —— **没有独立的椭圆按钮**
- 直线/斜线属性页名：「直线和斜线属性」，字段 `长度`、`线宽`、`线条色`

**复刻版实测**（场景 `tools/parity/scenarios/rect-tab.json`、`object-types-sweep.json`、`object-types-drag.json`）：
- 工具栏**多出独立的 `椭圆` 工具**；属性页签为 `通用 / 矩形`（椭圆对象则为 `通用 / 圆形`）
- 矩形页字段只有：`填充颜色`（下拉：纯色/无）、`描边颜色`、`线宽（mm）`
- **缺 `形状`（矩形/圆角矩形/椭圆）、缺 `圆角半径`、缺 `填充方框内部`**；命名也与原文（`填充色`/`线条色`）不一致
- 对象创建方式：`文字/RFID/椭圆` 单击即落默认尺寸；`条码/矩形/表格` 需拖拽 —— 原版**全部**是"按拖动区域创建"（`label_object_create_drag.html`）

**要求**：
1. 图形对象统一为一种类型：属性页加 `形状`（矩形/圆角矩形/椭圆）、`圆角半径`、`填充方框内部`，并把 `填充颜色`/`描边颜色` 改为原文 `填充色`/`线条色`；`高度和宽度` 已在通用页，无需重复。
2. 属性页命名对齐帮助：图形 → `方框和圆形`；直线/斜线 → `直线和斜线`。
3. 工具栏：去掉独立 `椭圆` 按钮（与原版一致，通过 `形状` 属性得到椭圆），或保留但在矩阵证据列注明「等价替代」并说明理由；同时确认工具菜单仍与原版一致（工具菜单本就没有椭圆）。
4. 对象创建：至少保证 `条码/矩形/表格/线/斜线/图片` 与文字对象都能用"拖拽区域"创建（原版语义），单击落默认尺寸可作为额外便利但不得替代拖拽。
5. 新增 CDP 断言：图形对象属性页含 `形状`/`圆角半径`/`填充方框内部` 三个字段；把 `形状` 切到 `椭圆` 后画布对象渲染为椭圆；工具栏对象按钮集合与 `toolbar_mainbar.html` 一致。
## DIFF-18 RFID 属性页「访问控制」粒度与口令随机生成（验收方实测，模块 B） ✅

**帮助原文**（`label_object_page_rfid.html`）：
- 「访问控制」下应分别有 5 组：`EPC Block`、`User Block`、`TID Block`、`Access Password`、`Kill Password`，**各自有锁定/解锁**
- 「Access Password」/「Kill Password」：配合访问控制设置新口令，**可随机生成**

**复刻版已收口**（场景 `tools/parity/scenarios/rfid-tab.json`，证据 `parity/reference/maxlabel/B6-rfid-tab.png`）：
- `ObjectPropsDialog.tsx` 与 `PropertyPanel.tsx` 均提供读写器类型、数据段位置、起始块、数据类型、PC 协议控制字及 Access/Kill 口令。
- 访问控制已拆为 `EPC Block`、`User Block`、`TID Block`、`Access Password`、`Kill Password` 五组，各自提供「不操作/锁定/解锁」；两个口令均有「随机生成」，输入值为 8 位大写十六进制。
- 内嵌「RFID 选项」与模态页共用同一对象模型和 onPatch，字段、默认值和随机操作保持同步；RFID 新对象默认数据类型为十六进制。
- CDP 回归 `app/scripts/ui-v78.cjs` 10/10 覆盖五组控制、默认值、独立性、随机口令、提交后保留和内嵌页同步。

**验收方探针基线（round-15 构建，场景 `tools/parity/scenarios/print-dialog-check.json`，证据 `D2-print-dialog-check.png`）**：
已具备 `打印机`/`打印范围` 分组、`名称`、`位置`、`打印数量`、`单签拷贝`、`选取起始标签`、`自动跟踪起始标签位置`；
**缺失 12 项**：`设置` 分组、`打印机属性`、`启始记录`、`只打印数据表中当前记录行的数据`、`打印后更新变量数据`、`打印标签边框`、`旋转180度输出`、`高级选项`，以及按钮 `预览` / `测试打印` / `帮助`（当前只有 `取消`/`打印`）。
→ 第 4 项（D 模块）以这 12 项为收口清单，收口后本探针应输出 `missingCount: 0`。
## DIFF-19 文字属性页两处口径差异（验收方帮助↔实现核对，模块 B） ✅

**已对齐**（帮助 `label_object_page_text.html` ↔ `ObjectPropsDialog.tsx`）：
- `水平对齐` 含 `左/右/居中/撑满`（`justify`）
- `文字停靠` = `两端/左侧/右侧/居中`，且 hint 写明"撑满时控制首尾未填充区域"（与帮助"对于撑满方式，可以进一步选择文字停靠的效果"一致）
- `垂直对齐` = `顶部/中间/底部`
- `文字类型` = `单行/多行/圆形（弧形）`；圆形参数含 `回绕方向`（顺时针/逆时针）、`文字方向`、`半径（mm，0=自动）`、`起始角度（度）`、`弧度范围（度）`
- `字符模板` 语义照抄帮助（一个 `?` 表示原有数据的一个字符，其它字符插入数据序列）

**本轮收口**：
1. 文字页已提供「行宽度（毫米）」并以 lineWidth 保存；默认跟随对象宽度，多行排版使用该值作为换行边界。
2. 「行距」按帮助的绝对间距语义实现为「行距（毫米）」并保存到 lineSpacingMm，默认按字号的 20% 计算；不是倍率字段。
3. CDP 回归 ui-v71.cjs 已覆盖行宽度和多行毫米行距入口；字体页字段命名由 ui-v78.cjs 覆盖。
## DIFF-20 条码属性页的字段命名口径（功能齐备，用词与帮助不一致） ✅

**功能核查结论**（帮助 `label_object_page_barcode.html` ↔ `ObjectPropertiesDialog.tsx`/`BarcodeDataFields.tsx`/`domain/objects.ts`）：

| 帮助字段 | 复刻版对应实现 | 状态 |
| --- | --- | --- |
| 条码符号类型（码制） | `码制`（18 种，含码制专页） | 用词略异 |
| X 尺寸（窄条宽度，mil） | `X 尺寸`（hint 明写 mil） | ✅ 一致 |
| 条宽比 | **`条宽比`**（2:1 / 2.5:1 / 3:1，模型字段 `w2n`） | ✅ |
| 码高 | 由对象**高度**承担（通用页 `高度（毫米）`） | 等价替代 |
| 缩减量 | 无（帮助注明仅企业版以上可用） | 已记录边界 |
| 条码特殊选项 | 各码制专页（Code39 校验字符 mod10/mod43/library、Codabar 校验、RSS 分隔符比、PDF417 层高=3×X 尺寸、DataMatrix ECC200…） | ✅ |
| 供人识读的字符 → 位置 | **`供人识读的字符：位置`**（条码下方/条码上方/…） | ✅ |
| 供人识读的字符 → 垂直偏移 | **`供人识读的字符：垂直偏移（mm）`** | ✅ |
| 供人识读的字符 → 对齐方式 | **`供人识读的字符：对齐方式`**（左/居中/右） | ✅ |
| 供人识读的字符 → 字符模板 | `字符模板`（`?` 语义照抄） | ✅ 一致 |
| 颜色 | `BarcodeObj.color` + 通用页颜色设置 | ✅ |

**本轮收口**：BarcodeDataFields.tsx 已使用帮助原文「条宽比」及「供人识读的字符：位置/垂直偏移/对齐方式」；码高继续由通用页对象高度承担，矩阵已注明等价替代。ui-v78.cjs 覆盖三项可见字段。
## DIFF-21 图片属性页缺「缩放方式 / 保持长宽比 / 对齐方式」（验收方核查，模块 B） ✅

**已实现**：`类型` 三选（`嵌入` / `链接` / `数据源图片`，hint 说明了三种语义）、`图片目录`（数据源图片路径，等价帮助里"未指定全路径时到标签文件同目录查找"）、`链接：<路径>` / 数据源图片状态提示、`源`（src）与 `ImageObj.imgType/linkPath/source` 模型字段。

**缺失**（帮助 `label_object_page_picture.html`，全库 grep 无命中：`原始尺寸`/`比例缩放`/`适合边框`/`保持边框尺寸`/`保持长宽比`/`缩放方式`/`图片对齐`/`imageFit`/`objectFit`）：
1. **`缩放方式`** 四选一：`原始尺寸`（锁定尺寸，不可改大小）、`比例缩放`（按原图百分比缩放，可鼠标调整或在宽高后输入百分比）、`适合边框`（强制适配指定区域，对数据源图片尤其重要）、`保持边框尺寸`（输出同"适合边框"，但编辑时边框可任意设）
2. **`保持长宽比`**：勾选后改高即改宽、改宽即改高（按比例）
3. **`对齐方式`** 9 种：`中心对齐` / `左上角对齐` / `上中对齐` / `右上角对齐` / `右中对齐` / `右下角对齐` / `下中对齐` / `左下角对齐` / `左中对齐`（用于链接式/数据源图片尺寸不一致时决定摆位）
4. 帮助还提到：不同缩放方式下**高度/宽度的数值框与百分比框**应按方式启用/禁用；「适合边框 + 数据源图片」必须避免连续切换记录时图片越来越小

**要求**：① 模型加 `imageFit`（original/scale/fit/fitBox）、`keepAspect`、`imageAlign`（9 值）与百分比字段；② 图片页按帮助补齐字段与启用/禁用联动；③ 渲染与打印场景（`fabricObjects`/`ResolvedPrintScene`）按缩放方式计算实际绘制矩形，`保持长宽比` 参与计算；④ 补 CDP 断言：四种缩放方式存在且切换后宽高联动行为正确、9 种对齐方式可选、`保持长宽比` 勾选后改高的同时宽度按比例变化。
### DIFF-20 续：字体页命名与字体清单

- 帮助 `label_object_page_font.html`：`字体宽度缩放倍数`（默认 1.00）、`字间距`、字体清单含 `Symbol` / `OCR-B` / `宋体/黑体/楷体/仿宋`
- 复刻版已收口：字段名为「字体宽度缩放倍数」「字间距」；字体清单补齐 Symbol / 楷体 / 仿宋及 OCR-B/OCR-A。
- CDP 回归 ui-v78.cjs 覆盖字段名称与三项字体下拉值；其余 Windows 字体仍由系统字体列表按安装情况提供。

**验收方核查补充（round-18 进行中）**：`PrintAdvancedDialog.tsx` 已建 `页眉页脚` / `定位裁切标记` 两页，含 `使用全局设置`、`页眉页脚样式`、`位置偏移（毫米）`、`模板`、数据库 `字段名称`，提示写明「定位裁切标记默认启用，偏移默认 -5.00 毫米」。**待核细节**：真机 `64a`/`64b` 显示——`页眉页脚` 页的「使用全局设置」**默认不勾选**、`定位裁切标记` 页**默认已勾选**（两页整组禁用）；当前实现两页都渲染为 `checked`，需按页分别取默认值并补断言。
## DIFF-22 下拉枚举顺序 → ✅ 已收口（验收方复核：`PrinterSettings.tsx` 的「标签类型」下拉已为 `打印机默认 / 连续纸 / 间隔定位的标签 / 标记定位的标签`，与帮助一致）

| 位置 | 帮助/真机顺序 | 复刻版顺序 |
| --- | --- | --- |
| 打印机首选项 → 标签类型 | `打印机默认` / `连续纸` / `间隔定位的标签` / `标记定位的标签` | `打印机默认` / `间隔定位的标签` / `连续纸` / `标记定位的标签` |

**要求**：按帮助顺序排列；若后续再发现同类顺序差异，一并追加到本表，由同一轮统一处理（此项不影响功能，仅影响肌肉记忆）。
**验收方核查（round-18 产物）**：打印机属性三页签（`首选项`/`端口`/`自定义命令`）与外设参数齐全——打印速度（1-6）、打印浓度、打印方式（打印机默认/热敏/热转印）、标签类型、顶部偏移（mm，可正可负）、介质处理（撕纸/剥离/切纸）、出纸回退（mm）、保存为默认值；端口枚举 USB/LPT/COM/标准 TCP-IP/蓝牙/驱动；自定义命令含三类（其中"打印后处理命令（作业结束后发送）"）。D-08/D-22/D-23/D-30 的「已实现」声明成立。

## DIFF-23 打印预览的内置驱动限制 → ✅ 已收口（等价替代，验收方核定）

- 帮助明文「LabelShop 打印机内置驱动不支持打印预览」；复刻版**没有**"内置驱动"端口类型（端口为 Windows 驱动 / USB / COM / TCP-IP / 蓝牙 / 文件），因此该限制客观不存在，无法也不需要复现。
- 已按要求在矩阵证据列注明等价替代（D-64 = 部分）；若将来引入内置驱动端口类型，须按帮助禁用预览入口并提示。

帮助 `print_preview.html` 明确：「需要注意的是，**LabelShop 打印机内置驱动不支持打印预览**」。
复刻版实测（`preview-check.json`）：只要点击「打印预览」就打开预览窗（内容 `打印预览 / 纸张尺寸 / ‹ 1/1 › / 缩放 适应 1:1 / 打印全部 / 关闭`），**没有**按端口类型判断可用性——复刻版目前也没有"LabelShop 内置驱动"这一端口类型（端口为 驱动/USB/COM/TCP/IP/蓝牙/文件）。
**要求**：在矩阵证据列注明等价替代（复刻版无内置驱动端口，故无此限制）；若后续引入内置驱动端口类型，必须按帮助禁用打印预览入口并给出提示。

**验收方现状核查（round-23）——DIFF-12.7 仍未完成**：
- `app/src/renderer/src/dialogs/NewLabelDialog.tsx` 目前只有 **1 条内联格式**（`[608053] 100mm x 70mm 圆角8枚/页 20页/盒`）与 **4 个硬编码品牌**（`京成云马标签（平张标签）` / `京成云马标签（卷装标签）` / `通用标签纸` / `自定义品牌`）；全库无 `LABEL_FORMATS`/`labelFormats`/`LabelFormat360` 数据模块。
- 规格要求（`parity/reference/labelshop/LABEL-FORMAT-SPEC.md`）：**275 条**标签名称、**2** 个品牌（京成云马标签 225 / 普林泰科标签 50）、**17** 个类型（`CateName`），且注意"标签类型"下拉显示的是分类名而非 `Label_Type` 整数。
- **实现路径建议**：① 用脚本把 `LABEL-FORMAT-SPEC.md` 的 275 行（或直接解析 `parity/reference/labelshop/sources/LabelFormat360.fmt`，SQLite/UTF-16LE）生成 `app/src/shared/domain/labelFormats.generated.ts`（含 code/name/w/h/cols/rows/corner/brand/cate/pagesPerBox），随构建打包；② `NewLabelDialog` 的品牌/类型/名称三级联动改为读该数据；③ 名称**不要 Trim、不要归一化全角 ×、损坏的 `?` 照抄**（规格 §5 明确）；④ 补 CDP 断言：品牌 2 项、按品牌过滤的类型数、名称条数 275、默认选中 `[608053]`。

**验收方独立复核（round-24）——DIFF-17 各项均已落地**：
- 模型：`shared/domain/objects.ts` 的 `RectObj` 现含 `shape?: 'rect' | 'roundRect' | 'ellipse'`、`cornerRadius?`、`fillEnabled?`（图形对象统一模型）
- 属性页：`ObjectPropsDialog.tsx` 有 `形状`(L410/416)、`圆角半径`(L426/427 `cornerRadius`)、`填充方框内部`(L432)；`PropertyPanel.tsx` 同步
- 工具与页签命名：`EditorTool` 与工具菜单均为 `select/barcode/text/line/diagonal/rect/image/data/table`（**已无独立椭圆**）；`propertyTabs.ts` 页签名 `直线和斜线` / `方框和圆形` 与帮助一致

**验收方独立复核（round-24）——DIFF-21 各项均已落地**：
- `缩放方式`（`data-testid=image-fit`）：`原始尺寸` / `比例缩放` / `适合边框` / `保持边框尺寸` 四选，与帮助完全一致
- `保持长宽比`（`image-keep-aspect`，默认勾选）：勾选时改宽度百分比同步高度百分比（`widthPercent`/`heightPercent` 双向联动）
- `宽度（%）`/`高度（%）`：仅在 `比例缩放` 下可编辑（`disabled` 联动），与帮助"根据缩放方式启用/禁用宽高输入框"一致
- `对齐方式`（`image-align`）9 项与帮助逐一对应：中心/左上角/上中/右上角/右中/右下角/下中/左下角/左中；hint 说明与帮助"用于链接式图片或数据源图片尺寸变化时的摆位"一致
- 模型：`ImageObj.imageFit/keepAspect/imageAlign/widthPercent/heightPercent` 与 `objectFactory` 默认值均已就位

**验收方核验（round-25 进行中）——12.7 标签库已生成且数据正确**：
- `app/src/shared/domain/labelFormats.generated.ts`（210 KB）：**275 条**记录、**2 个品牌**（京成云马标签 225 / 普林泰科标签 50）、**17 个分类**，字段含 code/brandId/brandName/categoryId/categoryName/categoryParentName/type/name/page/pageWidthMm…/labelWidthMm/labelHeightMm/cols/rows/colGapMm/rowGapMm/corner 等
- `[608053]` 记录核对：`name: "100mm x 70mm 圆角8枚/页 20页/盒"`、`page: 9`、`pageWidthMm: 210`、`pageHeightMm: 297`、`categoryName: 云马优质打印纸标签` —— 与真机截图 `60-dlg-choose-label.png` 及规格逐项一致

**✅ 可复现性已修复（round-25）**：生成器已改为读入库原件 `parity/reference/labelshop/sources/LabelFormat360.fmt`（UTF-16 SQLite，Python stdlib sqlite3 解析）；验收方重跑生成器得到**字节一致**的 275 条结果（哈希不变）。以下为原始要求（保留备查）：

**（原始）可复现性要求**：生成脚本 `app/scripts/generate-label-formats.cjs` 读取的是 `parity/reference/labelshop/_labelformat_all.txt`（**被 `.gitignore` 的下划线规则忽略、未入库**）。一旦该临时快照丢失，生成脚本无法重跑。
**要求**：改为读取已入库的原件 `parity/reference/labelshop/sources/LabelFormat360.fmt`（SQLite/UTF-16LE，可通过 Node 侧的 SQLite 或调用主进程现有能力解析），或把快照以非下划线名提交（如 `parity/reference/labelshop/labelformat-all.txt`）并同步改脚本路径；两者取其一，并在生成脚本头部注明数据来源与再生成命令。

## DIFF-24 工具栏按钮的禁用规则疑点（验收方实测，模块 A） → ✅ 已修（round-51，`app/scripts/ui-v74.cjs` 10/10、`app/scripts/ui-v85.cjs` 7/7；`parity/reference/maxlabel/A1-toolbar-inventory.png`）
✅ 已收口：editorAvailability.ts 统一计算文档、数据库和选中对象可用性，Toolbar、FormatBar 与排列菜单共用该结果；ui-v74.cjs 与 ui-v85.cjs 覆盖七个数据库按钮、未选中组合/取消组合、双对象组合可用，editor-operations.test.ts 覆盖起始页/无库/单选/双选/组合五种状态。

来源：验收方 CDP 全量盘点（`tools/parity/scenarios/toolbar-inventory.json`，证据 `parity/reference/maxlabel/A1-toolbar-inventory.md` 与 `A1-toolbar-inventory.png`）。**空文档 + 未选中对象**状态下实测：

| # | 疑点（实测） | 帮助/原版要求 | 处理 |
| --- | --- | --- | --- |
| 1 | 数据库工具栏 7 键（定位记录 / 更新数据库 / 第一条 / 上一条 / 下一条 / 最后一条 / 设置数据库）在**未连库**时全部显示为可用 | `menu_database.html` 要求未连库时这些命令不可用；菜单侧已按此实现且 `ui-v52` 有断言 | 工具栏按钮改为与菜单同一套可用性规则，并补断言 |
| 2 | `组合` / `取消组合` 在**未选中对象**时显示为可用 | 帮助要求组合需至少两个对象、取消组合需选中组合对象 | 按规则禁用并补断言 |

**要求**：两处均由「文档状态 + 当前选中对象数」的统一来源计算 `disabled`；补 CDP 断言：未连库时 7 键禁用、未选中时组合/取消组合禁用、选中两个对象后组合可用（取消组合在组合对象选中时可用）。本轮新增聚焦脚本 `app/scripts/ui-v87.cjs`（3/3），并重抓 `parity/reference/maxlabel/DIFF24-toolbar-disabled.png`。
**另**：其余按钮的「点击行为断言」作为 A1/A2/A3 簇的收尾项，逐簇在后续轮次补齐（清单见 `A1-toolbar-inventory.md` 末尾）。

## DIFF-25 颜色索引表的编辑形态（模块 B） → ✅ 已修（round-51，`app/scripts/ui-v74.cjs` 10/10、`app/scripts/ui-v85.cjs` 7/7；`parity/reference/maxlabel/DIFF25-color-index-table.png`）

- 帮助 `label_object_page_general.html`：颜色索引表以**表格**编辑，列为 `颜色索引` / `颜色` / `RGB颜色值` / `十六进制`。
- 已收口：ObjectPropsDialog.tsx 提供私有/公共索引表的四列表格编辑（颜色索引、颜色、RGB颜色值、十六进制）以及添加/删除行；输入支持颜色名与 #RRGGBB。
- 证据：app/scripts/ui-v74.cjs 10/10、ui-v85.cjs 7/7（四列、私有/公共表、添加行、red/#00FF80 解析、删除行）+ parity/reference/maxlabel/DIFF25-color-index-table.png。

## DIFF-26 缺「自动旋转输出页面」系统选项（验收方核查，模块 A） → ✅ 已修（round-51，`app/scripts/ui-v74.cjs` 10/10、`app/scripts/ui-v85.cjs` 7/7、`app/scripts/print-engine.test.ts` 104 组；`parity/reference/maxlabel/DIFF26-auto-rotate-options.png`）
✅ 已收口：prepareDocumentForPrint 统一组合 180 度与按纸张方向自动旋转，预览、正式打印和指令导出均在解析 ResolvedPrintScene 前使用；print-engine.test.ts 覆盖物理页尺寸不变、图元旋转变换和 TSPL 指令差异，ui-v74.cjs 覆盖默认值和持久化，截图见 DIFF26-auto-rotate-options.png。

- 帮助 `config_general.html`：「**自动旋转输出页面** —— 设置是否在打印输出时，打印内容自动跟随纸张的旋转方向做旋转。」
- 已补齐：OptionsDialog.tsx 提供并持久化「自动旋转输出页面」；其它系统选项保持原有默认值与文案。
- **要求**：① 在系统选项补齐该开关并持久化；② 接进打印链路——开启时按纸张方向自动旋转输出内容（与 `旋转180度输出`、页面方向的计算口径一致，且必须同时作用于预览与指令输出，遵循"预览/位图/指令共享同一 ResolvedPrintScene"的架构红线）；③ 补断言：开关存在且默认值明确、开启后打印计划的页面方向/内容旋转变换与关闭时不同。

## DIFF-27 对象可变颜色的模式与索引表默认值（验收方核查，模块 A/B） → ✅ 已修（round-65，`app/scripts/color-change.test.ts` 11/11 + `app/scripts/ui-v92.cjs` 11/11；`parity/reference/maxlabel/DIFF27-color-modes.png`、`DIFF27-color-value-pipe.png`）
✅ 已收口：`ColorChangeConfig.mode` 扩为 `fixed | random | indexByContent | indexVar | valueVar | index | rgb`；索引表默认注入索引 0–9 十个预定义颜色并保留公共/私有；颜色值解析同时支持「,」与「|」；变色粒度按对象类型收敛（直线/矩形/图片仅整体、文字整体/逐字符、条码整体/区块/渐变）；图片可变颜色仅对单色黑白图启用并给出提示；预览、位图与指令输出继续共用 `resolveColorChangePlan` 解析的同一取色方案。

**帮助原文**（`color_main.html`）：
- 可设可变颜色的对象：文字、条码、直线、矩形、图片（图片仅**单色黑白图**支持）
- **颜色索引表含十个预先定义的颜色（索引 0–9）**，分「模板公共颜色索引表」与「对象私有颜色索引表」
- 颜色值用 `#FF0000` 样式，多个值用 `,` **或** ` | ` 分隔
- **变化模式六种**：`随机颜色` / `以数据源内容为索引`（文字与条码按内容为索引取色，其它对象用索引 0 的颜色）/ `颜色索引变量`（以命名变量的值为索引）/ `颜色值变量`（以命名变量的值为 RGB 值）/ `颜色索引`（输入内容作索引）/ `RGB颜色值`（输入内容作 RGB 值）
- 各对象允许的变色粒度：直线/矩形/图片**整体变化**；文字可**整体或逐字符**；条码可**整体 / 按行列（区块）/ 渐变**
- 命名变量须存在于某对象中（可放在标签外，标签外对象不打印但变量可被颜色定义引用）

**复刻版实测**：
- 模型 `ColorChangeConfig = { mode: 'fixed' | 'index' | 'variable', tableSource: 'shared' | 'private', privateTable, changeMode: 'solid' | 'block' | 'gradient', blockRows, blockCols, variableName }`
- UI 有「颜色变化模式：固定颜色／颜色索引表／颜色变量」「索引表来源：对象私有／模板公共」「对象变色方式：整体变色／按区块变色／渐变变色」「区块行数/列数」「颜色变量（数据库字段名或键盘输入提示标签）」
- **缺口**：① 无 `随机颜色`；② 无「以数据源内容为索引」（文字/条码按内容取色）；③ 未区分「颜色索引变量」与「颜色值变量」；④ 索引表**无 10 个预定义颜色默认值**（`privateTable: []` 起手为空）；⑤ 颜色列表解析只按 `,` 拆分，未支持 ` | `；⑥ 未按对象类型限制变色粒度（直线/矩形/图片应仅整体变色）；⑦ 图片仅单色黑白图支持可变颜色未校验

**要求**：① `mode` 扩展为 `fixed | random | indexByContent | indexVar | valueVar | index | rgb`；② 索引表默认注入 10 个预定义颜色（索引 0–9），并保留公共/私有两类；③ 颜色值解析同时支持 `,` 与 ` | `；④ 按对象类型限制 `changeMode` 可选项（直线/矩形/图片仅整体；文字整体/逐字符；条码整体/区块/渐变）；⑤ 图片可变颜色仅对单色黑白图启用，否则给出提示；⑥ 补 CDP 断言：六种模式可选、索引表默认 10 色、`#FF0000` 与 `#FF0000 | #00FF00` 两种写法均解析、直线对象无色粒度选项。

## DIFF-28 创建对象交互三处缺陷（用户报，已修复并加回归） → ✅ 已修（`app/scripts/ui-v116.cjs` 10/10 + `render-regression` 2 条几何断言；发布 v1.0.1）

来源：用户实测反馈（2026-09-17）：「添加二维码、文字、表格的地方没有指针；表格出来后不是完整表格；添加直线、表格、二维码等鼠标操作的逻辑不对，比如直线应该是一个点拉到另一个点，表格选中的是表格的大小」。

**① 表格渲染错位 + 包围盒膨胀（严重）**
- 现象：拖拽创建表格后，画布上**看不到表格**（或位置完全不对）；诊断实测：模型 x=5,y=5,w=20,h=10（缩放 0.79）时，`fabric.Group` 的 `left/top` 虽为 (3.95,3.95)，但**组包围盒被撑成 23.937×12.087（内容的 1.5 倍）**，子矩形被重排到组内 `(-3.95,-1.975)`，表格实际被画到画布原点附近而非模型位置。
- 根因：fabric 7.4 的 `Group` 会按「组中心」重新布局子元素；子元素用绝对坐标 + 组只给 `left/top` 时，布局结果与预期坐标系冲突（试过显式 width/height、center 原点、构造后回复子元素等 4 种写法，包围盒一律 1.5 倍）。
- 修复：`fabricObjects.ts` 的 `case 'table'` 改为**单条 `fabric.Path`** 绘制（外框 + 按 `tableColXs/tableRowYs` 生成的内部竖/横线，合并单元格仍按 `tableSegmentHidden` 省略线段）。局部坐标从 (0,0) 起，配合 `left/top + originX/originY=left/top` 与模型严格对齐。
- 验证：几何诊断 位置偏差 **0**、尺寸偏差 **0**；`render-regression` 新增 2 条断言（`table object sits at its model x/y` / `keeps the exact model size`）→ 48 项通过；`ui-v116.cjs` 像素级断言表格竖线 3 条、横线 4 条（完整表格）。

**② 绘制工具没有十字指针**
- 现象：选中对象工具后，鼠标在画布上（尤其经过已有对象时）不是十字光标。
- 根因：工具 effect 只设了 `defaultCursor`，fabric 在悬停对象时改用 `hoverCursor`（默认 `move`），把十字光标覆盖掉。
- 修复：`LabelEditor.tsx` 工具 effect 同时设置 `hoverCursor = drawing ? 'crosshair' : 'move'`。
- 验证：`ui-v116.cjs`「对象工具在空白处显示十字指针」「工具模式下鼠标经过已有对象仍是十字指针」「选择工具恢复默认指针」全通过。

**③ 斜线未按拖拽方向绘制（点对点语义）**
- 现象：斜线工具从右上往左下（或左下往右上）拖拽时，画出的对角线方向与手的动作不一致。
- 根因：模型只有包围盒 x/y/w/h，渲染固定为「左上→右下」对角线，拖拽方向信息在创建时被丢弃。
- 修复：`LabelEditor` 的 `mouse:up` 把拖拽方向（`fromLeft`/`fromTop`）传给创建回调；`App.tsx` 的 `handleCreateRect` 在斜线且 `fromLeft !== fromTop`（即 ↗/↙ 方向）时置 `flipY = true`（模型已有 `flipX/flipY` 字段并可序列化）。
- 验证：`ui-v116.cjs`「右下拖的斜线沿 ↘ 绘制」「右上拖的斜线沿 ↗ 绘制」（沿对角线 12% 内缩取点命中、另一条对角线同位置留白）。

**备注**：直线工具（线条）仍按帮助 `label_object_create_drag.html` 只创建水平/垂直线条（按拖拽主轴吸附）；表格拖拽包围盒即表格大小（含默认 3 行 × 2 列）。

## DIFF-35 第三方需求清单交叉比对后的三项补齐（已修复） → ✅ 已修（`app/scripts/ui-v117.cjs` 11/11 + `render-regression` 6 条；发布 v1.0.2）

来源：用户提供的《软件功能需求清单.xlsx》（281 条第三方测试条目，10 大类）与本仓库 605 条矩阵交叉比对。结论：清单功能面绝大部分已覆盖，据此补齐 3 条帮助明列但此前缺失的项。

**① 标签纸颜色（编辑期底色）**
- 帮助 `label_page_page.html`：「设置标签纸的颜色。颜色只在编辑标签时显示，并不会实际输出底色。」
- 实现：`PaperGeometry.labelColor` + `LabelDoc.layout.labelColor`（`normalizeDocument` 只接受合法 `#RRGGBB` 并小写归一）；`PaperFields` 增「标签纸颜色」色板（6 个预设 + 取色器）；`LabelEditor` 的标签底面按该色渲染；**打印路径不读取该字段**。
- 断言：`ui-v117` 7 条（字段存在 / 预定义格式禁用（帮助：系统预定义格式页面信息不可修改）/ 自定义可改 / 默认白 / 预设色写入 / 画布底色实测 `255,248,225` / 改色前为白）；`render-regression`「label paper colour never reaches the printed output」。

**② 图片「无效图片」处理方式**
- 帮助 `label_object_page_picture.html`：「……还决定如果在打印时未找到图片该如何进行处理。」
- 实现：`ImageObj.missingImage = 'error' | 'skip' | 'placeholder'`（默认 `error`，保持既有"缺图必须报错"语义）；图片页增「无效图片」下拉；渲染层 `onMissingImage()` 统一处理三种策略（含占位虚线框 `imagePlaceholder`，用单 Rect 而非 Group，避免 fabric 7 组重排错位）。
- 断言：`render-regression` 三条（`skip` → 不产出对象；`placeholder` → 产出 rect 占位框；`error` → 输出仍抛错）；`ui-v117` 三条（字段存在 / 默认「中止输出」/ 三项枚举）。

**③ 图片可变颜色仅单色黑白图（真判定）**
- 帮助 `color_main.html`：图片只有单色的黑白图片支持可变颜色。
- 原实现是保守策略（仅放行数据源图片 + `ctx.images` 白名单）；改为真实像素判定 `detectMonochrome()`（解码图片、128×128 采样、忽略透明像素、不同颜色 ≤2 视为单色），嵌入/链接图片按判定结果决定是否允许可变颜色，数据源图片沿用放行策略；属性页提示按判定结果给出对应文案。
- 断言：`render-regression` 两条（双色位图判为单色 / 多色位图判为彩色）；`ui-v117` 一条（图片页给出单色黑白说明或打印机不支持说明）。

**未采纳清单项（与帮助/真机不一致或有歧义，已在比对报告中说明）**：Data Matrix「反白」、汉信码「加密」（帮助无记载，待真机取证）；在线安装包（分发渠道）；`删除对象/CTRL+拖动`（帮助为「CTRL+单击多选」，疑清单笔误）。
## 原版细节清单（实现时必须照抄，来自 FINDINGS.md）

- 三行工具栏官方名：`工具栏` / `格式栏` / `对齐栏`（`52-editor-menu-view.png` 勾选项）
- 编辑菜单键位：`撤销 Ctrl+Z`、`恢复 Ctrl+Y`、`剪切 Shift+Delete`、`复制 Ctrl+C`、`粘贴 Ctrl+V`、`全选 Ctrl+A`、`删除 Delete`、`属性 Alt+Enter`
- 鼠标位置显示格式：`60.95, 14.60 毫米`（毫米、两位小数、逗号+空格）；**鼠标不在画布上时该字段只留图标、不显示占位文字**
- 状态栏 6 段顺序（帮助文档 + `44-statusbar.png`）：`打印机` | `标签格式` | `数据库` | `鼠标光标位置` | `对象信息` | `显示比例`；其中「显示比例」按帮助文档既能显示也能调整
- 数据库段格式：`当前记录号/总记录数（当前记录的打印拷贝数）`（帮助文档 A-167）
- 打印面板 `打印数量=1`；`Ctrl+P` 打印对话框 `打印数量=8`（等于单页枚数），`单签拷贝=1`
- `打印标签边框(E)` 在打印对话框里是**禁用**复选框
- 未选中对象时：`排列` 菜单除 `组合(G)`/`取消组合(U)` 外全部置灰；`数据库` 菜单只有 `设置数据库(D)...` 可点
- `工具` 菜单 = 对象工具清单：`选取(S)`/`条码(B)`/`文字(T)`/`线条(L)`/`斜线(L)`/`矩形(R)`/`图片(P)`/`数据(D)`/`表格(G)` + `放大(I)`/`缩小(O)`(Ctrl+-)/`适应宽度`/`适应高度`/`适合窗口(W)`(Ctrl+Alt+0)
- 系统设置对话框标题是 `系统设置`（菜单项叫 `系统选项(C)...`），5 个页签：`常规`/`语言`/`单位`/`非打印对象`/`其它`
- 高级打印选项：`页眉页脚` 页默认不勾选、`定位裁切标记` 页默认已勾选、`位置偏移` 默认 `-5.00 毫米`、模板默认值 `&D &T &F - &P`
- 打印对话框还有折叠在可视区外的控件：`打印到文件(&F)`、`只打印数据表中当前记录行的数据`、`UTF-8 字符集输出`、`仅单次打印`、`起始记录(&T)：`(提示 `(1,2,5-10,30...)`)、`启始页码(&N)：`

## DIFF-28 工具栏「添加或删除按钮」的下拉结构（round-91 真机取证 / round-92 已修，模块 A） → ✅

**真机原始证据（round-91 新取，`tools/parity/LabelShopCtl.ps1`）**：

| 证据文件 | 内容 |
| --- | --- |
| `parity/reference/labelshop/91-toolbar-customize-entry-tooltip.png` | 鼠标悬停主工具栏**最右端** `»` 下拉按钮，tooltip 原文 **`添加或删除按钮(A)`** |
| `parity/reference/labelshop/91-toolbar-customize-submenu.png` | 点击该按钮后弹出的下拉菜单：**`添加或删除按钮(A) ▸`** → 二级 **`标准 ▸`** / **`自定义…`** |

**结论**：入口的**位置与名称与原版一致**（主工具栏最右端下拉、文案「添加或删除按钮」）。
**差异**：原版下拉是两级结构 —— 第一项 `添加或删除按钮` 自身带二级子菜单（内含 `标准` 子菜单，`标准` 再带一级），第二项是独立的 **`自定义…`** 对话框入口（正对应帮助 `toolbar_mainbar.html` 的「**也可自定义按键及布局**」）。复刻版目前是**一级平铺的 8 个复选组**，且**没有 `自定义…` 对话框**（即「自定义按键及布局」尚未实现）。

**未取证部分（下一轮继续）**：`标准 ▸` 二级子菜单内的按钮/分组清单本轮未取到。键盘 `{DOWN}`/`{RIGHT}` 展开后菜单被关闭；需改用「悬停展开」（SetCursorPos 后不点击、等待 hover 展开）重试。取到后据此校正复刻版的分组名与顺序。

**round-92 收口**：复刻版已按真机结构改为同一形态 —— `»` → `添加或删除按钮(A) ▸` → 二级 `标准 ▸`（按组勾选，8 组名逐字取自帮助 `toolbar_mainbar.html`）+ `自定义...`（独立项，打开「自定义」对话框）。「自定义按键及布局」已落地：逐按钮显隐、上移/下移调整顺序、指派/清除按键、全部重置；结果写入系统选项 `maxlabel.options.toolbarLayout`（`{order,hidden,keys}`），重启仍生效。

- 实现：`app/src/renderer/src/editor/toolbarLayout.ts`、`editor/Toolbar.tsx`（`CustomizeMenu`）、`dialogs/CustomizeToolbarDialog.tsx`；`dialogs/OptionsDialog.tsx` 转出该单一来源。
- 断言：`app/scripts/ui-v111.cjs` **16/16**（新增，已登记 `app/scripts/run-regression.ps1`）、`app/scripts/ui-v110.cjs` **17/17**（+3 条结构断言）。
- 截图：`parity/reference/maxlabel/A121-toolbar-customize-menu.png` / `-submenu.png` / `-groups.png` / `A121-toolbar-customize-dialog.png` / `A121-toolbar-layout-applied.png`。
- 命令：`MAXLABEL_UI_SCRIPT=ui-v111.cjs npm run test:ui`。

**仍未取到的真机证据**：`标准 ▸` 三级子菜单里的**逐按钮清单**。round-92 复测仍失败：`LabelShopCtl.ps1` 的鼠标注入（`SetCursorPos` + `mouse_event`）在本机对原版工具栏无效（`click:1232,93` 落点即 `»`，但下拉不弹出），且原版启动后会有一个 class 为 `HH Parent` 的「签赋 LabelShop 帮助」窗口抢占前台、使模态工具栏不可达。因此复刻版的按钮名与分组名以帮助 `toolbar_mainbar.html` 原文为准（来源优先级：真机截图 > 中文帮助 > 代码注释，此处退到第二档，已在矩阵证据列写明）。

## DIFF-30 对齐栏多选阈值未按帮助收紧（round-94 已修，模块 A） → ✅

**问题（本轮新发现）**：`app/src/renderer/src/editor/AlignBar.tsx` 只有一个 `disabled` 属性，取值 `isStart || !selectedObj`。因此**只要选中了 1 个对象，对齐栏七组共 24 个按钮全部可用**，包括需要多个对象的对齐、尺寸、间距命令。

**帮助原文（优先级第二档，真机无该禁用态截图）**：
| 出处 | 原文 | 门槛 |
| --- | --- | --- |
| `label_object_align_align.html` | 「多数对齐选项是用于排列两个或多个标签对象彼此之间的位置。因此，除非在标签中选择了两个或多个对象，否则这些选项多数是不可用的（灰色）」 | 左齐/顶齐/右齐/底齐/垂直中齐/水平中齐 **≥2** |
| `label_object_align_size.html` | 同句，「多数尺寸选项是用于更改两个或多个标签对象彼此之间的尺寸关系」（同页还注明命令名为 水平同宽/垂直同宽/水平垂直相同） | 尺寸三项 **≥2** |
| `label_object_align_pos.html` | 「这个命令与对齐命令不同，对齐命令需要选定两个或多个对象，而这个命令**至少需要选定三个对象**」 | 水平/垂直间距相同 **≥3** |
| `label_object_align_rotate.html` / `_order.html` | 未设多选门槛 | 旋转 3 项、顺序 4 项 **≥1** |
| `label_object_align_align.html`「相对于标签的位置」段 | 针对整个选区，未设门槛 | 居中 2 项、贴边 4 项 **≥1** |

**修复**：三处入口（对齐栏按钮 / `排列(A)` 菜单 / 画布右键菜单）统一改读 `editorAvailability` 新增的 `canAlignObjects`(≥2) / `canSizeObjects`(≥2) / `canDistribute`(≥3)，与 DIFF-24 的「文档状态 + 选中对象数统一可用性来源」口径一致。
- 同时修掉一处**同类错误**：画布右键菜单 `sizeDist` 里「水平/垂直间距相同」原先只按 `multi`(≥2) 判定，现按 ≥3；`对齐` 子菜单前六项原先按 ≥1，现按 ≥2，而「居中/贴边」六项仍按 ≥1。

**实现文件**：`app/src/renderer/src/features/editor/editorAvailability.ts`、`editor/AlignBar.tsx`、`App.tsx`、`features/commands/labelShopMenus.ts`。

**断言**：`app/scripts/ui-v112.cjs` **17/17**（`MAXLABEL_UI_SCRIPT=ui-v112.cjs npm run test:ui`，已登记 `app/scripts/run-regression.ps1`）；回归 `ui-v99.cjs` 27/27、`ui-v96.cjs` 22/22、`ui-v94.cjs` 14/14、`ui-v108.cjs` 8/8 全过。

**遗留（已登记 backlog）**：画布右键时 fabric 按落点重算活动对象，其 `selectionCount` 与 React 侧选中集合可能不同步，故该入口只断言阈值阶梯递进、未断言与对齐栏逐位相等。

## DIFF-29 主工具栏「恢复」按钮的文案（round-93 已修，模块 A） → ✅

**问题**：帮助 `toolbar_mainbar.html` 的「撤消、重做」小节里，两个按钮原文是 **「撤消」**（撤消上一步操作）与 **「恢复」**（恢复刚刚撤消的操作）；`menu_edit.html` 与矩阵 A-45/A-92 也一致写作「恢复」。复刻版**编辑菜单**已正确用 `恢复(R)`（`features/commands/labelShopMenus.ts`），但**主工具栏**同一命令的按钮 title 却写成 **「重做」**（`editor/toolbarLayout.ts`、`editor/Toolbar.tsx`），状态栏也写「已重做」。即：同一条命令在菜单与工具栏上文案不同，且工具栏一侧与帮助出处不符。

**修复（round-93）**：
- `app/src/renderer/src/editor/toolbarLayout.ts`：`{ key:'redo', group:'history', label:'恢复' }`（分组标题 `撤消、重做` 保持不变，它本就是帮助的小节标题）。
- `app/src/renderer/src/editor/Toolbar.tsx`：`case 'redo'` 的 `title="恢复"`。
- `app/src/renderer/src/features/workspace/useDocumentHistory.ts`：状态栏 `已重做` → `已恢复`。
- `app/src/renderer/src/dialogs/HelpDialog.tsx`：自带帮助文案 `Ctrl+Y 重做` → `Ctrl+Y 恢复`。
- 断言同步：`app/scripts/ui-v93.cjs`（A-92 改为点「恢复」）、`app/scripts/ui-v94.cjs`（A-83 的九按钮清单第 9 项改「恢复」）。

**新增回归断言**：`app/scripts/ui-v110.cjs` 的「**撤消组按钮文案为 撤销 / 恢复**」——直接钉住工具栏上这两个按钮的 `title` 集合恰为 `撤销,恢复`，既保证与帮助出处一致，也保证「重做」不会回归。

**证据**：`app/scripts/ui-v110.cjs` **18/18**、`ui-v93.cjs` **28/28**、`ui-v94.cjs` **14/14**；命令 `MAXLABEL_UI_SCRIPT=ui-v110.cjs npm run test:ui`。

**说明**：「撤消」与「撤销」并存是原版帮助自身的用字不一致（帮助两处均写「撤消」，而真机编辑菜单为「撤销(U)」）。本轮以**真机菜单文案**（优先级更高的 UI 证据）为准统一用「撤销」，仅把有明确出处的「恢复」改正。

## DIFF-31 标签板面「左旋90度 / 右旋90度」方向做反（round-95 已修，模块 C/A） → ✅

**问题**：帮助 `menu_view.html` 的查看菜单原文是「**左旋90度 —— 向*左*旋转90度显示标签板面**」「**右旋90度 —— 向*右*旋转90度显示标签板面**」，即左旋为屏幕上**逆时针**、右旋为**顺时针**。

复刻版 `app/src/renderer/src/features/commands/labelShopMenus.ts` 的 `rotationItems()` 把**左旋接到 `setLabelRotation(90)`、右旋接到 `setLabelRotation(270)`**；而 `WorkArea.tsx` 用 CSS `transform: translate(-50%,-50%) rotate(${labelRotation}deg)` 渲染板面，正值在屏幕上就是**顺时针**（`editor/canvasCoordinates.ts` 的 `clientToCanvasPoint` 用同一约定做逆变换，两边自洽）。因此点「左旋90度」时板面实际向**右**转，点「右旋90度」时向**左**转 —— **方向完全做反**。

这与 round-90 已收口的**对象**旋转（`AlignBar` / 排列菜单 / 右键菜单）是同一类错误，当时只改了对象、漏了板面（backlog 早就登记为「疑似同一问题」，见 `parity/backlog.md`）。

**修复（round-95）**：
- `app/src/renderer/src/features/commands/labelShopMenus.ts`：`rotationItems()` 的 `左旋90度` 改 `setLabelRotation(270)`、`右旋90度` 改 `setLabelRotation(90)`，radio 判据同步互换；并补注释写明「板面 = CSS 顺时针角度」的约定与帮助出处。
- `app/src/renderer/src/editor/WorkArea.tsx`：给承载 CSS 旋转的板面容器加 `data-testid="label-board-rotator"`，供断言读实际渲染矩阵（纯测试锚点，不改外观）。

**为什么值本身证明不了对错**：改前改后存的都是 0/90/180/270 里的一支，只断言 `data-rotation` 等于多少，等于把当时的映射关系抄一遍。本轮把断言升级为**读板面真正渲染出来的变换矩阵**：CSS `rotate(θ)` 编译成 `matrix(cosθ, sinθ, -sinθ, cosθ, …)`，第二位 `b = sinθ`，于是 **b < 0 ⇔ 屏幕上逆时针（左旋）**、**b > 0 ⇔ 顺时针（右旋）**。

**断言**：
- `app/scripts/ui-v91.cjs`：A-50 由 9/9 → **18/18**（新增「左旋90度板面逆时针渲染」「右旋90度板面顺时针渲染」，并把 `data-rotation` 期望值改为 270/90）。
- `app/scripts/ui-v79.cjs`：C-88/C-89 由 6/6 → **7/7**（`rotationModes` 期望值改为 `正常0/左旋270/右旋90/旋转180180`，新增「左旋90度板面逆时针渲染、右旋90度顺时针渲染」）。
- 命令：`MAXLABEL_UI_SCRIPT=ui-v91.cjs npm run test:ui`、`MAXLABEL_UI_SCRIPT=ui-v79.cjs npm run test:ui`。

**未改动**：标尺左上角箭头的单击步进（`App.tsx` 的 `(labelRotation + 90) % 360`）仍是每次 +90。帮助 `label_view_rotate.html` 只说「点击箭头可以旋转标签显示」，**未规定转向**，故保持循环步进不动（`ui-v79.cjs` 的 C-86 仍断言 0 → 90）。

**证据截图**：`parity/reference/maxlabel/DIFF31-view-rotation-submenu.png`、`DIFF31-board-rotate-left-ccw.png`（左旋后 `rotation=270`、`sin<0`）、`DIFF31-board-rotate-right-cw.png`（右旋后 `rotation=90`、`sin>0`）；场景 `tools/parity/scenarios/diff31-board-rotate.json`。

**依据**：帮助 `menu_view.html`（优先级第二档）。**真机截图未取到** —— `LabelShopCtl.ps1` 的 `-Steps` 在本机无法解析 `keys:` 步骤（见 `parity/backlog.md` 的工装条目），故本轮以帮助原文为据，与 round-90 修对象旋转时的口径一致。

## DIFF-33 格式栏 / 对齐栏行首自造了原版没有的文字标题（round-96 已修，模块 A） → ✅

**现象**：复刻版的格式栏与对齐栏在行首各排了一个灰色小字标题（`格式` / `对齐`），原版没有。

**原版证据**：`parity/reference/labelshop/96-probe2.png` —— 主窗口三条工具栏的左缘放大件（`tools/parity/Crop-Image.ps1 -X 0 -Y 88 -W 260 -H 110 -Scale 5`）显示：每条工具栏最左侧是**点状握把**，其后**直接**是图标或控件。格式栏第一个元素就是 `Consolas` 字体下拉框，对齐栏第一个元素就是对齐图标，行内**不存在**任何 `格式` / `对齐` 文字。MFC Feature Pack 的停靠工具栏只在**浮动**状态才显示标题，停靠时没有。

**复刻版原状**：`app/src/renderer/src/editor/FormatBar.tsx:76`、`AlignBar.tsx:73` 各有一个 `<span>格式</span>` / `<span>对齐</span>`。属于自造界面元素。

**修复**：删除两处 `<span>`，并在原位留注释写明原版出处。工具栏行首现在是控件/图标，与真机同构。

**断言**：`app/scripts/ui-v98.cjs` 由 28/28 → **30/30**，新增两条：
- `A-174 元素4 格式工具栏行首无「格式」文字标题（原版只有图标）`
- `A-174 元素5 对齐工具栏行首无「对齐」文字标题（原版只有图标）`

判据是「栏内不存在只含该词（允许尾随全角/半角冒号）的叶子元素」，而不是简单查 `textContent.includes` —— 后者会被字体下拉框里的字体名或其它 help 文案误伤。命令：`MAXLABEL_UI_SCRIPT=ui-v98.cjs npm run test:ui`。

**证据**：复刻版对照截图 `parity/reference/maxlabel/DIFF33-toolbar-rows-no-text-label.png`（行首已无文字），场景 `tools/parity/scenarios/diff33-toolbar-row-labels.json`（`-Action run` 回读 `{"formatLabel":false,"alignLabel":false,"formatBar":true,"alignBar":true}`）。

**并排对照图**：`parity/review/r96-toolbar-rows.png`（左真机 `96-probe2.png` / 右复刻版 `DIFF33-toolbar-rows-no-text-label.png`，两边的三条工具栏都直接以握把+控件/图标开头）。

**关联台账**：`parity/matrix.md` A-174（主界面元素 1~12）证据列已补记本轮修正。

## DIFF-34 图层窗体的选中集与画布选中集分裂（round-97 已修，模块 B） → ✅ 已修（round-97，`app/scripts/ui-v113.cjs` 7/7；同步 effect 位于 `app/src/renderer/src/editor/LabelEditor.tsx`，用 `lastFabricSelectRef` 区分选中来源）

**发现（背压项，非验收方新报）**：`parity/backlog.md` 记为「图层窗体点击不同步画布的选中集（影响所有排列/对齐类命令）」。

**原版行为**：帮助 `label_edit_layer.html` 的图层窗体列出标签上的每个对象，**点谁就是选中谁**；选中之后 `排列(A)` 菜单与对齐栏的每个命令、以及 Delete 都作用在该对象上。原版没有「图层选中」与「画布选中」两套选中集。

**复刻版实测缺陷**：`app/src/renderer/src/features/editor/useEditorTransformCommands.ts` 的 `selectedIds()` 优先取 Fabric 的 `fc.getActiveObjects()`，只有「Fabric 活动对象是包含 requestedId 的组」时才回落到模型选中。而 `LabelEditor.tsx` 里**没有任何**「模型 `selectedId` → Fabric 活动对象」的回灌路径——`LayerPanel` 的行点击只改 `tab.selectedId`。后果：先在画布上 `Ctrl+A`（或 Shift 多选 / 框选），再点图层窗体的某一行，此时执行 排列→对齐 / 移到最后 / Delete，作用的仍是画布上残留的**旧多选集**。`ui-v107.cjs` 当时以「先点画布空白处清掉画布选中集」规避了这个缺陷。

**修复**：`app/src/renderer/src/editor/LabelEditor.tsx` 新增一个 `selectedId → Fabric` 同步 effect，并用 `lastFabricSelectRef` 区分变更来源：
- `selection:created` / `selection:updated` / `selection:cleared` 里记录「这次模型选中变更来自画布」，同步 effect 见到 `selectedId === lastFabricSelectRef.current` 即跳过 —— 保证画布上的 Shift 多选与 `Ctrl+A` 的 ActiveSelection **不被压成单选**；
- 其余来源（图层窗体行点击、图层行右键、标签页切换、菜单类入口）改变 `selectedId` 时，把 Fabric 活动对象换成该对象（`discardActiveObject()` + `setActiveObject()`），并把画布选中集清空/替换到位。

**判据（断言）**：`app/scripts/ui-v113.cjs` **7/7**（已登记进 `app/scripts/run-regression.ps1`）：
- `Ctrl+A 全选后画布活动对象仍是 3 个（同步 effect 未破坏 Shift/全选多选）`（回归保护）
- `点图层行后画布活动对象即为该行对象（不再是残留的旧多选集）`
- `点图层行后该行标记为已选中（模型选中集一致）`
- `随后按 Delete 只删除图层选中的那个对象（排列/编辑命令作用域跟随图层选中）`
- `点击已选中的图层行（切换为取消选中）后画布选中集同步清空`

命令：`MAXLABEL_UI_SCRIPT=ui-v113.cjs npm run test:ui`。**全量回归**：`npm run test:ui` → **62/62 脚本全过、0 条 FAIL**（含 ui-v113 新登记项），即本同步 effect 未破坏既有 61 个脚本的行为。

**注意（本轮踩到的坑，已记入 backlog）**：`scripts/run-regression.ps1` 启动的是 **`out/` 下的构建产物**（`electron .`），不是 dev server —— 改完 renderer 源码必须**先 `npm run build`** 再跑 `test:ui`，否则断言看到的是旧构建（本轮首跑 4/7 即为此因，非产品缺陷）。

**关联台账**：`parity/matrix.md` B-19 / B-13 证据列已补记。

## DIFF-36 启始页菜单栏只有 7 个顶层菜单（真机 12 个） → ✅ 已修（round-104，`app/scripts/ui-v118.cjs` 9/9）

**发现（打包版 v1.0.2 首次启动冒烟暴露）**：`app/scripts/ui-smoke.cjs` 的「menubar 12 menus」断言在安装包上失败——运行期 `[data-menu-title]` 只回读出 7 项：文件(F) / 查看(V) / 账户(A) / 云马通(C) / 选项(O) / 帮助(H) / 建议与反馈。

**原版行为**：真机启始页菜单栏与编辑态**同为 12 个顶层菜单**。本轮采集的真机启始页全屏截图 `parity/reference/labelshop/probe-01-newlabel.png` 显示：文件(F) 编辑(E) 查看(V) 工具(T) 排列(A) 数据库(D) 账户(A) 云马通(C) 选项(O) 窗口(W) 帮助(H) 建议与反馈；与编辑态基线 `parity/reference/labelshop/40-editor.png` 的菜单栏逐项一致。两态的区别只有两点：①「文件(F)」换成启始页专用条目（新建/新建条幅飘带/打开/打印设置/最近的文件/退出，没有保存、打印预览等文档命令）；②其余菜单里依赖文档的条目**变灰**（编辑、工具、排列、数据库、窗口的绝大多数条目）。

**复刻版实测缺陷**：`app/src/renderer/src/features/commands/labelShopMenus.ts` 的 `startMenus()` 从 `editorMenus()` 结果里只挑了 查看/账户/云马通/选项/帮助/建议与反馈 六个 section，加上自己构造的「文件(F)」，于是启始页少列 编辑(E)、工具(T)、排列(A)、数据库(D)、窗口(W) 五项。这不仅与真机肉眼可见地不一致，还使「先在启始页切换工具栏/状态栏」这类经 查看(V) 的操作看似正常、而按真机习惯去点 工具(T) 的入口根本不存在。

**修复**：`startMenus()` 改为构造启始页专用的「文件(F)」之后，直接拼接 `editorMenus()` 中除「文件(F)」外的全部 section（保持真机顺序），依赖文档的条目沿用既有的 `deps.isStart` / `availability` 禁用条件，自然呈现真机的「变灰」态。

**判据（断言）**：`app/scripts/ui-v118.cjs` **9/9**（已登记 `app/scripts/run-regression.ps1`）：
- 启始页顶层菜单恰好 12 个（修复前 7 个）
- 启始页顶层菜单标题与顺序同真机（文件(F)…建议与反馈）
- 启始页「编辑(E)」展开后条目全部禁用
- 启始页「工具(T)」展开后条目全部禁用（绘制工具需先有文档）
- 启始页「数据库(D)」含「设置数据库(D)...」且禁用
- 启始页「窗口(W)」含「新建窗口(N)」且禁用
- 启始页「文件(F)」为启始页专用列表（含「新建条幅飘带」、不含编辑态「保存(S)」）
- 编辑态顶层菜单序列与启始页完全一致（12 项同序）
- 编辑态「工具(T)」里「条码(B)」不再禁用（对照启始页禁用态）

命令：`MAXLABEL_UI_SCRIPT=ui-v118.cjs npm run test:ui`。

**关联台账**：`parity/matrix.md` A-174 元素2（主菜单）证据列已补记 round-104 记录。

**注意（本轮再次踩到的坑）**：`app/scripts/run-regression.ps1` 跑的是 `out/` 构建产物，改 renderer 源码后必须先 `npm run build`；首跑 3/9 即为此因。另外用编辑器改 `.ps1` 会把 UTF-8 **BOM 抹掉**，Windows PowerShell 5.1 随即按 GBK 解析中文注释而报 `Unexpected token '}'`——改完 `.ps1` 必须确认首字节仍是 `EF BB BF`。

## DIFF-37 打印机安装/移除逻辑与真机完全不同、装完删不掉、卷筒标签展示不一致（用户实测） → ✅ 已修（round-105，`app/scripts/ui-v119.cjs` 24/24 + `app/scripts/ui-v82.cjs` 15/15 + `npm run test:printer`）

**用户实测（2026-09-18，接了真实打印机 佳博 GP-1324D）**：
1. 「打印机安装逻辑和原来 LabelShop 的逻辑完全不一样」；
2. 「现在无法删除打印机」；
3. 「选择打印机了后卷筒标签的展示和原来不一样」。

**真机取证（本轮新增 `parity/reference/labelshop/PROBE-round105.md`）**：
- 「安装 LabelShop 打印机」对话框 = 品牌过滤下拉（**39 项**：全部 + 38 品牌）+ **SysListView32 列表（125 行）**，列为「打印机 | 状态」，底部「安装 / 移除 / 帮助 / 返回」，说明文字「安装 LabelShop 打印机，可以在LabelShop中实现一般的标签打印功能。如果想充分发挥打印机的性能，请安装官方提供的驱动程序。」
- 条目命名 = 「品牌 型号/原生指令集-N (dpi)」，例如 `Gprinter GPL-N (203 dpi)`、`Zebra ZPL-N (203 dpi)`、`Argox PPLB-N (600 dpi)`；安装后该行「状态」列写「已安装」，移除后清空。
- 装好后回到「选择标签格式」页：**打印机下拉最前面**多出 `Gprinter GPL-N (203 dpi)`（其余系统打印机保持原顺序）。
- 选中它 → 标签品牌变成 1 项 `京成云马标签 (卷筒标签)`、标签类型 **7 项**、标签名称 **31 项** `[602001] 100mm x 150mm 单列 320签/卷` …；
  选中普通 Windows 打印机（Microsoft Print to PDF）→ 品牌 2 项带 `(平张标签)`、类型 1 项「云马优质打印纸标签」、名称 42 项 `[6080xx]`。

**复刻版修复前的三处缺陷**：
1. **对话框是自造的**：品牌 + 指令集 + 分辨率 + 端口 + Windows 目标打印机 + 机型输入框的表单，真机根本没有这套表单；
2. **删不掉**：`App.tsx` 的 `onPrinterRemove` 只在非起始页清文档里的 `printer`，**不清全局偏好**，而 `const printer = doc?.printer ?? defaultPrinter` 会回退到全局偏好 → 移除后打印机照旧出现；起始页上更是直接什么都不做（而「安装」却写了全局偏好，两处语义不对称）；
3. **卷筒展示不一致**：介质类型靠打印机名正则猜（`ROLL_PRINTER_PATTERN`），合成项「已安装配置：…」塞在系统打印机列表里；品牌后缀用的是全角「（卷筒标签）」；选定平张打印机时 `availableFormats` 用**全量目录**，导致京成云马标签的「标签类型」混进 7 个卷筒类型（真机只有 1 个）。

**修复**：
- 新增真机目录数据 `app/src/shared/domain/printerCatalog.generated.ts`（125 行 + 39 品牌过滤，生成器 `app/scripts/generate-printer-catalog.cjs`，来源就是 `probe-08-install-list.txt` / `probe-10-install-filter.txt`）；
- 新增偏好模块 `app/src/renderer/src/features/shell/installedPrinters.ts`：`maxlabel.installedPrinters` 记录已安装条目 id（顺序 = 安装顺序），并提供 CatalogEntry → PrinterConfig 的翻译（指令集/分辨率/型号/打印机名 + 指令文件端口）；
- `PrintersInstallDialog.tsx` 重写为真机的列表形态（过滤 + 列表 + 状态列 + 安装/移除/帮助/返回 + 真机原文说明），未选中行时安装/移除均禁用；
- `NewLabelDialog.tsx`：打印机下拉 = **已安装的 LabelShop 打印机在前 + 系统打印机在后**；LabelShop 打印机一律按卷筒处理，Windows 打印机按驱动名识别；品牌后缀改成半角「 (卷筒标签)」/「 (平张标签)」；`availableFormats` 改为**按 type 过滤**（平张不再混入卷筒类型）；
- `App.tsx`：安装写入偏好 + 文档绑定，移除同时清文档绑定与全局偏好（真正删得掉）；
- 帮助原文（指令集 / 未收录型号 / 分辨率 / 分辨率不匹配）迁到帮助主题「安装打印机」（真机里这些是帮助文档内容，不在对话框正文）；
- 顺手加固 `printers:list`：系统队列枚举失败时不再整体返回 ok:false，仍返回 PnP/USBPRINT 设备枚举结果。

**判据**：
- `app/scripts/ui-v119.cjs` **24/24**（新登记进 `app/scripts/run-regression.ps1`）：对话框结构/125 行/39 品牌、未选中禁用、安装→状态「已安装」、返回后打印机下拉第一项为该打印机、卷筒 1 品牌 7 类型 31 项、Windows 驱动形式的佳博 GP-1324D 也走卷筒、平张 2 品牌 1 类型 42 项、移除后状态清空且下拉不再包含它、偏好被清空；
- `app/scripts/ui-v82.cjs` **15/15**（D-34~D-44 全部按真机重写，含帮助主题「安装打印机」原文）；
- `app/scripts/printer-catalog.test.ts`（`npm run test:printer`）：目录 125 行/39 品牌、指令集映射、安装-移除偏好语义、脏偏好过滤、条目→配置翻译、卷筒/平张目录数量口径。

**未验证项**：真机安装多台时的排列顺序（外部改选中态不改变原版的焦点行，见 `PROBE-round105.md` §4），复刻版按安装顺序（先装在前）。

## DIFF-38 卷筒标签的第二行文字与预览形态与真机不一致（用户反馈的「纸张尺寸/预览」部分） → ✅ 已修（round-106，`app/scripts/ui-v119.cjs` 29/29 + `app/scripts/ui-v72.cjs` 8/8）

**真机取证（`parity/reference/labelshop/PROBE-round106.md`）**：
- 选择标签格式页第二行随介质类型变化：卷筒 = `纸宽：  102 毫米`；平张 = `纸张：  210 毫米 X  297 毫米`（`X` 后右对齐 4 位）。
- 卷筒预览 = **竖带**（宽 = 纸宽 102）+ 主标签（100×150）水平居中 + **上下各露一截相邻标签**（同形状描边、中间是标签间隙），主标签中央写序号 1；红色尺寸标注仍是 100mm / 150mm。
- 平张预览维持整张纸 + 2×4 网格 + 序号 1~8（round-72 起已对齐）。
- 卷筒格式建出的文档：编辑区白色版面 = 标签 100×150；状态栏 `Gprinter GPL-N (203 dpi) | 100mm x 150mm 单列 320签/卷 | …`；打印面板的打印机下拉即刚安装的 LabelShop 打印机。

**复刻版修复前**：两种介质都写「纸张： W 毫米 X H 毫米」（卷筒下变成 `纸张：  102 毫米 X 150 毫米`）；卷筒预览按「纸 + 网格」画，`pageH` 直接取标签高，既无竖带语义也无相邻标签切片。

**修复**（都在 `app/src/renderer/src/dialogs/NewLabelDialog.tsx`）：
- 第二行文字按介质类型输出：卷筒 `纸宽：  W 毫米`、平张 `纸张：  W 毫米 X  H 毫米`（高度 `padStart(4)`）；
- 新增卷筒预览分支（`data-testid=new-label-roll-strip` / `new-label-roll-slice`）：竖带 + 主标签居中 + 上下各一截相邻标签（高 ≈ 标签高 12%，间隔取格式 `rowGapMm`），`pageH` 相应加上上下切片高度；
- 平张分支保持原样（整张纸 + 网格）。

**判据**：`app/scripts/ui-v119.cjs` **29/29**（新增 5 条：卷筒第二行 = `纸宽：  102 毫米`、竖带标记 + 上下 2 个切片、序号 1 居中、平张第二行 = `纸张：  210 毫米 X  297 毫米`、平张无竖带标记）；`app/scripts/ui-v72.cjs` **8/8**（平张第二行断言同步为真机空格）。复刻版对照截图 `parity/reference/maxlabel/A118-roll-preview.png`。

## DIFF-39 打印机属性 → 端口页与真机不一致（缺「蜂打打云盒」、端口文字不同、USB 端口没有枚举列表） → ✅ 已修（round-106，`app/scripts/ui-v120.cjs` 12/12 + `npm run test:printer`）

**真机取证（`parity/reference/labelshop/PROBE-round106.md` §5、`probe-14-printer-props-combos.txt`）**：
- `<打印机名> 属性` 对话框的「类型(T)」下拉 7 项：打印机端口(LPT) / 串行端口(COM) / 标准 TCP/IP 打印机端口 / USB 打印机端口 / 蓝牙 / **蜂打打云盒** / 打印机驱动程序端口；
- 类型=USB 时「端口(O)」下拉列出 PnP 设备：`USB001 (Gprinter GP-1324D)`，另有提示「请连接USB打印机，并打开打印机电源。」与按钮「刷新USB端口」。

**复刻版修复前**：类型下拉只有 6 项且文字不同（打印机端口（LPT）/打印机端口（COM）/蓝牙（SPP）/Windows 打印机驱动端口），没有「蜂打打云盒」；USB 类型只有一句静态说明，没有「端口(O)」列表也没有刷新按钮。

**修复**：
- `app/src/shared/domain/printer.ts`：`PORT_TYPE_OPTIONS`（真机 7 项文字/顺序）、`PortType+cloudbox`、`PortConfig.usbPort`、`formatUsbPrinterPort()`、端口校验（cloudbox 走 TCP 规则、usb 必选端口）；
- `app/src/main/printing/commandTransport.ts`：`listWindowsUsbPrinterPorts()` 从 `Win32_PnPEntity` 的 `USBPRINT\...&USB001` 解析端口名 + 设备名；`sendCommand` 的 TCP 分支同时处理 cloudbox；
- `ports:list` 同时返回 `comPorts` 与 `usbPrinterPorts`（契约 `app/src/shared/ipcContract.ts` 同步）；
- `app/src/renderer/src/dialogs/PrinterSettings.tsx` 端口页按真机重做「类型(T) / 端口(O)」两栏，切到 USB 自动枚举。

**判据**：`app/scripts/ui-v120.cjs` **12/12**（已登记 `app/scripts/run-regression.ps1`）：类型下拉前 7 项文字顺序同真机、保留「打印到文件」、USB 出现端口下拉 + 刷新USB端口 + 真机提示、USB 列表含 `USB001 (Gprinter GP-1324D)`、未选端口时保存禁用、COM/LPT/云盒/驱动四种类型的参数控件、保存后回读一致；`app/scripts/printer-catalog.test.ts` 追加端口类型/格式化/校验三组断言。

## DIFF-40 打印机属性缺「工具」页；串行端口只有波特率一项（真机 5 项） → ✅ 已修（round-107，`app/scripts/ui-v121.cjs` 10/10 + `ui-v120.cjs` 13/13 + `npm run test:print`）

**真机取证（`parity/reference/labelshop/PROBE-round107b.md`）**：
- `Gprinter GPL-N (203 dpi) 属性` 的页签是 **首选项 / 端口 / 自定义命令 / 工具** 四个；「工具」页分组「常用」，`操作：` 下拉 2 项（发送打印机命令 / 发送文件到打印机）+ `执行` 按钮 + 下方输出区；点「执行」在「发送文件到打印机」下会弹 Windows「打开」对话框。
- 「端口」页类型=串行端口(COM) 时有 **5 项参数**：速率(B) 15 档（默认 9600）/ 数据位(D) 7·8（默认 8）/ 奇偶检验(P) 无·奇·偶·标志·空格（默认 无）/ 停止位(S) 1·1.5·2（默认 1）/ 流控制(F) 无·硬件（RTS/CTS）·软件（XON/XOFF）（默认 无）。

**复刻版修复前**：只有 首选项 / 端口 / 自定义命令 三个页签（缺「工具」整页）；串行端口只有「波特率」且默认 115200、`writeSerialWindows` 固定 None/8/One，`PortConfig` 也只存 baudRate。

**修复**：
- 新增「工具」页：操作下拉 2 项 + 执行 + 输出区；「发送打印机命令」走既有 `print:command`，「发送文件到打印机」走新增 IPC `command:send-file`（`validateCommandFilePayload` + `MAX_COMMAND_FILE_BYTES`=16MB，文件字节原样发给当前端口）。
- 串行端口 5 项参数：`SERIAL_BAUD_RATES`（15 档）/`SERIAL_DATA_BITS`/`SERIAL_PARITY_OPTIONS`/`SERIAL_STOP_BITS_OPTIONS`/`SERIAL_FLOW_OPTIONS`；`PortConfig` 增 `dataBits/parity/stopBits/flowControl`；`writeSerialWindows()` 按参数构造 `SerialPort` 与 `Handshake`；`validation.ts` 同步校验；切到 COM/蓝牙时默认值改为真机的 9600/8/无/1/无。

**与真机的已知差异**：真机点「执行」才弹文件对话框，复刻版提供「文件」输入框 + 「选择文件…」按钮（也走系统对话框）；真机命令为空时静默，复刻版给「请输入要发送的打印机命令」提示。

**判据**：`app/scripts/ui-v121.cjs` **10/10**（页签/操作 2 项/执行/空命令提示/发送命令输出字节数与结果/端口显示/发送文件入口/空路径提示/不存在文件被拒绝）；`app/scripts/ui-v120.cjs` **13/13**（新增 COM 5 项参数的选项与默认值断言）；`app/scripts/print-engine.test.ts` 追加串行参数往返与非法值断言。

## DIFF-41 内置驱动（安装的 LabelShop 打印机）文档下「打印预览」没有禁用 → ✅ 已修（round-108，`app/scripts/ui-v119.cjs` 32/32）

**真机取证（`parity/reference/labelshop/PROBE-round108.md`）**：同为编辑器里的文档，只差绑定的打印机——
- 卷筒文档（打印机 = `Gprinter GPL-N (203 dpi)`，即**签赋LabelShop 打印机/内置驱动**）：文件菜单 `打印预览(V)` **灰（禁用）**（`probe-19-filemenu.png`）；
- 平张文档（打印机 = `Microsoft Print to PDF`）：`打印预览(V)` **可用**（`probe-20-filemenu-sheet.png`）。
两者 `打印(P)...` 都可用、`导出打印机指令文件(E)` 都禁用。与帮助 `print_preview.html`「LabelShop 打印机内置驱动不支持打印预览」一致；台账 DIFF-23 当年判「复刻版无内置驱动端口，限制客观不存在」，round-105 引入「安装 LabelShop 打印机」后该前提已不成立。

**修复**：`isLabelShopBuiltInPrinter()`（文档 `printerName` 命中已安装的 LabelShop 打印机）→ 文件菜单 `打印预览(V)`、工具栏预览按钮、打印对话框「预览」按钮全部禁用（按钮 title 说明原因），`handlePreview()` 兜底置状态栏提示。

**判据**：`app/scripts/ui-v119.cjs` **32/32**（新增：内置驱动文档文件菜单「打印预览(V)」禁用 + 打印对话框「预览」禁用且 title 含原因 + Windows 驱动端口文档「打印预览(V)」可用）。

**同轮附带**：「蜂打打云盒」参数区形态对齐真机（`云盒：` 下拉 + `设置` 按钮；点「设置」展开地址/端口输入，真机由云盒发现填充）——`app/scripts/ui-v120.cjs` 14/14。

## DIFF-42 「选择标签格式」打印机下拉的排序错了（我们排成「已安装优先」，真机是按名称升序合并） → ✅ 已修（round-109，`app/scripts/ui-v119.cjs` 32/32 + `ui-v82.cjs` 15/15）

**真机取证（`parity/reference/labelshop/probe-21-two-printers.txt`）**：在真机上装**两台**签赋LabelShop 打印机
（`Gprinter GPL-N (203 dpi)` 与 `TSC TSPL-N (203 dpi)`）后，「选择标签格式」页的打印机下拉变成 5 项，顺序为：

1. `Gprinter GPL-N (203 dpi)`（LabelShop 打印机）
2. `HP7E6C81 (HP LaserJet Pro M329)`（系统）
3. `Microsoft Print to PDF`（系统）
4. `OneNote (Desktop)`（系统）
5. `TSC TSPL-N (203 dpi)`（LabelShop 打印机）

→ 即 **签赋LabelShop 打印机与系统打印机合成一个列表、按名称升序**，而不是「已安装的排在系统打印机之前」。
（round-105 只装了一台，看到 Gprinter 排在最前，误判成「已安装优先」；本轮装两台后证伪。）

**附：如何用窗口消息装第二台**（原版鼠标注入无效，`LVM_SETITEMSTATE` 也改不了它的焦点行）：
先用品牌过滤把列表缩到 `TSC / Zenpert`，再 `TAB` 三次把焦点移到过滤器/列表、按 `DOWN` 选行，最后 `BM_CLICK` 安装 —— 装机结果是过滤后第 0 行 `TSC TSPL-N (203 dpi)`。

**修复**：`app/src/renderer/src/dialogs/NewLabelDialog.tsx` 把两组候选合并后按名称升序（`toLowerCase().localeCompare(..., 'en')`）再渲染。

**判据**：`app/scripts/ui-v119.cjs` 断言「打印机下拉 = LabelShop 打印机 + 系统打印机按名称升序」且两者都在（32/32）；`app/scripts/ui-v82.cjs` D-42 同步（15/15）。

## DIFF-43 新装的 LabelShop 打印机默认端口错成「指令文件」；USB 端口不能真正发指令 → ✅ 已修（round-110，`ui-v119.cjs` 34/34 + `ui-v121.cjs` 12/12 + `npm run test:printer`）

**真机依据**（`parity/reference/labelshop/PROBE-round110.md`）：帮助 `print_printer_cfg_port.html`（台账 D-23）写明「打印输出端口类型**默认为USB打印机端口**」，
真机 `Gprinter GPL-N (203 dpi) 属性 → 端口` 也确实是 `类型 = USB 打印机端口`、`端口(O) = USB001 (Gprinter GP-1324D)`（`probe-14-printer-props-combos.txt`）。

**修复前**：`configFromCatalogEntry()` 把新装打印机的端口落成 `file`（指令文件），与真机默认不符；
且 `sendCommand()` 对 `usb` 端口只回一句「USB 设备请使用系统打印驱动或对应的 USB 虚拟串口」，等于 USB 端口不可用。

**修复**：
- 默认端口改为 `usb`：`configFromCatalogEntry(entry, base, usbPort?)`；`ModalHost` 安装时先 `listPorts()` 取第一台 USB 设备写进去；
- USB 指令输出走 Windows 打印后台（spooler）raw 写入：`usbPortName()` 从 `USB001 (Gprinter GP-1324D)` 取出端口名 → `Get-Printer` 找队列 →
  `OpenPrinter` / `StartDocPrinter(DATATYPE=RAW)` / `WritePrinter`；没有队列时给出「请先安装该打印机的官方驱动（或把端口改为串口/指令文件）」。

**能力边界（已记录）**：Windows 不把 `USB001` 暴露成可写设备路径（实测 `\.USB001`、`\.USBPRINT…` 都打不开），
真机是靠内置驱动直接写 USBPRINT；复刻版没有内置驱动，只能走 spooler，因此**需要存在打印队列**（即用户先装厂商驱动）。

**判据**：`printer-catalog.test.ts` 断言默认端口与 `usbPortName()` 解析；`ui-v119.cjs` 断言安装后「属性 → 端口」为 `USB 打印机端口` 且默认选中 `USB00x (Gprinter GP-1324D)`；`ui-v121.cjs` 断言 USB 下执行发送会得到「没有找到 Windows 打印队列…」的明确提示。

## DIFF-44 标准 TCP/IP 打印机端口的控件形态与真机不同（我们用单框主机名/IP，真机是 SysIPAddress32 四段 IP） → ✅ 已修（round-111，`ui-v69.cjs` 10/10 + `ui-v121.cjs` 12/12）

**真机依据**（`parity/reference/labelshop/probe-14-print-dialog.png` / `probe-14-printer-props-combos.txt`）：
「端口」页类型 = `标准 TCP/IP 打印机端口` 时，参数区是 **`SysIPAddress32` 四段 IP 输入 + 端口号 + `设置` 按钮**；
复刻版此前是一个「主机名/IP」文本框 + 端口号，属形态差异（功能等价，台账 D-25 记为等价替代）。

**修复**：`app/src/renderer/src/dialogs/PrinterSettings.tsx` 的 TCP/IP 分支改为四段 IP 输入
（`printer-port-ip-1..4`，每段限 3 位并夹到 0–255，合成 `tcpHost`）+ 端口号 + 「按主机名填写 / 按 IP 填写」切换按钮；
既有配置若是主机名（例如 `printer.local`）仍默认走主机名输入框，**保留主机名兼容**（真机控件只收 IP，复刻版是超集）。

**判据**：`app/scripts/ui-v69.cjs` **10/10**（四段 IP 存在 + 端口默认 9100 + 段值 999 夹到 255 + 四段填满后可保存）；
`app/scripts/ui-v121.cjs` **12/12**（用四段 IP 填 127.0.0.1 走通发送链路）。

## DIFF-45 「标签格式设置」缺页面左空/上空；卷筒格式的行数没有禁用（需求清单「标签格式」13 条取证发现） → ✅ 已修（round-112，`ui-v70.cjs` 17/17 + `ui-v119.cjs` 36/36 + `test:print`）

**真机取证（`parity/reference/labelshop/PROBE-round112.md`，用新工装 `Read-LabelShopDialogTree.ps1` 递归枚举）**：

| 页签 | 真机控件 | 复刻版修复前 |
| --- | --- | --- |
| 打印机 | `名称(N)` 下拉 + `设置(S)`/`安装(I)`；`输出方式:` 下拉；`整页反相打印`、`单页任务模式`（`镜像输出` 仅标签打印机可见） | 一致 |
| 页面 | `纸张尺寸(Z)` 下拉 + `更改标签格式(S)` + `手动设置` + `纸型(P)`；`尺寸`：宽度(W)/高度(H)/**左空(L)**/**上空(T)**；`纸张颜色` | **缺 左空/上空** |
| 标签 | 标签（宽/高）、形状、间距（列距/行距）、孔洞（下拉 + 灰禁毫米框）、行列（列数/行数）；`多行标签` 按钮 | 一致 |
| 其它 | `起始位置(A)`、`首选方向(W)`、`打印位置微调`（左侧/顶部）、`保存自定义格式`（系统格式下灰禁） | 一致（保存按钮形态不同） |

另外：**系统预定义格式下**，页面的宽度/高度/左空/上空与「应用(A)」都是灰的（复刻版一致）；
**卷筒格式**下「标签」页里 **`行数(R)` 是灰的**、`列数(C)` 可设置（复刻版修复前两个都可编辑）。

**修复**：
- `PageLayout` 增 `pageLeftMm/pageTopMm`（`app/src/shared/domain/document.ts` 归一化 + `app/src/shared/print/layout.ts` 的 `pageCells()` 用它做标签阵列起点），
  `TemplatePropsDialog.tsx` 的「页面」页新增 左空/上空 两个输入（系统格式只读）；
- `installedPrinters.ts` 增 `isRollPrinter()`；「标签」页的行数在卷筒打印机下只读，保存时按 1 行落库（真机语义）。

**判据**：`ui-v70.cjs` **17/17**（新增 左空/上空 字段存在 + 系统格式只读 + 自定义可输入 7.5/3）；
`ui-v119.cjs` **36/36**（新增 卷筒自定义文档「标签格式设置 → 标签」页 行数只读、列数可编辑）；
`print-engine.test.ts` 新增「页面左空/上空把整组标签格平移到指定起点」；`printer-catalog.test.ts` 新增 `isRollPrinter` 判定。

## DIFF-46 「系统选项」缺「新建对象后自动打开属性页」；且保存后对话框不关闭 → ✅ 已修（round-113，`ui-v116.cjs` 12/12）

**真机依据**（`parity/reference/labelshop/65-dlg-options.png`，INDEX.md L460 起的控件清单）：
「系统设置 → 常规」页字段顺序为 界面语言(L) / 标尺单位(U) / 输出非打印对象(P) / 不选中非打印对象(N) / 允许运行脚本(S) /
启动时运行模板向导 / 自动旋转输出页面 / **新建对象后自动打开属性页** / 标签工作区背景颜色 + 恢复默认。

**修复前的复刻版**：常规页缺「新建对象后自动打开属性页」这一项；另外点「保存」只写偏好、**不关闭对话框**（用户体感像没生效）。

**修复**：
- `AppOptions` 增 `autoOpenObjectProps`（默认关闭，与真机一致）+ 常规页复选框 `auto-open-object-props`；
- `handleCreateAt` / `handleCreateRect` 在勾选时于新建对象后自动 `setModal(props)`（单击与拖拽两条创建路径都覆盖）；
- 「保存」按钮补上 `onClose()`（保存后关闭，与真机 确定 的行为一致）。

**判据**：`app/scripts/ui-v116.cjs` **12/12**：新增「系统设置含『新建对象后自动打开属性页』且默认未勾选」与「勾选后新建对象会自动打开属性对话框」两条断言。

---

## DIFF-47 一次纯鼠标拖动就把对象框改成「渲染内容尺寸」（条码 8mm→5.08mm、文字 11mm→16mm） → ✅ 已修（round-114，`ui-v122.cjs` 20/20）

**发现方式**：需求清单「对象编辑」第 45 条的取证回归（`ui-v122.cjs`）里拖动条码 4 毫米后回读尺寸，
发现 `h` 从 8 毫米变成 5.08 毫米、`x` 还多走了 0.5 毫米。

**根因**：`fabricObjects.ts` 里条码的画布对象是**等比缩放的图片**（`scaleX/scaleY = min(框宽/原图宽, 框高/原图高)`），
文字的画布对象宽度是**文本自然宽度**——两者都不等于模型的「对象框」。
而 `syncFromFabric.ts` 用 `fabricObject.width * scaleX / scale` 回写模型 `w/h`、用 `left/top` 回写 `x/y`，
于是**一次纯拖动**（`scaleX/scaleY` 没变）也会按渲染框改写对象框尺寸与位置。

**修复**（`app/src/renderer/src/features/canvas/syncFromFabric.ts` + `fabricObjects.ts`）：
- `makeObject()` 创建时把当时的缩放比记到画布对象上（`dataBoxScaleX/Y`）；
- 回写时若缩放比与创建时相同（＝用户只移动/旋转），**对象框尺寸原样保留**；只有真的改过尺寸时才按渲染框换算；
- 位置改用「模型框」对齐换算（`modelBoxTopLeftPx`：按创建时的 `align` / `verticalAlign` / `barcodeAlign` 把渲染框换算回模型框），
  顶层对象与**组内子对象**走同一套（否则拖动整组会把组里的条码/文字越拖越小）。

**回归**：`ui-v122.cjs`「45 鼠标直接拖动对象改变位置且尺寸不变」+「60 再次 Ctrl+L 解锁后对象恢复可拖动」。

---

## DIFF-48 位置锁定没有拦住方向键与对齐命令，属性页位置也能改 → ✅ 已修（round-114，`ui-v122.cjs` 20/20）

**原版依据**（原版自带帮助，`app/docs/labelshop-help-zh`）：
- `label_object_align_pos.html`：「位置锁定 锁定/解除锁定对象的位置。**位置被锁定的对象不能被移动**」；
- `label_object_align_align.html`：「**所有的对齐命令对于具有位置锁定属性的对象不起作用**」；
- `label_object_page_general.html`：「使用常规属性页时**位置选项被禁止无法更改其数值**」。

**修复前的复刻版**：只有鼠标拖动被 `evented` / `lockMovement*` 挡住；方向键（`moveSelectedBy`）、
排列菜单的对齐/居中/间距/旋转/尺寸命令、以及对象属性对话框的 X/Y 输入都照改不误。

**修复**：
- `useDocumentCommands.moveSelectedBy` 跳过 `locked === true` 的对象；
- `useEditorTransformCommands.transformSelected` 过滤锁定对象（全被锁时状态栏提示「对象位置已锁定，无法移动（排列 → 位置锁定 可解锁）」）；
- 属性对话框通用页：锁定时「X（毫米）」「Y（毫米）」「水平位置」「垂直位置」置灰（`data-testid=obj-x/obj-y/obj-align-h/obj-align-v`）。

**回归**：`ui-v122.cjs`「60 位置锁定后鼠标拖动 / 方向键 / 对齐命令都无法移动」+「60 位置锁定时属性页 X/Y 与水平/垂直位置被禁止改数值」。

---

## DIFF-49 被组合的锁定对象没有失去位置锁定 → ✅ 已修（round-114，`ui-v122.cjs` 20/20）

**原版依据**：`label_object_page_general.html`「**如果一个锁定的对象被组合，对象将失去位置锁定属性**」。

**修复前的复刻版**：`groupObjects()` 原样复制子对象，`locked` 被带进组合里，解组后又「复活」。

**修复**：`operations.ts` 的 `groupObjects()` 生成组合时清掉子对象的 `locked`；
顺带把组合框从「取 x/y/w/h 的最小最大」改成**旋转后的视觉包围盒并集**（原写法对旋转对象与组合子对象——它们的 x/y 存的是中心——都会算错）。

**回归**：`ui-v122.cjs`「60 锁定的对象被组合后失去位置锁定」+ 单测 `editor-operations.test.ts`（36 条，新增组合框并集/清锁定断言）。

---

## DIFF-51 打印对话框「选取起始标签」没有把起始标签之前的格子置灰、也没有重新排号 → ✅ 已修（round-114，`ui-v123.cjs` 17/17）

**原版依据**：打印对话框帮助 `print_dlg_main.html`「选择起始标签（仅页式打印机有效）……被指定为起始标签之前的标签
**都将变成灰色**，而之后的所有标签**将重新排号**，指定的起始标签排号为 **1**」。

**修复前的复刻版**：8 个格子固定编号 1..8，只有选中的那格高亮，之前的格子照常可点。

**修复**：`PrintDialog.tsx` 起始标签预览按「已用过」置灰并禁用，编号从起始标签起重新排号（第 3 格显示 1、第 4 格显示 2……）。

**回归**：`ui-v123.cjs`「260 起始标签之前的格子变灰禁用、起始标签起重新排号为 1」。

---

## DIFF-52 对象工具激活时，拖到已有对象上会把它拖走而不是新建 → ✅ 已修（round-114，`ui-v109.cjs` 21/21）

**原版依据**：帮助 `label_object_create_drag.html`/`label_object_create.html`：选中对象工具后鼠标变为对应图标，
**在模板上拖动即创建**新对象。真机 2026-09-21 实测（`postdrag:docview|400,300|700,400`）在已有画布上也能正常拖出新对象。

**怎么发现的**：DIFF-47 修好「拖动回写把对象框改成渲染尺寸」之后，`ui-v109.cjs` 第 8 步开始失败
（连排两个文字对象只成功一个）。原因是该步第二次拖动的落点本来落在条码的**真实对象框**内——
以前条码被回写成「渲染高度 5.08 毫米」的假框，落点恰好擦过；框修对了以后就撞上了。
**即：测试坐标一直依赖那个假框，真缺陷是「有对象工具时命中测试仍然命中已有对象」。**

**修复**：`LabelEditor.tsx` 的 `findTarget` 覆写在**对象工具**激活时直接返回空
（返回形状与 fabric 自己的 `findTarget` 一致：`{ subTargets: [], currentSubTargets: [] }`；
`_onMouseMove` 会解构它，返回 `undefined` 会让 fabric 抛 `Cannot destructure property 'target'`）。
「数据」工具不在其列——它要靠命中测试点对象弹「修改数据」。

**顺带发现（未修，记在这里）**：同一个覆写里「空心图形点边框才选中」那段是**死代码**——
它把 fabric 的 `{ target, subTargets }` 当成 target 传给了 `isHollowFill`，`o.type` 永远是 undefined。
本轮不动它，是因为 `ui-v88.cjs` 的多选断言就是点矩形**内部**完成的；到底原版点空心矩形内部算不算选中，
要真机取证后再说（复刻版当前行为：点内部即选中）。

---

## DIFF-53 打印对话框「打印后更新变量数据」默认被勾选（真机默认不勾选） → ✅ 已修（round-114，`ui-v123.cjs` 17/17）

**原版依据**：`parity/reference/labelshop/INDEX.md` 的 `63-dlg-print.png` 控件清单——`打印后更新变量数据(U)`（**未勾选**）。

**修复**：`App.tsx` 的打印高级选项默认值 `updateSerial: true` → `false`。

**回归**：`ui-v123.cjs`「254 设置含『打印后更新变量数据』复选框且默认不勾选、可切换」。

---

## DIFF-54 「关于」对话框是自造弹窗（没有版本行/产品ID/激活/官网/版权结构，版本号还写死 0.1.0） → ✅ 已修（round-115，`ui-v124.cjs` 10/10）

**原版依据**：真机「关于」对话框 `parity/reference/labelshop/66-dlg-about.png`（INDEX.md 同小节控件清单）：
> 程序图标 · `签赋 LabelShop [ 标准版 - 未激活 ]  (6.39.2511) 32位` · `产品ID: 未激活` · 按钮「激活」·
> 右侧二维码 + 「扫一扫下载 云马通APP」· 公司行 `京成云马（北京）科技有限公司` · 官网链接 `http://www.360Code.com` ·
> 分隔线 · 两行版权敬告 · 右下「确定」；
> 账户菜单另有 `账号和授权管理...` / `试用管理...`（未登录时均禁用）。

**修复前的复刻版**：`AboutDialog.tsx` 只是一个居中的 MaxLabel 品牌弹窗，写着**硬编码的「版本 0.1.0」**、
技术栈说明和「确定」——既没有真机的字段结构，版本号也与实际包版本脱节。

**修复**（`AboutDialog.tsx` + `ModalHost.tsx`）：
- 按真机骨架重做：图标 + `MaxLabel [ 标准版 - 未激活 ]  (真实版本) 64位` + `产品ID: …` + 「激活」按钮 +
  二维码（用内置码制 `qrcode` 生成，指向项目主页）+ 「MaxLabel 项目组」/ 项目地址 + 分隔线 + 版权敬告 + 「确定」；
- 版本号取自 `window.maxlabel.appVersion()`（真实包版本），激活状态取自 `license.status()`；
- 「激活」按钮切到既有的「授权与激活」对话框（`ModalHost` 传 `onActivate`）。

**回归**：`ui-v124.cjs` 三条断言（结构字段齐全、版本行格式 `(x.y.z)`、点「激活」进入授权对话框）。



---

## DIFF-50（原始观察记录 —— **本条已于 round-57 收口，见下方同名条目**）对象属性「常规」页的「水平/垂直」相对标签边对齐下拉：真机是灰的

> **结算更正（round-110 结算，2026-09-21）**：本条此前长期挂着「⏳ 待定」，与下方 round-57 的收口条目**自相矛盾**，
> 并导致 `tools/loop/round-focus.md` 的基线把 DIFF-50 误列为「未收口差异」。
> **实际状态 = ✅ 已修（round-57）**，实现为 `ObjectPropsDialog` 的 `alignOptionsAvailable`（非文字对象才给选项），
> 断言 `ui-v125.cjs`（文字 0 项且禁用 / 条码 4 项含占位且可用）。以下原始记录**保留备查**，不再作为待办。

**真机证据**（round-114，见 `parity/reference/labelshop/PROBE-round114.md`）：
「文字属性 → 常规」页里 `水平(H):` / `垂直(V):` 两个数值框可编辑，
但紧邻的 `水平(W):` / `垂直(T):` 两个下拉是 **DISABLED 且 0 项**——单选一个文字对象时如此，
`Ctrl+A` 选中两个对象后仍然如此（`probe-44-two-objects-tree.txt` / `probe-42-text-props-values.txt`）。

**复刻版现状**：这两个下拉可用（保持当前位置 / 靠左 / 水平居中 / 靠右；垂直同理），
依据是帮助 `label_object_page_general.html` 对「水平位置/垂直位置」的记载（B-52 的证据列）。

**当时为何搁置**（结论已由 round-57 补证推翻，见下方条目）：真机在本版本 + 本对象类型下不启用，
不能排除它对别的对象类型（图片/表格/条码）启用；贸然改成灰的会把帮助里明确记载的字段做没。
→ round-57 用条码对象证到**确实按对象类型启用**（条码 3 项、文字 0 项），据此按类型实现并收口。

## DIFF-50（已收口）对象属性「常规」页的「水平/垂直」相对标签边对齐下拉：按对象类型决定 → ✅ 已修（round-57）

**真机证据**（round-114 首证 + round-57 补证）：
- 文字对象：「文字属性 → 常规」的 `水平(W):` / `垂直(T):` 两个下拉 **DISABLED 且 0 项**（`probe-42-text-props-values.txt`，单选/全选都一样）；
- 条码对象：同样是这两个下拉，但**有 3 项**——`左齐/居中/右齐` 与 `顶部/居中/底部`，默认 `左齐`/`顶部`（`probe-45-barcode-props-p1.txt`，CB_GETCOUNT=3）。

**收口**：`ObjectPropsDialog` 增加 `alignOptionsAvailable`（`obj.type !== 'text'`）：为假时该下拉**不渲染任何选项且禁用**（与真机 CB_GETCOUNT=0 一致）；
选项文字同时按真机改为 `左齐/居中/右齐`、`顶部/居中/底部`。回归 `ui-v125.cjs` 两条断言（文字 0 项且禁用 / 条码 4 项含占位且可用）。

**仍未取证**：矩形/图片/表格 这三类对象上真机是否启用（复刻版按「非文字即启用」处理，与已确认的条码一致）。

---

## DIFF-55 码制下拉只有 18 项、名称无空格、缺 Pharmacode 与 Micro QR，顺序也与真机不同 → ✅ 已修（round-57，`ui-v125.cjs` 17/17）

**真机依据**：真机「条码属性 → 条码」页 `条码符号类型(码制)(&B)` 下拉 **20 项**（round-57 用 `Probe-LabelShopCombos.ps1` 的 CB_GETITEMCOUNT/CB_GETLBTEXT 逐项读回）：

```
Code 39 / Code 128 / EAN-13 / Interleaved 25 / Code 93 / UPC-A / EAN-8 / UPC-E / CodaBar /
Code 25 / Matrix 25 / China Post / Pharmacode / ITF 14 / GS1 RSS 条码 / PDF 417 / QR Code /
Data Matrix / 汉信码 / Micro QR
```

**修复前的复刻版**：18 项，名称去掉空格（`Code39`/`Code128`/`ITF14`…），顺序里 `UPC-E` 排在 `EAN-8` 前，
且**没有 Pharmacode 与 Micro QR**（前者的帮助页也没有，只有真机下拉能证明它存在）。

**修复**：`barcodeTypes.ts` 按真机的名称与顺序重写 20 项（新增 `pharmacode`、`microqrcode` 两个 bwip 码制）；
`barcodeCharset.ts` 为这两个码制补特性条目（并注明「帮助未单列该码制」）；
单测 `barcode-spec.test.ts` 增加「20 项名称+bcid 与真机逐项一致」的断言（原断言写死 18 项）。

**回归**：`ui-v125.cjs`「115 …20 项且名称/顺序同真机」+「新增码制 Pharmacode / Micro QR 能选中并渲染」。

---

## DIFF-56 对象属性「镜像」多出「水平+垂直镜像」一项（真机只有 3 项） → ✅ 已修（round-57，`ui-v125.cjs` 17/17）

**真机依据**：`镜像(&M)` 下拉 CB_GETCOUNT=3 —— `无 / 水平镜像 / 垂直镜像`（`probe-45-barcode-props-p1.txt`、`probe-42-text-props-values.txt`）。
**修复前的复刻版**：4 项（多一个「水平+垂直镜像」，`flipX && flipY`）。
**修复**：删掉该选项（模型仍保留 `flipX/flipY` 两个布尔，只是 UI 不再提供组合项）。

---

## DIFF-57 条码属性页缺「缩减量」字段 → ✅ 已修（round-59，`ui-v127.cjs` 5/5）

**原版依据**：真机 `.lsdx` 的条码元素带 `reduction` 属性（`C:\Users\liyan\Downloads\test.lsdx` 第 17 行
`<barcode ... reduction="0" .../>`，见 `parity/reference/labelshop/LABEL-FORMAT-SPEC.md`），说明原版有「缩减量」；
帮助 `barcode_summary.html` 未单列该字段。**真机属性页的入口形态本轮仍未读到**（EAN-13/UPC-A/EAN-8/UPC-E 四个码制的条码页
全量控件里都没有它，见 DIFF-60 的表）——但它对输出有明确意义（压低条码高度）。

**修复**：`BarcodeObj` 加 `reductionMm`（0–100 毫米，`document.ts` 归一化）；EAN/UPC 码制下条码页显示
「缩减量（毫米）」（`barcode-reduction`，其它码制不显示）；画布与打印统一走
`barcodeToDataURL(..., { reductionMm })`（`fabricObjects.ts` 透传，条码高度 = 对象高度 − 缩减量）。

**回归**：`ui-v127.cjs`「EAN-13 条码页有缩减量」「缩减量只在 EAN/UPC 码制下出现」。

**仍未定**：真机属性页到底把这个字段放在哪儿（本轮四个 EAN/UPC 码制下都没有）。若后续确认真机没有该入口，
复刻版这处属「比原版多给了一个入口」，可再议。


---

## DIFF-58 字体页「大小」是纯数字下拉、缺中文号数、缺「示例」预览 → ✅ 已修（round-57，`ui-v125.cjs` 17/17）

**真机依据**：真机「文字属性 → 字体」页 `大小(&P)` 下拉 **31 项**（round-57 逐项读回）：
`8,9,10,11,12,14,16,18,20,22,24,26,28,36,48,72, 初号(42),小初(36),一号(26),小一(24),二号(22),小二(18),三号(16),小三(15),
四号(14),小四(12),五号(10.5),小五(9),六号(8),小六(7),七号(5)`；
页底另有 `示例` 组（预览 + 「这是TRUETYPE字体，显示与打印完全相同!」）。
**修复**：`FONT_SIZE_OPTIONS` 按真机 31 项重建（value 仍是磅值，避免影响既有断言）；
字体样式首项文案改「正常体」（真机「字体样式(&Y)」4 项就是 正常体/粗体/斜体/粗斜体）；
删掉与「字体样式」重复的粗体/斜体按钮；补 `text-font-preview` 示例预览块。

---

## DIFF-59 条码页缺「码 高」「供人识读字符（位置/垂直偏移/对齐方式）」；条宽比只有 3 档 → ✅ 已修（round-57，`ui-v125.cjs` 17/17）

**真机依据**（round-57 读回）：
- `码  高(&H)`：数值框，默认 10.00 毫米；
- 供人识读字符 **位置**：4 项 `默认/无/条码上方/条码下方`（默认「条码下方」，CB_GETCURSEL=3）；
- 供人识读字符 **对齐方式**：4 项 `左齐/右齐/居中/撑满`（默认「居中」）；
- `垂直偏移(&O)`：默认 0.00 毫米；
- `条宽比(&W)`：7 档 `2.00/2.17/2.33/2.50/2.67/2.83/3.00`（Code 128 下不显示，CB_GETCOUNT=0）。

**修复**：条码页新增 `barcode-height`（绑定对象高度）、`barcode-human-position`（4 项，同步扩展模型联合类型
`humanPosition: 'default' | …`）、`barcode-human-offset`、`barcode-human-align`（4 项，`humanAlign` 增 `justify`）；
条宽比 3 档 → 7 档。回归 `ui-v125.cjs` 四条断言。

---

## DIFF-60（观察项，未收口）真机 EAN/UPC 条码页没有「附加条码」「校验字符」下拉，复刻版按帮助保留了 → ⏳ 待定

**真机证据**（round-58，`Probe-LabelShopSymbologyBatch.ps1` 把 20 个码制逐个切过去读全量控件）：

| 码制 | 真机「条码」页上的专属字段 |
| --- | --- |
| EAN-13 / UPC-A / EAN-8 / UPC-E | **只有 码制 / X 尺寸 / 码 高 / 供人识读字符(3 项) / 对齐方式(4 项)**——没有「附加条码」 |
| Code 93 | 无专属字段 |
| Interleaved 25 / Code 25 / Matrix 25 / China Post / Pharmacode | 只有「条宽比」7 档——**没有独立校验字符下拉** |
| Code 39 | 条宽比 7 档 + 校验字符 4 项 |
| CodaBar | 条宽比 + 校验字符 3 项 + 起始符 5 项 + 终止符 5 项 |

**复刻版现状**：按原版帮助（`barcode_summary.html` 的 EAN/UPC 附加码段落、25 码组「校验字符」段落）保留了这些字段。
**为什么先不改**：帮助是原版自带文档，且这些字段对输出有实际意义；清单里这几条也已按「帮助有 / 真机条码页未见」写进结论。
**下一步**：若确认原版把这些放在别的入口（例如「数据」页或高级选项），再决定搬位置还是删除。

---

## DIFF-61 条码码制专属字段的形态与真机不一致（ITF 14 保护框、二维码符号版本、供人识读位置项数、PDF 417 条宽比） → ✅ 已修（round-58，`ui-v126.cjs` 10/10）

**真机依据**（round-58 逐码制读回，见 `parity/reference/labelshop/probe-sym-*-values.txt` / `-combos.txt`）：

- **供人识读字符 · 位置**：Code 128 等 4 项（默认/无/条码上方/条码下方）；**EAN/UPC 族 3 项**（无「条码上方」）；
- **ITF 14**：「保护框(&R)」3 项（无/方框/保护条）、「粗细(&N)」15 档 1X–15X（默认 5X）、「空白区(&S)」15 档（默认 10X）；
- **PDF 417**：条宽比 9 档 `1 X…9 X`（默认 3 X）；
- **QR Code**：符号版本 41 项（自动 + 1 (21x21) … 40 (177x177)）、图标区域 31 项；
- **Data Matrix**：符号版本 31 项（自动 + 1 (10x10) … 30）；
- **Micro QR**：纠错 3 项（L/M/Q）、符号版本 5 项（自动 + M1…M4）、字符编码 2 项；
- **汉信码**：版本 **85 项**（自动 + 1…84）。

**修复**：位置下拉按码制给项（`EAN_UPC_SYMBOLOGIES`）；ITF 14 保护框改 3 项下拉 + 粗细/空白区改 15 档下拉
（模型加 `itf14BearerMode`，`itf14Bearer` 保留兼容）；PDF 417 条宽比按码制给 9 档；QR / Data Matrix / Micro QR 新增
「符号版本」下拉（模型加 `qrVersion` / `dmVersion` / `microQrVersion`，渲染侧 `barcode.ts` 透传 `version`）。

**已收口**：汉信码「版本」在复刻版原先只有 版本 1–4 四项，真机是 85 项（自动 + 1…84）——**round-59 已补到 85 项**（`hanxin-version` + `barcode.ts` 透传 `version`，ui-v127 断言）。

---

## DIFF-62（已收口）数据源取证暴露的五处小缺口 → 5 条全部有了结论

round-59 把「数据源」55 条逐条取证时，发现复刻版与真机/帮助的差异：

| # | 条目 | 现状 |
| --- | --- | --- |
| 1 | 序列号「序列」只读显示 | **已补**（`serial-sequence`，ui-v127） |
| 2 | 序列号「归位」 | 复刻版**一直有**（`resetEachRecord` + `datasource.ts` 按记录基准复位），本轮写进结论 |
| 3 | 共享变量名称「选择名称」 | **已补（round-60）**：真机是组合框（可下拉选已有共享名或手输），复刻版原来只有输入框。现给 `shared-source-name` 挂 `list="maxlabel-shared-names"` + `<datalist>`，名字来自 `ModalHost.sharedNamesOf(doc)`（扫描所有对象的主数据源与**对象级 `subSources`** 上已用过的 `sharedName`，去重排序）。回归 `ui-v128.cjs`；真机控件树证据见 `parity/reference/labelshop/probe-60-barcode-props-tree.txt`（变量共享名称(&N) 是 ComboBox 内含 Edit） |
| 4 | 截短「保留」的整数/小数部分 | **已补（round-60）**：帮助 `datasource_advanced_cut.html` 写明「也可以单独保留数字的整数或者小数部分（包含小数点）」，`text-cut-type` 增 `keepInt`=保留整数部分 / `keepDecimal`=保留小数部分（含小数点），语义在 `datasource.ts` 的 `applyCut`；`editor-operations.test.ts` 断言 `'12.34' → '12'` / `'.34'` |
| 5 | 序列号「边界值」 | **结案：原版无此控件（round-60）**。EXE 字符串资源（UTF-16LE）里「边界值」0 命中，而同一面板的「序列号/步长/归位/显示数据/初始值来源」等标题都能命中；帮助也未记载。取证方法与资源标题清单见 `parity/reference/labelshop/PROBE-round60.md` |

回归：`ui-v127.cjs`（序列号序列显示 + 汉信码版本 + 缩减量）、`ui-v128.cjs`（上述 3、4 两项）。

---

## DIFF-63（**已收口 round-117**）序列号面板的「重置初始值 / 立即重置」

### 收口处置（round-117）

**两份真机证据把问题定死了**：

1. `PROBE-verifier-round88-DIFF63-serial.md`：真机「序列号设置」里**只有一个** `重置` 按钮，
   控件树 `[V] class=Button DISABLED text='重置'` —— **可见但禁用**（`[V]`=可见）；没有「立即重置」。
   同对话框字段原文为 `类型(&T):` / `序列(&Q):` / `步长(&S):` / `重复(&E):` / `初始值来源(&R):`。
2. `PROBE-round104-DIFF63.md`：EXE 资源里的「重置初始值:」与「立即重置」在本机**全部可达状态**下都是
   **隐藏**控件（标准版 / 演示模式 / 记录数 / 标签数+归位 / 默认与键盘输入初始值 / 打印前后 / 保存前后
   / 设置共享变量名后），用户点不到；向隐藏按钮投递 `BM_CLICK` 不改变显示数据，不能作为用户可见语义。

**据此落地（口径与「应用(&A)」隐藏控件一致：可见的还原、隐藏的不落地）**：

| 项 | 真机 | 复刻版 round-117 |
| --- | --- | --- |
| `重置` 按钮 | **有且仅一个，可见，恒禁用** | 补上**单一** `重置`（`data-testid="serial-reset"`），**渲染为 disabled**，无行为 |
| 「立即重置」/「重置初始值:」 | 有控件、**隐藏**、无用户可达路径 | **不落地**（不渲染，也不隐藏着放） |
| 序列号区字段名 | `类型(&T):` / `序列(&Q):` / `步长(&S):` / `重复(&E):` / `初始值来源(&R):` | 逐字对齐（原先这五项**都没有加速键**） |

- 「重置」的**启用条件仍未取证**（真机在 `初始值来源`＝`默认` 与＝`键盘输入` 两态下都禁用）
  → 复刻版**保持禁用**，**不猜**一个启用条件、不编造一个点击行为（`PROBE-verifier-round88-DIFF63-serial.md` 第三节第 2 条）。
- 复刻版**此前既没有「重置」也没有「立即重置」**（全库 grep 0 命中）——即验收方队列里
  「复刻版若有两个按钮则合并成一个」的前提**不成立**，本轮做的是「把真机那个可见的 `重置` 补上并保持禁用」。
- 复刻版把序列号设置**内联**在「数据源」页（真机放在「高级选项」对话框里），是既有的结构差异，
  登记为复刻版版式差异（规则/取值语义与真机一致）；`重置` 按真机在 `初始值来源` 之后的相对顺序内联放置。

断言：`app/scripts/ui-v132.cjs`（5/5，已注册进 `run-regression.ps1`）——
整数组全等的字段名断言（含加速键）、`重置` 唯一且可见、`重置` 禁用、点它不改变「显示数据」、
对话框内不出现「立即重置」「重置初始值」。

---

## DIFF-63（原登记正文，保留作证据链）序列号面板的「重置初始值 / 立即重置」

round-60 用 EXE 字符串资源取证 DIFF-62 第 5 条时，在数据源页同一资源块里发现真机序列号面板另有
「重置初始值:」与「立即重置」两处字样（顺序上紧跟「初始值来源(&R):」「数据库连接(&D):」之后）。
帮助 `datasource_type_serial.html` 未记载这两项，真机序列号子面板又是选择时才动态创建
（工装切源后页面不重排，见 `PROBE-round60.md` 2.4），所以语义未定：

- 猜测 A：「重置初始值」＝归位时回到的那个值（复刻版已有 `序列起始值`，语义等价），「立即重置」＝点一下把显示数据立刻写回该值；
- 猜测 B：「重置初始值」是一个复选框，勾选即开启归位；「立即重置」是给外部（脚本/打印中）调用的一次性复位动作。

round-104 已用真实鼠标/键盘路径进入「高级选项 → 序列号」，完整控件和默认值见
`PROBE-round104-DIFF63.md`、`probe-63-13-serial-advanced.png`。结论三态为：**原版有但受限**。

- 标准版把“标签数”变化基准拦截为专业版/企业版功能；进入专业版演示模式后可显示并使用“归位”。
- 控件树确有两个“重置初始值:”标签和“立即重置”按钮，但在标准版、专业版演示模式、记录数、标签数+归位、默认/键盘输入初始值、打印推进前后、保存前后、设置共享变量名后均保持隐藏。
- 勾选“打印后更新变量数据”实际打印 1 份后，主数据源页“显示数据”从 `12345678` 推进到 `12345679`（`probe-63-34-after-print-display.png`、`probe-63-after-print-values.txt`）；此时重置组仍为空。
- 向隐藏按钮投递一次 `BM_CLICK` 不改变显示数据，不能作为用户可见语义证据。

复刻版继续保持现状：`序列起始值` 覆盖取值语义，`resetEachRecord` 覆盖真机已证实的“标签数 + 归位”；
不增加不可达的“立即重置”入口。下一步需取得能让真机重置分组显示的已配置模板，或连接数据库后再点按确认。

---

## DIFF-64 对象属性对话框的**页签名称与顺序**与真机不一致，且条码多出一个「码制专页」 → ✅ 已修（round-111）

### 处置（round-111 逐条落地，key 不变、只改显示名与顺序）

`propertyTabs.ts:propertyTabsFor()` 现在按真机取证表返回（`symbology` 参数与 `BARCODE_LABELS` 映射一并删除，
它们只为那张已被证伪的「码制专页」服务）：

| 对象 | 落地后的 keys | 落地后的 labels（真机原文） |
| --- | --- | --- |
| 文字 | `datasource, font, text, general` | 数据源 / 字体 / 文本 / 常规 |
| 条码 | `datasource, barcode, font, general`（**4 页，码制专页已并掉**） | 数据源 / 条码 / 字体 / 常规 |
| 矩形·椭圆·直线 | `shape, general` | 图形 / 常规 |
| 表格 | `table, general` | 表格 / 常规 |
| 图片 | `image, general` | 图片 / 常规 |
| RFID | 复用**原版既有形态**，未动（真机无创建入口，见 DIFF-65） | 通用 / RFID / 数据 |

- **码制专页并入「条码」页**：`ObjectPropsDialog.tsx` 删掉 `tab === 'barcodeSpecial'` 的三处条件分支，
  把随码制变化的字段渲染成一个 `<fieldset data-testid="barcodeSpecial">`，legend 用真机原文 **`条码特殊选项`**；
  页首仍是 `条码符号类型(码制)` 下拉（原来的「码制」label 同步改名），页尾仍是颜色 —— 与 `verifier-20c-barcode-page.png` 的分区一致。
- **删掉了已被实拍证伪的注释**「通用页永远置于首位」，换成真机规律（对象专属页在前、公共页在后、末页叫「常规」）。
- 保留 `barcodeSpecial` 这个 **key** 仅为兼容 `PropertyTabKey` 类型；它**不再是页签**，只作分组锚点。

### 断言迁移（强度不降，改为真机口径）

| 文件 | 改动 |
| --- | --- |
| `app/scripts/ui-v56.cjs` | 文字页签断言改成逐项 `['数据源','字体','文本','常规']`；原来「码制专页名 === Code128」改成**两段强断言**：「条码页签 === 四页数组」+「`barcodeSpecial` 分组内同时含 条码特殊选项/字符集/GS1/EAN-128」；码制下拉改用 `[data-testid=barcode-symbology]`（不再靠 DOM 层级遍历）；ECC200 断言收窄到分组内 |
| `app/scripts/ui-v57.cjs` | 文字页签逐项数组同上 |
| `app/scripts/ui-v109.cjs` | 条码属性页签由「首项=通用 且 含条码/数据」改成**逐项相等** `['数据源','条码','字体','常规']` |
| `app/scripts/ui-v117.cjs` | 图片属性找 `通用` 页签改成找 `常规`（真机口径） |
| `app/scripts/ui-v106.cjs` | `openTab('barcodeSpecial')` → 内部改点「条码」页（15 处调用点不动），分组锚点保留 |
| `app/scripts/ui-v125.cjs` | 「码制专属选项页含字符集」改成「条码页的 `barcodeSpecial` 分组含字符集」 |
| `app/scripts/ui-v126.cjs` / `ui-v127.cjs` | `openSpecial()` / 汉信码版本页改点「条码」页 |

`app/scripts/barcode-spec.test.ts` 的 17 处 `barcodeSpecialOptions` 是**共享函数**（`shared/domain/barcodeCharset.ts`），
不是页签 key，**无需改动**（此前台账估计的「约 20 处要迁」是误判，实测 grep 后确认与页签无关）。

### 证据

- 回归实测（本轮逐个单跑，全绿）：`ui-v56` **11/11**、`ui-v57` 8/8、`ui-v106` **33/33**、`ui-v109` 21/21、
  `ui-v117` 11/11、`ui-v125` 17/17、`ui-v126` 10/10、`ui-v127` 5/5、`ui-v102` 27/27。
- 真机依据截图（**未改动**）：`probe-63-06-serial-page.png`、`verifier-10-barcode-props.png`、`verifier-11-rect-props.png`、
  `verifier-12-table-props.png`、`verifier-31-image-props.png`、`verifier-20c-barcode-page.png`。

### 仍未取证（本轮不动）

- RFID 对象的页签仍按复刻版既有形态（真机无 RFID 创建入口 → DIFF-65 未收口，不凭猜测改）。

---

## DIFF-64-original（历史记录，保留备查）对象属性对话框的页签名称与顺序与真机不一致

**验收方 round-5 独立取证**（截图与完整表格见 `parity/reference/labelshop/PROBE-verifier-object-tabs.md`）：

| 对象 | 真机页签（左→右） | 复刻版（`propertyTabs.ts`） |
| --- | --- | --- |
| 文字 | 数据源 / 字体 / 文本 / 常规 | 通用 / 文字 / 字体 / 数据 |
| 条码 | 数据源 / 条码 / 字体 / 常规（4 页） | 通用 / 条码 / 字体 / 数据 / `<码制>`（5 页） |
| 矩形·椭圆·直线 | 图形 / 常规 | 通用 / 方框和圆形（直线为 直线和斜线） |
| 表格 | 表格 / 常规 | 通用 / 表格 |
| 图片 | 图片 / 常规 | 通用 / 图片 / 数据（`propertyTabs.ts`；证据：`verifier-31-image-props.png`） |

差异：① 最后一页真机叫 **`常规`**，复刻版叫 `通用`；② 真机是**对象专属页在前、常规在最后**，复刻版把 `通用` 放首位；
③ `文本`（真机）vs `文字`、`数据源`（真机）vs `数据`；④ 真机图形对象页签名是 **`图形`**，不是帮助页标题里的「方框和圆形」；
⑤ **条码属性真机只有 4 个页签，码制选择器与"随码制变化的专属字段"都在「条码」页内**（round-6 追加取证
`verifier-20c-barcode-page.png`）：页首 `条码符号类型(码制)(B)` 下拉 → `尺寸`（X 尺寸 mil / 码高 毫米）→
`条码特殊选项`（内容随码制变化，如 Code 128 下是 `GS1/EAN 128` + `字符集`）→ `供人识读字符`（位置/垂直偏移/对齐方式/字符模板）→ `颜色`。
复刻版把码制拆成第 5 个页签，属结构性偏差。

要求：按上表改显示名与顺序（key 可保留英文）；**把条码码制专页合并回「条码」页**——页首放码制下拉、
码制专属字段放进「条码特殊选项」分组、页尾放颜色，页签数回到 4；补「页签文字与顺序逐项相等」的 CDP 断言；
更新 matrix 涉及页签的条目证据，并删掉 `propertyTabs.ts` 里已被实拍证伪的「通用页永远置于首位」注释。

---

## DIFF-65（**round-133 收口：已修**）真机「工具(T)」菜单没有 RFID 工具，且「数据(D)」在「表格(G)」之前

### 三态结论

- **原版无**：真机「工具(T)」菜单**没有 RFID 项**——**双重证据**：
  ① 真机 exe `LabelShop.exe` 的**菜单资源字符串表**（UTF-16LE，偏移 ~17400000）里 `工具(&T)` 段逐字为
  `选取(&S) | 条码(&B) | 文字(&T) | 线条(&L) | 斜线(&L) | 矩形(&R) | 图片(&P) | **数据(&D)** | **表格(&G)** |
   放大(&I) | 缩小(&O) | 适应宽度 | 适应高度 | 适合窗口(&W)` —— 九项对象工具 + 五项显示命令，**段内无 RFID**；
  ② 真机弹菜单实拍 `parity/reference/labelshop/r162-menu-03-tool.png`（并排图 `parity/review/cmp-menu-tool-r162.png` 左半）逐项一致。
  **同时暴露第二处差异**：真机是 `图片(P) → 数据(D) → 表格(G)`，复刻版原先按帮助 `menu_tools.html` 写成「表格」在前 ✗。
- **原版有（但无创建入口）**：RFID 读写在真机是**存在的功能**——exe 字符串资源含
  `此版本最多只能一次性打印不超过3张RFID标签。如需打印更多标签，请购买软件授权！`、
  `Read RFID and print`、`RFID 标签读写`、`RFID 高级打印日志`；帮助亦有 `label_object_rfid.html`。
  即：**功能在、工具菜单入口不在**（本机未接 RFID 读写器；与「选项(O) → 电子称」同款的按硬件条件显示，见 DIFF-81）。
- **原版有但受限（帮助与真机冲突）**：帮助 `menu_tools.html` 把 RFID 排在对象工具组内且「表格」在「数据」之前，
  与真机**都不符** → 按优先级规则（真机 > 帮助）以真机为准。

### 处置（不静默删功能）

- `labelShopMenus.ts` 的 `工具(T)` 段：**移除 `RFID` 菜单项**，并把 `数据(D)` 提到 `表格(G)` 之前，与真机逐项全等。
- **RFID 能力未丢**：对象类型 / 属性页（`object-props-tab-rfid`）/ 图层 / 打印链路全部保留，
  创建入口仍在主工具栏的 RFID 按钮（`Toolbar.tsx` `OBJECT_TOOLS`，`data-tool="rfid"`）。
- 复刻版**工具栏** `数据`/`表格` 两个按钮的相对顺序**未动**：真机工具栏按钮顺序没有直接证据（exe 里没有
  `选择工具：` 这类 tooltip 串），只对菜单下了结论，不凭推理改工具栏。

### 证据与断言

- 真机：`parity/reference/labelshop/r162-menu-03-tool.png`；并排图 `parity/review/cmp-menu-tool-r162.png`。
- 断言：`app/scripts/ui-v138.cjs` **11/11**（工具菜单与真机菜单资源逐项全等 / 不含 RFID / 数据在表格之前 /
  工具栏 RFID 按钮仍在）；`app/scripts/ui-v52.cjs` **67/67**、`app/scripts/ui-v105.cjs` **14/14**（顺序断言迁移为真机口径，强度不降）。
  命令：`MAXLABEL_UI_SCRIPT=ui-v138.cjs npm run test:ui`。

---

## DIFF-66（round-105 P0）「选择标签格式」自定义入口与圆角规则 → ✅ 已修

### 真机结论三态

- **原版有**：底部独立按钮「自定义(N)」，点击后打开标题为「标签格式设置」的四页签对话框（打印机 / 页面 / 标签 / 其它），确定后直接回到新标签编辑器。
- **原版无**：标签名称(L)下拉不含「自定义」项；round-105 在平张目录枚举到 42 项，完整控件树见 `parity/reference/labelshop/probe-round105-choose-label-tree.txt`。
- **原版有但受限**：圆角矩形没有可编辑的圆角半径字段；编辑器 261% 截图量得约 0.9–1.0mm 固定弧半径，预览量测见 `PROBE-verifier-corner-radius.md` 的约 0.9–1.1mm 结论。

### 复刻修复

- `NewLabelDialog.tsx` 移除名称下拉中的「自定义」，底部按钮打开 `CustomLabelFormatDialog.tsx`；初始值与 `[608053]` 一致（100×70、2mm/2mm、2列×4行、圆角矩形、无孔洞），确认后创建自定义文档。
- `paper.ts` 新增唯一默认半径函数 `roundRectRadiusMm()`，默认固定 1mm；`paperPath()`、编辑器 clipPath、预览 SVG、打印/位图裁剪共用该规则。保留显式半径仅用于旧模板/显式渲染回归兼容，UI 不再显示输入框。
- `PaperFields.tsx` 删除真机不存在的「圆角半径」输入。
- 直角矩形=0、圆形=宽高两个直径、圆形带孔追加孔洞直径均由同一 `paperPath()` 规则覆盖。

### 证据与回归

- 真机：`round105-choose-label.png`、`probe-round105-choose-label-tree.txt`、`round105-custom-label.png`、`probe-round105-custom-label-tree.txt`、`round105-after-custom.png`、`PROBE-round105-custom-label.md`。
- 复刻：`app/scripts/ui-v129.cjs` **12/12**（已注册 `run-regression.ps1`）；`render-regression` 新增共享路径、四形状与默认圆角位图断言。

### round-106 追加项（核心已修；同一对话框其余项本轮收口）

- **原版有**：标签页五个分组框「标签 / 间距 / 行列 / 形状 / 孔洞」；孔洞下拉三项「无 / 圆洞 / 矩形」；预览行 `100.00 x 70.00 毫米 [4行 2列]`；底部「应用(A)」按钮存在但禁用；打印机页有「标准驱动(S) / 设置(S) / 高级设置(A) / 安装(I) / 整页反相打印 / 镜像输出 / 单页任务模式」。
- **原版有但受限**：「多行标签」按钮在标签页控件树中存在但不可见，本轮只记录证据，不按猜测添加显示条件或行为。
- **复刻对齐**：`CustomLabelFormatDialog.tsx` 与 `TemplatePropsDialog.tsx` 使用五分组；孔洞三项、预览行、打印机页控件已实现；「标签纸颜色」移至页面页；`PaperFields.tsx` 不再在标签页显示颜色。
- **证据**：真机 `PROBE-round106-custom-label.md`、`probe-round106-custom-label-tree.txt`、`probe-round106-custom-label-combos.txt`、`round106-custom-label-dialog.png`、`round106-after-custom.png`；复刻 `app/scripts/ui-v129.cjs` **17/17**、`ui-v130.cjs` **8/8**、`ui-v104.cjs` **14/14**、`ui-v117.cjs` **11/11**。

### round-107 更正与收口（`孔洞=矩形` 半实现 + `应用` 按钮形态）

- **原版有**：`孔洞 = 矩形` 时**有且只有一个**尺寸框，单位 `毫米`；切到「矩形」后该框由 DISABLED 变 enabled 且自动填 `0.00`（`probe-round107b-hole-rect-tree.txt`、`probe-round107b-hole-rect-values.txt`）。
- **原版有但受限（更正 round-106 的记账）**：底部 `应用(&A)` 在真机控件树里是 `[ ]`（**不可见**）而不仅是禁用；`r107b-hole-rect-zero.png` 底排只有 `确定/取消/帮助`。round-106 记的"存在但禁用"不准确，复刻版此前多画了一个真机没有的灰按钮 → 本轮改为 `hidden`。
- **原版有但取不到像素证据**：`矩形` 孔在**对话框预览**与**编辑器画布**上都不渲染（`r107b-hole-rect-zero.png` 与 `r107b-hole-rect-20.png` 逐像素一致；`r107b-editor-rect-hole.png` 无孔）；帮助 `label_page_label.html` 只写「孔洞位于标签的中心」，并注明「标签的形状/孔洞只在编辑标签时显示，并不会实际输出」。已试手法（WM_SETTEXT+EN_CHANGE、20mm 注入、确定后看画布）均无果，见 `PROBE-round107b-hole-rect.md`。
  → 复刻按**已确证**的"单一尺寸框 + 单一毫米值"实现为 **居中正方形、边长 = 输入值(mm)**；圆洞仍为"直径 = 输入值"。这是唯一一处推断，已在 `PROBE-round107b-hole-rect.md` 标为待取证细节，日后取到真机像素只需改 `paper.ts:paperPath()` 一处。
- **复刻修复**：`paper.ts` 加 `innerShape?: 'circle' | 'rectangle'`，`paperPath()` 分叉出直线矩形切孔（其余 7 处绘制/裁剪点均只经 `paperPath()`，未传 `innerShape` 即保持历史圆洞语义，未新增第二份几何）；`CustomLabelFormatDialog.tsx` 的尺寸框启用规则由 `hole !== 'circle'` 改为 `hole === 'none'`，几何按 `hole` 写 `innerShape`；`NewLabelDialog.tsx` 无孔格式的 `holeSize` 兜底 `15 → 0`。
- **证据**：真机 `PROBE-round107b-hole-rect.md`、`probe-round107b-hole-rect-combos.txt`、`probe-round107b-hole-rect-tree.txt`、`probe-round107b-hole-rect-values.txt`、`r107b-hole-rect-zero.png`、`r107b-hole-rect-20.png`、`r107b-editor-rect-hole.png`；复刻 `app/scripts/ui-v130.cjs` **14/14**（含"矩形切孔逐字等于 `M 45 30 H 55 V 40 H 45 Z`"）、验收方工装 `tools/parity/Verify-LabelFormatDialog.cjs` **16/16**。

---

## DIFF-67（round-108 新登记）帮助与真机 UI 用词不一致：第一档形状「直角矩形」vs「方角矩形」→ ✅ 以真机 UI 为准

### 真机结论三态

- **原版有**：真机「标签格式设置 → 标签 → 形状」下拉共 3 项，逐项原文为 **`方角矩形` / `圆角矩形` / `圆形`**，第 2 项是 `圆角矩形`（`probe-round106-custom-label-combos.txt`，验收方已核对原文）。
- **原版有（帮助文案不同）**：帮助 `app/docs/labelshop-help-zh/label_page_label.html` 把第一档写作 **`直角矩形`**。同一功能两处用词不一致；本仓库依据优先级「真机截图 > 帮助」，取 **`方角矩形`**。
- **原版无**：不存在第四档形状。

### 复刻处置

- `PaperFields.tsx`（`template-label-shape`）与 `CustomLabelFormatDialog.tsx`（`custom-label-shape`）的形状下拉首项已改为 `方角矩形`，并有值级断言 `app/scripts/ui-v130.cjs` 钉住下拉**逐项文本**（不是只断项数）。
- 源码注释原本写「帮助 label_page_label.html 的形状只有直角矩形…」，会让人误以为界面也该叫直角矩形 —— 已改成注明「帮助 vs 真机用词差异，以真机 UI 为准」。

### 仍未取证、本轮**不动**的一处（先取证再改，不许凭一处的证据改另一个对话框）

- ~~`app/src/renderer/src/dialogs/OptionsDialog.tsx:266`（「系统选项」里的形状下拉）当前仍写 `直角矩形`。~~
  **round-112 已取证并结清**：真机 `选项(O) → 系统选项(C)...` 打开的「系统设置」对话框**根本没有形状下拉**
  （四个页签逐页拍全，见 `PROBE-round112-sysset.md`）。所以这里**不是改名问题**——那个下拉所在的
  「标签」页在真机无对应物，整体移交 **DIFF-71** 收口（本轮已把标题/页签名/常规页分组框/字段名按真机对齐，
  见该条）。`OptionsDialog.tsx` 的 `直角矩形` 文案**保持原样**，等 DIFF-71 决定该页存废时一并处理。

---

## DIFF-68（round-108 登记；**round-121 已取证收口**）「标签格式设置 → 打印机」页三个开关的**控件形态**（按钮 vs 复选框）

> ### round-121 取证结论：**原版有，形态 = 复选框**（复刻版实现正确，无需改动）
>
> - 真机沿既定配方进「标签格式设置 → 打印机」页（冷启动 → 模板向导 → 新建标签模板 → 下一步 → 选择标签格式 → `自定义(N)`）。
> - `整页反相打印` 点击前后逐像素对照（同一裁剪框，放大 2 倍）：
>   `parity/reference/labelshop/r121-prn-switches-before.png`（**☐ 未勾选**）→
>   `r121-prn-switches-after.png`（**☑ 已勾选**）。点击后**状态保持、未弹出任何新窗口**（`dialoglist` 只有 `标签格式设置` 本身）。
> - 控件的**渲染形态**是「方框 + 文字」，而 `BS_PUSHLIKE` 的复选按钮会画成下凹的按钮面、不会画方框 —— 故判定为
>   **`BS_AUTOCHECKBOX`（复选框）**，与复刻版 `<input type="checkbox">` 一致。
> - 同页 `单页任务模式` 同形（同两张图右侧）；`镜像输出` 在本机（页式打印机）为**不可见控件**（dump 行首 `[ ]`），
>   与 `PROBE-round112.md` 的记录一致。
> - 全页控件树：`parity/reference/labelshop/r121-lfs-printer-page.txt`（另两页 `r121-lfs-default-page.txt`（标签页）、
>   `r121-lfs-after-ctrltab.txt`（其它页））。
> - 结论：**不修改**复刻版的控件形态与禁用规则（原判待取证，现已取证）。



### 已知的真机证据（`parity/reference/labelshop/probe-round105-custom-label-tree.txt` 原文）

```
[ ] class=Static  enabled text='名称(&N):'      xy=(816,970)  wh=(91x24)
[ ] class=Button  enabled text='标准驱动(&S)'    xy=(1454,1033) wh=(165x30)
[ ] class=Button  enabled text='高级设置(&A)'    xy=(1602,1021) wh=(154x45)
[ ] class=Static  enabled text='输出方式:'        xy=(816,1036) wh=(102x24)
[ ] class=Button  enabled text='安装(&I)'        xy=(1613,958) wh=(143x45)
[ ] class=Button  enabled text='整页反相打印'      xy=(928,1084) wh=(294x30)
[ ] class=Button  enabled text='镜像输出'         xy=(1250,1084) wh=(237x30)
[ ] class=Button  enabled text='单页任务模式'      xy=(1520,1084) wh=(228x30)
```

- **已确证**：真机这 8 个控件的**文案与存在性**（复刻版已按此实现：`名称(N):` / `标准驱动(S)` / `设置(S)` / `高级设置(A)` / `安装(I)` / `输出方式:` / `整页反相打印` / `镜像输出` / `单页任务模式`，见 `CustomLabelFormatDialog.tsx` 的 `custom-label-printer-page`）。
- **历史待取证记录已被上面的 round-121 证据覆盖**：此前仅凭 `class=Button` 无法区分形态；本轮实拍已经证明点击后保持勾选且不弹窗，因此不再按“待取证”处理，也不新增假行为。

---

## DIFF-69（round-109 新登记并已修）「孔洞 = 矩形」曾是**假功能**：只有对话框自己的预览认它

### 现象（round-109 逐行核对在途源码所得）

真机「孔洞」是三项下拉 `无 / 圆洞 / 矩形`（`probe-round106-custom-label-combos.txt`）。round-107b 把「矩形」
加进了下拉、也把矩形切孔实现进了 `shared/domain/paper.ts:paperPath()`，但**孔形 `innerShape` 走不出对话框**：

| 断点 | 现场 | 后果 |
| --- | --- | --- |
| 工具栏「标签格式设置」（`PaperFields.tsx`，两个入口共用） | 选中态用 `holeMm > 0 ? 'circle' : 'none'` **反查**，`onChange` 只写 `innerDiameterMm` | 选「矩形」**立刻回弹成「圆洞」**，几何被写成圆孔 —— 用户根本选不中矩形 |
| `shared/domain/document.ts` 归一化 | 白名单只留 `innerDiameterMm`，`innerShape` 被丢弃 | 存盘/打开后退化成圆孔 |
| `shared/print/scene.ts`（3 个场景构造器） | `paperGeometry` 字面量只传 `shape/cornerRadiusMm/innerDiameterMm` | 打印场景与位图输出仍是圆孔（`TS` 不报错，因为是可选字段） |
| `renderer/editor/LabelEditor.tsx` 裁剪路径 | `paperGeometry` 同样漏传 `innerShape` | 编辑器裁的是圆孔 |

即：**对话框预览画方孔、编辑器与打印出圆孔**。round-107b 的 `ui-v130` 断言只覆盖了对话框预览那条路径，所以没抓住。

### 处置（已修，单一来源）

- 新增 `app/src/renderer/src/dialogs/paperHoleFields.ts`：`PAPER_SHAPE_OPTIONS` / `PAPER_HOLE_OPTIONS`（真机逐字原文）
  与 `holeSelectionOf` / `withHoleSelection` / `withHoleSize` / `maxHoleSizeMm` —— 两个入口（新建标签→自定义(N) 与
  工具栏标签格式设置）**共用同一套选项文本与几何映射**，改一处即两处生效。
- `innerShape` 补进 `LabelDoc['layout']` 与归一化白名单，并由 `print/scene.ts` 三个构造器转发到 `ResolvedPrintScene`
  （打印/位图输出与编辑器从此读同一份几何，符合 `app/docs/architecture.md` 的共用场景约束）。
- `PaperFields` 孔洞下拉改为可表达三项；尺寸框按真机规则「选『无』时禁用、其余启用」（`probe-round107-hole-rect-tree.txt`）。
- **切孔形会把尺寸复位成 0**：真机切到「矩形」后尺寸框显示 `0.00`（`probe-round107-hole-rect-values.txt`），
  故切到「圆洞」同样复位（一致性选择；真机该侧无独立证据，登记在此）。

### 证据

- `npm run test:render` 60→**64** 条：`rectangle hole shape survives save/open normalization`、
  `print scene forwards the rectangle hole shape to output`、
  `renderLabel clips the rectangle hole as a centred square`、
  `circle hole leaves the square corner printed (rect and circle holes differ)`（最后一条用同一坐标 (380,380)
  在方孔下是白、圆孔下是黑，逐点区分两种孔形）。
- `app/scripts/ui-v131.cjs`（已注册 `scripts/run-regression.ps1`）**16/16**：两入口选项文本逐字相同、
  工具栏选「矩形」不回落、矩形预览逐字 `M 40 25 H 60 V 45 H 40 Z`、圆洞预览 `A 10 10`、
  选「无」尺寸框禁用且不画切孔、确定后编辑器裁剪路径带矩形孔。
- 回归复跑：`ui-v104` 15/15、`ui-v90` 14/14、`ui-v129` 17/17、`ui-v130` 14/14（改动波及的四个脚本全绿）。

---

## DIFF-70（round-110 新登记，**待取证**）P0 追加 6 的最后一步：真机**打印输出**里有没有孔 —— 打印链路已打通，但产出是**空白页**，问题仍未回答

对照的是帮助 `label_page_label.html` 的原文「标签的形状与孔洞**只在编辑标签时显示，并不会实际输出**」。
round-44 已证真机在**对话框预览**与**编辑器画布**里**都画孔**（`verifier-r44-hole-circle-20b.png`、`verifier-r44-editor-hole20.png`），
唯独"打印输出"这一条一直没验。本轮把它推到了"拿到打印产物"这一步。

### 已做到（配方可复跑，工装已入库）

真机 100×70 标签、`形状=圆角矩形 / 孔洞=圆洞 / 尺寸=20`（`Read-LabelShopDialogValues` 回读确认 `value='20'`，
高度仍 70.00）→ 编辑器画布中心画出 20mm 的孔 → 点右侧打印面板「打印」(主窗口坐标 2466,655) →
出现真机「打印」对话框 → 打印到 **Microsoft Print to PDF** → 在「另存打印输出为」里注入文件名并保存。

- 步骤文件：`tools/parity/steps/probe-r110-hole-{a,b}.txt`、`probe-r110-print-{a,c,d,e,f}.txt`
- 新工装：`tools/parity/Set-LabelShopField.ps1`（现代 Common Item Dialog 的 `WM_SETTEXT` + `BM_CLICK` 注入；
  含三条踩坑注释，主要一条是 **`keydlg`/SendKeys 打不进现代文件对话框、UIA 也枚举不到它**）
- 证据：`parity/reference/labelshop/PROBE-round110-hole-print.md`、`probe-r110-*.png`、`r110-hole-print.pdf`

### 为什么**没有**收口（不许据此说"输出不画孔"）

`r110-hole-print.pdf`（835 字节）经解压逐算子核对：单页、`MediaBox = 595.32 x 841.92`（**A4**，不是 100×70mm）、
`/Resources` 是**空字典**、**无 XObject**、内容流**只有一条 CTM 没有任何绘制算子**。
→ **整页是空白的**，连标签轮廓都没有，**孔在不在无从判断**。这是一个**独立的打印链路问题**，不是画孔证据。

### round-119 复核：仍为“原版有但受限”，未改变结论

本轮按现有工装重新走了 `孔洞=圆洞 / 尺寸=20` → 编辑器 → 右侧“打印”→ 保存 PDF 的链路。点击“打印”首先出现“登录 LabelShop”；未输入账号密码，仅点击“取消”后进入“将打印输出另存为”，保存到 `round119-hole-print.pdf`。

该 PDF 经 PyMuPDF 核验仍是 1 页 A4（`595.32×841.92 pt`）、`drawings=0`、`images=0`、文本为空，渲染为纯白页。新证据：`parity/reference/labelshop/PROBE-round119-DIFF70.md`、`round119-print-dialog.png`、`round119-preview-try.png`、`round119-hole-print.pdf`、`round119-editor-hole20.png`。因此本条继续保持 **⏳ 待取证**，没有把空白产物误判为“打印输出不画孔”。

### 下一步（下轮直接从这里接）

1. 先在编辑器放一个**明显的大对象**（整张贴满的矩形）再打印，确认 PDF 非空；仍空则先修打印链路。若登录限制仍出现，先记录“原版有但受限：需登录”，不要猜孔的打印语义。
2. 查真机「打印」对话框里的纸张/输出方式：文档 100×70mm 而产出 A4 → 页面尺寸没跟着标签走，很可能就是空白成因。
3. 备选：确认编辑态禁用的「文件 → 导出打印机指令文件(E)」的启用条件，或换 XPS Document Writer 对比。
4. 拿到**非空**输出后才判定孔的存废，结论回填本条与 matrix 的 A-227 / C-* 证据。

**状态**：⏳ 待取证（打印链路已打通到产文件；只差"非空输出"这一步）。

---

## DIFF-71（round-112 新登记；**结构部分 ✅ 已修（round-114 + round-116，`app/scripts/ui-v103.cjs` 19/19；`app/src/renderer/src/dialogs/OptionsDialog.tsx` L223-236 四页签 = `常规/打印和数据库/编辑/系统`）**；页内字段仍有未收口项，见文末「仍未收口」）「系统选项」对话框与真机「系统设置」的**页签结构与页内容**不一致 —— 原登记：真机 4 页，复刻版 3 页且其中一个页在真机无对应物

### 真机结论三态（证据 `PROBE-round112-sysset.md`，四页全拍）

- **原版有**：`选项(O) → 系统选项(C)...` 打开的窗口标题是 **`系统设置`**，四个页签左→右为
  **`常规` / `打印和数据库` / `编辑` / `系统`**；底部按钮 `确定` / `取消` / `帮助`（`应用(&A)` 是**隐藏**控件）。
  每页由分组框构成，字段原文见 `PROBE-round112-sysset.md` 第四节。
- **原版无**：
  - 常规页**没有**「外观形状」下拉，也**没有**「默认标签尺寸 / 排列 / 行列间隔」——这三样只存在于
    「标签格式设置」（`TemplatePropsDialog` / `CustomLabelFormatDialog`）。
  - `系统设置` 里也没有复刻版的「云服务器地址」（那是复刻版自有扩展）。
- **原版有但复刻版缺**：常规页的 `启动时运行模板向导`（复刻版原先放在「打印参数」页）、
  常规页四个分组框、`打印和数据库` / `编辑` / `系统` 三页的全部内容。

### 本轮已收口的部分（`app/src/renderer/src/dialogs/OptionsDialog.tsx`）

| 项 | 处置 |
| --- | --- |
| 窗口标题 | `系统选项` → **`系统设置`**（真机原文；菜单项仍叫「系统选项(C)...」，两者在真机本就不一致） |
| 页签名 | `通用` → **`常规`**；`打印参数` → **`打印和数据库`** |
| 常规页结构 | 按真机补 **`语言` / `单位` / `非打印对象` / `其它` 四个分组框**；字段文案改真机原文 + 加速键 |
| `启动时运行模板向导` | 从「打印和数据库」页**移到常规页「其它」分组**（真机位置） |
| 底部按钮 | `保存` → **`确定`**（真机原文）；另两个 `取消` / `帮助` 中 `帮助` 复刻版仍未挂（→ round-116 已补，见下） |
| 断言 | `ui-v103.cjs` 加严到「标题 + 四个分组框 + 9 个字段按真机原文逐个核对」，9/9 PASS |

### round-114 收口（结构部分已闭环）

| 项 | 处置 |
| --- | --- |
| 页签结构 | 改为真机四页 **`常规 / 打印和数据库 / 编辑 / 系统`**（顺序与文案逐字，`probe-r112-sysset.md` 第一节）；每个页签带 `data-testid=options-tab-<key>` |
| 复刻版自造「标签」页 | **删除该页签**；其 6 项设置（默认标签尺寸 / 排列 / 行列间隔 / 外观形状 / 显示标尺 / 显示网格）与「云服务器地址」一起移入**「复刻版扩展」区**（`data-testid=options-extensions`，虚线框 + 图例「复刻版扩展（原版系统设置中无此项）」），**没有静默删功能**（DIFF-71 硬性要求）。该区刻意不用 `options-group-*` 前缀，以免污染真机四个分组框的逐项断言 |
| 「打印和数据库」页 | 按真机加 `数据库` 分组框，字段改真机原文 **`默认使用多个数据库连接(M)`**；复刻版原有的默认打印方式/指令集/分辨率移入本页「复刻版扩展」区 |
| 「编辑」页（新增） | 按真机加 `表格操作` 分组框 + **`增删行列时，保持表格尺寸`**，并接真实行为：作为新建表格对象 `keepSize` 的全局默认（`createLabelObject(type,x,y,{tableKeepSize})`，`App.tsx` 两处创建入口传入）。默认未勾选（与真机实测态一致） |
| 「系统」页（新增） | 按真机加 `系统操作` 分组框 + 按钮 **`恢复默认窗体布局`**，行为 = 把 `toolbarGroups`/`toolbarLayout` 重置为出厂值（复刻版的「窗体布局」即工具栏分组与逐按钮布局，确定后生效） |
| 形状下拉 `直角矩形` | 随「标签」页一并移入扩展区，并按「标签格式设置」的真机原文改为 **`方角矩形`**（真机 UI 用词；帮助 `label_page_label.html` 仍写「直角矩形」，以真机 UI 为准） |
| 断言 | `app/scripts/ui-v103.cjs`：页签断言从「过滤 + 长度 3」改成 **整数组全等**（`JSON.stringify(tabs) === JSON.stringify(['常规','打印和数据库','编辑','系统'])`）；常规页分组框也改成 **整数组全等**；新增 5 条 DIFF-71 断言（扩展区保留 6 项设置 / 编辑页分组与复选框 / keepSize 勾选后持久化回读 / 系统页按钮 / 打印页数据库分组 + 原「标签」页签已消失），**15/15 PASS**。另有 `app/scripts/editor-operations.test.ts` 两条单测钉住 `createLabelObject` 的 keepSize 默认（42 项） |

### round-116 收口（底排「帮助」按钮 + 标尺单位文案）

真机底排实拍：`parity/reference/labelshop/probe-r112-sysset.png`（左→右 = `确定` / `取消` / `帮助`）；
下拉逐项原文：`parity/reference/labelshop/PROBE-verifier-round100-sysset-controls.md`。

| 项 | 处置 |
| --- | --- |
| 底排 `帮助` 按钮 | **补齐**。真机顺序为 `确定 / 取消 / 帮助`，复刻版原先只有 `取消 / 确定`（且顺序相反）→ `OptionsDialog.tsx` 底排按真机顺序重排并补 `帮助`，`data-testid=options-help`，点击 = 打开「帮助主题」对话框（`ModalHost` 里 `onHelp={() => props.setModal('help')}`，与打印/打印机对话框同一手法）。真机的 `应用(&A)` 是**隐藏**控件（dump 行首 `[ ]`），复刻版不显示 |
| `标尺单位(U):` 文案 | 选项原文由 `毫米（公制）/ 英寸（英制）` 改回真机的 **`毫米` / `英寸`**（2 项、无后缀；真机实测值就显示 `毫米`，且复刻版自己的注释 `ui-v103.cjs` L5 写的也是「毫米/英寸」）。**纯文案偏差，零风险** |
| 断言（只加严） | `ui-v103.cjs` 新增 4 条：① 标尺单位下拉**逐项原文整数组全等** = `[{mm,毫米},{inch,英寸}]`（原来只看「含英寸」，断不出后缀）；② 底排按钮**整数组全等** = `['确定','取消','帮助']` 且 `options-help` 存在；③ 底排没有可见的「应用」按钮；④ 点「帮助」真的打开 `help-dialog`。A-178/A-258 那条的标题与比较对象同步改成「英寸」。**19/19 PASS**（原 15 条 + 新 4 条） |

**仍未收口（本轮只取证不实现，避免空壳控件）**：真机「编辑」页的
`鼠标拖动时仅调整首行首列尺寸` / `鼠标拖动时仅调整末行末列尺寸` / `禁用鼠标拖动复制功能` / `使用宽松圈选模式`，
以及真机「系统」页的 `文档`（自动打开最后使用的文档 / 恢复模板文档双击链接）与 `授权许可` 分组、
「打印和数据库」页的 `打印到文件` / `打印设置(S):` / `使用常规 Excel engine` / `查重打印` 两个分组框。
这些在复刻版里**没有对应行为**（`禁用鼠标拖动复制功能` 更是取决于尚未取证的 DIFF-63/优先级 2「CTRL+拖动是复制还是移动」），
按「不许留 TODO 占位或假实现」的口径**不渲染**，登记在此等待行为语义明确后再补。

### 仍未收口（历史记录，round-112 时点）

1. **复刻版自造的「标签」页**（默认标签尺寸 / 排列 / 行列间隔 / 外观形状）在真机无对应物 ——
   真机把「形状/行列/间距」放在「标签格式设置」里，`系统设置` 没有。
   处置需先决定：删页（并保留 `AppOptions` 里 `defaultLabelW/H/labelShape/rowGapMm` 供新建标签向导用），
   还是在 `diffs.md` 记为「等价替代（复刻版把标签格式默认值集中在系统选项）」。**本轮未删**，避免功能凭空消失。
   → **DIFF-67 挂起的那个 `直角矩形`（`OptionsDialog.tsx` 的形状下拉）就在这一页**：真机无对应下拉，
   所以**不是改名问题**，而是这一页整体待收口。
2. **`打印和数据库` / `编辑` / `系统` 三页的内容**：真机字段已逐条取证（见 PROBE 文档），
   但复刻版里没有对应行为实现（如「表格操作」三条、「禁用鼠标拖动复制功能」、
   「恢复默认窗体布局」「恢复模板文档双击链接」「授权许可」下拉）——**实现需要先有行为语义**，
   否则就是空壳控件，故本轮只取证不实现。
3. **常规页「其它」分组的四个复选框真机全为勾选态**：那是本机已保存的配置，**不能据此改复刻版默认值**（默认值按帮助 `config_general.html`）。

## DIFF-72（round-113 登记；**字段原文已修，颜色控件方向已按实拍更正**）真机「条码属性 → 条码」页的字段原文与「条码页有没有颜色」

**差异**（原版 vs 复刻版，逐字）：

| 真机原文（`probe-45-barcode-props-p3.txt` 第一段） | 复刻版（round-113 之前） |
| --- | --- |
| `条码符号类型(码制)(&B):` | `条码符号类型(码制)`（缺加速键） |
| `X 尺寸(&X):` | `X 尺寸`（缺加速键） |
| `码  高(&H):`（两个空格，单位「毫米」在框后） | `码 高（毫米）`（一个空格、单位写进标签、缺加速键） |
| （无标签）供人识读字符·位置 combo | `供人识读字符 · 位置`（自造前缀名） |
| `垂直偏移(&O):` | `供人识读字符 · 垂直偏移（毫米）` |
| `对齐方式(&A):` | `供人识读字符 · 对齐方式` |
| **条码页有颜色控件**（页尾 `颜色:` + 黑色色块 + 下拉）；`颜色(&C):` 在**常规**页（值 `固定颜色`，是**颜色模式**） | round-113 误把色块迁到常规页；round-116 已放回条码页页尾 |

**round-65 冲突定案 → round-79 再次更正**：真机「条码」页（Code 128）的**控件树文本 dump** 只有 8 行、没有颜色项；
但 **`verifier-20c-barcode-page.png` 实拍**（`parity/review/cmp-props-r113.png` 左半）页尾**一眼可见** `颜色:` + 黑色色块 + 下拉箭头。
→ 那份 dump **漏枚举**了该控件：它是 **owner-drawn 色块 + 很小的下拉箭头**，不是标准 `ComboBox`/`Static`，控件树枚举不到。
**结论：图片证据优先于文本 dump**；"条码页无颜色"的判定作废。

**处置（round-116 落地）**：

- `条码颜色` 色块（`data-testid="barcode-color"`）**放回「条码」页页尾** —— 在「供人识读字符」组与「条码特殊选项」组之后、底排按钮之前。
- 「常规」页的 `颜色(&C):` **保留**，并按真机语义实现成**颜色模式**下拉，取值集沿用复刻版既有的 `COLOR_CHANGE_MODES`
  （第一项 `固定颜色` 即真机本机值）—— 它与条码页的色块**不是同一个控件**，两条互不替代。
- **同一个字段只留一处入口（验收方 round-116 复核要求）**：改用 `data-testid="color-change-mode"` 承载这个模式下拉
  （沿用既有 testid，`ui-v74/v85/v92/v108` 不必迁移），并**删掉「变色设置」分组里重复渲染的「颜色变化模式」行** ——
  原先两处绑定同一个 `colorChange.mode`，是重复渲染。对象类型不支持可变颜色时该行不渲染（`colorGranularities.length > 0`）。
- ⚠️ **round-117 回归修复（门禁 `ui-v108` 7/8 的真因，不是抖动）**：上面那一步把该行的可用性判据从
  `colorChangeEnabled`（＝`colorGranularities.length > 0 && printerSupportsColor`）**降成了只判对象类型**，
  于是**USB 直连（普通条码标签打印机）下颜色模式下拉又冒了出来**（实测 7 项可选），与 A-201
  引用的帮助原文「普通条码标签打印机无法选择彩色打印」直接冲突 —— `ui-v108` 第 6 条断言如实报错。
  **修法**：把该 `FormField` 的渲染条件改回 `colorChangeEnabled`，与「变色设置」同源；
  非彩色打印机下只保留 `color-printer-note` 提示（该提示原先就在，未受影响）。
  复验：`ui-v108` **8/8**、`ui-v74/v85/v92/v125` 全绿（驱动端口下该下拉照常渲染，行为不变）。
- 真机条码页那行色块的**下拉选项集尚未取证**，故只还原有实拍证据的色块，**不造第二份下拉**。

证据：`parity/reference/labelshop/PROBE-verifier-round79-barcode-color.md`、`verifier-20c-barcode-page.png`；
断言 `app/scripts/ui-v125.cjs`（19/19（含 `color-change-mode` 单处入口）、`app/scripts/ui-v92.cjs`（11/11），两条 DIFF-72 断言已按更正后的方向**重写且强度不降**：
由"条码页必须**无**颜色"改成"条码页必须有 `颜色:` 色块"，并新增"常规页 `颜色(&C):` 选中 `固定颜色`"）、`app/scripts/ui-v77.cjs`（7/7，B-69b 加严）。
真机 `parity/reference/labelshop/PROBE-round113-barcode-page.md` 的字段名部分（`条码符号类型(码制)(&B):` / `X 尺寸(&X):` / `码  高(&H):` …）仍然有效。

**未做（不按猜测实现）**：真机条码页第 8 个**无标签 Edit**（语义未取证，`字符模板` 仅为猜测）→ 保持「待取证」。

**状态**：✅ 字段原文已修（round-113）；颜色控件方向已按实拍更正（round-116）。

---

## DIFF-73（round-80 由并排图发现；**round-116 已修**）「标签格式设置」的预览只画**一个标签**，真机画**整张拼版网格**

**差异**：`parity/review/cmp-custom-r114.png`（左＝真机 round-44「标签格式设置」，右＝复刻版 round-114 构建）——
真机预览区是 **4行×2列 共 8 个格子**、每格正中带序号 `1…8`（先行后列）、孔洞画在每格中心、
尺寸标注（`100mm` 上方 / `70mm` 右侧）只标在**第一个格子**上；复刻版**只画一个标签**（白底 + 青边框），
只有下面那行 `100.00 x 70.00 毫米 [4行 2列]` 文字是对的。

**根因**：`CustomLabelFormatDialog.tsx` 的预览 `<svg>` 的 `viewBox` 就是**一个标签**（`-2 -2 ${width+4} ${height+4}`），
所以只画得出一个格子；`rows`/`cols` 虽然解析了，但只用于算页面尺寸与底部那行文字。

**处置（round-116）**：重写预览为**整张拼版**：

- `viewBox` = 整张网格的范围（`width*cols + colGap*(cols-1)` × `height*rows + rowGap*(rows-1)`）再留少量边距；
  与同一文件里 `pageWidth`/`pageHeight`（L71-72）的公式**同源**，没有第二份。
- `cols × rows` 个格子；每格**正中**写格子序号，**先行后列**（1、2 在第一行）；格子之间留 `列距(P)`/`行距(L)`；
  形状按 `形状` 选择（圆角矩形用共享半径 `roundRectRadiusMm`，预览与编辑器/打印同源）、孔洞画在**每格中心**。
- 尺寸标注**只在第一个格子**（`100mm` 上方 / `70mm` 右侧）。
- 底部信息行 `100.00 x 70.00 毫米 [4行 2列]` **未变**（原有断言继续钉住）。
- 预览底色由 `#22BDED` 改为透明（真机预览区底色是对话框本身的浅色，不是工作区蓝；与复刻版自己的
  「选择标签格式」预览一致）。这条属并排图顺带发现的同处差异，随本次一并改掉。

**断言（只加严）**：`app/scripts/ui-v130.cjs` 新增 3 条 ——
① 格子数 = 行数 × 列数（4×2 = 8）；② 每格序号文本恰好 `1..8`（先行后列）；③ 尺寸标注文本恰好 `100mm` / `70mm` 各一处。
**17/17 PASS**。原来只有"预览行逐字匹配"一条，断不出"只画一个格子"。

**仍欠（结构债，不阻断）**：「选择标签格式」（`NewLabelDialog.tsx`）与「标签格式设置」（`CustomLabelFormatDialog.tsx`）
目前仍是**两份预览实现**（前者还多一套卷筒纸分支）。本轮只把「标签格式设置」对齐真机，未强行合并，
以免动到被 `ui-v72` 大量断言的 `new-label-*` 结构。两者现在都由 `paperPath` 出几何、共享 `paperHoleFields`
的孔洞规则与 `roundRectRadiusMm` 的半径规则，**规则只有一份**，差的只是 SVG 布局代码。

## DIFF-74（round-120 新登记并已修）打印机属性「端口」页两处与真机不符：`类型` 加速键、空云盒的过度校验

**证据**：同态并排图 `parity/review/cmp-printerportbox-r119.png`（左=真机 × 右=复刻版，**两侧「类型」都 = 蜂打打云盒**）。
验收方 round-136 在同态下把候选 b（字段集差异）证伪为状态差异，剩下 3 条真差异；本轮收掉前 2 条。

| # | 真机 | 复刻版（改前） | 处置 |
| --- | --- | --- | --- |
| a | `类型(I):`（加速键 **I**） | `类型(T)`（加速键 **T**，且无冒号） | **已改**：`PrinterSettings.tsx` 的 `FormField label` 与页首说明文字一并改为 `类型(I):`；加速键与状态无关，可直接改 |
| e | 端口页**没有任何报错**；没发现云盒时下拉就是「未检测到云盒」这一项，底排「确定」照样可用 | 红色阻断提示 **`TCP 地址不能为空`**（`printer-port-error`）+ 禁用「保存」 | **已改**：`shared/domain/printer.ts` 的 `portConfigError()` 只对**标准 TCP/IP 端口**要求主机名必填；云盒（`cloudbox`）空主机名是**正常态**，不再返回错误。主机名**格式**错误仍然报错（放宽的是「必填」，不是「不校验」） |

**为什么空云盒不该阻断（口径）**：真机「端口」页选「蜂打打云盒」后，下拉内容就是**发现结果** ——
没有发现云盒时显示「未检测到云盒」，页面没有红字、按钮可用（同态图实拍）。复刻版拿它当校验失败属**过度校验**，
会把「先选好类型、地址稍后填」这条正常路径堵死（保存会被强制退回端口页）。
真的拿空地址去打印时，发送链路会给更准确的提示「TCP 端口未配置主机 / IP 或端口号」
（`app/src/main/printing/commandTransport.ts` 的 `sendCommand`），不会静默失败。

**断言（只加严，不降强度）**：

- `app/scripts/ui-v120.cjs` 新增 2 条（14 → **16/16 PASS**）：
  ① **`类型字段标签为真机原文「类型(I):」`** —— 读 FormField 上真正渲染出来的 `<label>` 文字（原来只断言下拉里的选项文本，断不出字段名）；
  ② **`空云盒（未检测到云盒）时不报错且「保存」可用`** —— 同时要求下拉当前值为空、有「未检测到云盒」这一项、`printer-port-error` 不存在、「保存」未禁用。
  另把两条结果名里的 `类型(T)` 改为 `类型(I):`（文案跟随产品改名，不是放宽）。
- `app/scripts/printer-catalog.test.ts` 的端口校验用例按新语义**重写并加严**：标题 `USB 必须选端口、云盒按 TCP 规则校验` → **`USB 必须选端口、TCP 必须填地址、云盒空地址是正常态`**；
  原来断言「云盒空地址必须报错」（`assert.ok(portConfigError({type:'cloudbox'}))`），现改为断言**不报错**，并**新增**三条原地没有的断言：
  空字符串主机名不报错、**格式错误的主机名仍报错**、**标准 TCP/IP 空地址仍报错**。
  （方向按真机证据改，强度提高：原来 5 条断言 → 现在 8 条。）

**同页仍存差异**（round-120 记「待核实，先别动」）→ **round-121 已取证收口，见 DIFF-75**。

---

## DIFF-75（round-121 新登记并已修）打印机属性对话框的**底排按钮形态**与 **`指令编码`** 两项，按真机取证对齐

**取证（round-121，真机 V6.39 标准版-未激活）**：

| 证据文件 | 拍/摘到了什么 |
| --- | --- |
| `parity/reference/labelshop/probe-15-cloudbox-port.png`（既有） | `Gprinter GPL-N (203 dpi) 属性`（Windows 属性表）四页签 `首选项/端口/自定义命令/工具`，底部按钮 **`确定 / 取消 / 帮助`**；端口页只有 `输出端口` 组 + `类型(I):` + `云盒:` + `设置`，**没有 `指令编码`** |
| `parity/reference/labelshop/r121-lfs-printer-page.txt`（本轮新采集） | `标签格式设置` 递归控件树（打印机页可见）：`确定`(1364) / `取消`(1513) / **隐藏的 `应用(&A)`**(1661，行首 `[ ]`) / `帮助`(1662)；页内 = `名称(&N):` + 下拉 + `设置(&S)` / `安装(&I)` / `输出方式:` + 下拉 + `整页反相打印` / `镜像输出`(不可见) / `单页任务模式` —— **无 `指令编码`** |
| `r121-lfs-default-page.txt` / `r121-lfs-after-ctrltab.txt`（本轮新采集） | `标签格式设置` 的**标签页**与**其它页**全页控件树：两页**同样 grep 不到「编码」** |

- **结论三态**：
  - `确定/取消/帮助`（+ 隐藏 `应用(&A)`）＝ **原版有**，且是 LabelShop 属性表家族的统一形态
    （`系统设置` 同形，DIFF-71 / round-116；`标签格式设置` 同形，本轮 dump；驱动属性表同形，`probe-15` 实拍）。
  - `指令编码` ＝ **原版无**（该对话框四页 + 驱动属性表端口页/工具页都没有）→ 复刻版属**扩展**。
  - `恢复默认` ＝ **原版无**（真机底排只有三个按钮）→ 复刻版属**扩展**。
    **未取证面（已记录）**：驱动属性表的 `首选项` / `自定义命令` 两页控件树仍未拿到
    （`rundll32 printui.dll,PrintUIEntry /p` 在本机不弹窗；INDEX L555 记过从打印对话框 `打印机属性(S)` 点按钮也无窗口）。
    但 `指令编码` 在那两页的可能性很低（它们是「首选项」与「自定义命令」），且**不影响本轮处置**：按扩展标注而不是删除。

**处置（`app/src/renderer/src/dialogs/PrinterSettings.tsx`，不静默删功能）**：

| 项 | 改前 | 改后 |
| --- | --- | --- |
| 底排按钮 | `恢复默认` / `取消` / `保存（随模板一起保存）` | **`确定` / `取消` / `帮助`**（真机顺序；`确定` 仍走 `save()`，`保存` 的「随模板一起保存」语义不变） |
| `帮助` | 无 | 新增 `data-testid=printer-settings-help`，点击打开「帮助主题」对话框（`ModalHost.tsx` 传 `onHelp={() => props.setModal('help')}`，与 `OptionsDialog`/`PrintDialog` 同手法） |
| `恢复默认` | 占底排左侧 | 移入**「首选项」页**的 `data-testid=printer-extensions` 虚线扩展区，图例 `复刻版扩展（原版打印机属性中无此项）` |
| `指令编码`（端口页） | 裸字段 | 加 `hint="复刻版扩展（原版该对话框无此项）"` 与 `data-testid=printer-port-encoding`，**保留功能**（指令集编码真实影响 TSPL/ZPL 输出的中文编码） |
| 导出的常量 | — | `PRINTER_SETTINGS_FOOTER_LABELS = ['确定','取消','帮助']`（源码里写明取证出处，供断言与后续复用） |

**断言（新增脚本，不改弱既有断言）**：`app/scripts/ui-v133.cjs`（已注册进 `app/scripts/run-regression.ps1`）**8/8 PASS**：

1. 打印机属性对话框已打开；
2. **底排按钮整数组全等 = `['确定','取消','帮助']`**（不是「包含」）；
3. `printer-settings-save` 文案 = `确定`；
4. 底排不再有 `恢复默认`；
5. 底排**没有可见的「应用」按钮**（真机是隐藏控件 `应用(&A)`）；
6. 点底排 `帮助` 真的打开 `help-dialog`；
7. 「首选项」页有扩展区图例 + 里面的 `恢复默认`；
8. 端口页 `指令编码` 带「复刻版扩展（原版该对话框无此项）」hint。

命令：`MAXLABEL_UI_SCRIPT=ui-v133.cjs npm run test:ui`

## DIFF-71 补记（round-120）：`界面语言(L):` =「原版有但受限（仅实现简体中文）」

真机「系统设置 → 常规」的 `界面语言(L):` 下拉是 **3 项**（`简体中文` / `繁体中文` / `English`，
证据 `parity/reference/labelshop/PROBE-verifier-round100-sysset-controls.md`），复刻版只实现 **1 项 `简体中文`**。

**口径**：按验收方要求记「**原版有但受限**」，**不列假选项** ——
复刻版没有繁体中文 / English 的语言包与界面翻译，放两个选了也不生效的选项是假实现。
`OptionsDialog.tsx` 保持只渲染 `简体中文` 一项，本条即该受限面的登记处。

---

## DIFF-76（round-124 新登记并已修）条码页「条宽比」原先**对所有码制**都渲染，真机只有部分码制有

### 真机结论三态

- **原版有**：「条码属性 → 条码」页上的 `条宽比(&W):`
  - **PDF 417**：9 档 `1 X … 9 X`，默认 `3 X`（`probe-sym-pdf417-values.txt`：`value='3 X  (选中 2 / 共 9 项)'`）；
  - **Code 39 / CodaBar / Code 25 / Matrix 25 / China Post / Interleaved 25 / ITF 14 / Pharmacode**：7 档 `2.00 … 3.00`，默认 `3.00`
    （`probe-sym-{code39,codabar,code25,matrix25,chinapost,interleaved25,itf14,pharmacode}-values.txt` 均为
    `label='条宽比(&W):' value='3.00  (选中 6 / 共 7 项)'`，`xy=(1434,551)` 同一位置）。
- **原版无**：`Code 128` / `Code 93` / `EAN-13` / `EAN-8` / `UPC-A` / `UPC-E` / `GS1 RSS` / `QR Code` / `Data Matrix` / `汉信码` / `Micro QR`
  的逐码制 dump 里**没有**这一行（`probe-sym-*-values.txt` grep 无命中）。
  真机 Code 128 条码页实拍见 `parity/reference/labelshop/verifier-20c-barcode-page.png`：`尺寸` 组里只有 `X 尺寸(X):` 一行，右侧空白。
- **原版有但受限**：无。

### 复刻版原先的问题

`ObjectPropsDialog.tsx` 的条码页把 `条宽比` 渲染成**无条件**字段（只按 `symbology === 'pdf417'` 在 9 档 / 7 档之间切换项集），
于是 Code 128 页也出现 `条宽比`，且标签写作 `条宽比`（缺加速键 `(&W)`）。
这是 round-124 出并排图 `parity/review/cmp-propsbarcode-r124.png` 时**看出来**的 —— 也说明 round-64 记的
「复刻版是条件化显示 ✓ 正确」与在途代码不符（当时只核了项数没看图）。

### 修复（round-124）

- `app/src/renderer/src/editor/barcodeTypes.ts` 新增 `W2N_SYMBOLOGIES`（`ReadonlySet<string>`，9 个 bcid，注释逐条写明证据文件名）；
- `ObjectPropsDialog.tsx` 的 `条宽比(&W):` 改为`{W2N_SYMBOLOGIES.has(barcodeObj.symbology) && (...)}`，
  标签同步补加速键（真机原文 `条宽比(&W):`）。

### 断言（只加严，未改弱任何既有断言）

`app/scripts/ui-v126.cjs` **10/10 → 13/13**（新增 3 条，已登记 `run-regression.ps1`）：

- `Code 128 的条码页**没有**「条宽比(&W):」`
- `Code 39 的条码页**有**「条宽比(&W):」且 7 档 2.00…3.00`（整数组全等）
- `Code 93 的条码页**没有**「条宽比(&W):」`

命令：`MAXLABEL_UI_SCRIPT=ui-v126.cjs npm run test:ui`（先 `npm run build`）。

### round-126 收口（第 1～4 项已完成）

| # | 项 | 处置 |
| --- | --- | --- |
| 1 | 三个分组框 | ✅ 补出 `尺寸` / `条码特殊选项` / `供人识读字符`（真机 group box 坐标 928,521 / 928,665 / 928,821） |
| 2 | Code 128 的 `条码特殊选项` | ✅ 已在该组内，文案改真机原文 `GS1/EAN 128(&U)` + `字符集(&C):` |
| 3 | `字符模板(&T)` | ✅ 补进 `供人识读字符` 组（真机 (961,959)），绑正式字段 `charTemplate`；数据源页那份重复渲染移除 |
| 4 | 自造 `对齐` | ✅ 真机条码页确无 → 移入 `barcode-extensions` 复刻版扩展区并加图例（功能在用，不静默删） |

断言 `app/scripts/ui-v134.cjs`（19 条）。**注意**：本轮 `test:ui` 因验收方独占 UI 实例未能实跑，脚本尚未经过一次真跑。

### 仍未收口（留待取证）

同一张并排图还暴露出复刻版条码页与真机的其余差异，**均未改动**，登记为待办（见 `parity/backlog.md` round-124）：

1. 真机把字段分成 `尺寸` / `条码特殊选项` / `供人识读字符` 三个**分组框**，复刻版是平铺；
2. Code 128 的 `条码特殊选项`（`GS1/EAN 128(U)` 复选 + `字符集(C):` 下拉）在复刻版该页未见（可能需滚动，待核）；
3. 真机 `字符模板(I)` 复选 + 只读输入框；
4. 复刻版多出 `对齐`（`居中对齐`）字段 —— 与 round-56 记的「`对齐` 是真机没有的自造项」一致，待核后移除或标注；
5. 默认值差异：`码 高` 真机 `10.00` / 复刻版 `12`；`X 尺寸` 真机 `10.00 mil` / 复刻版 `10`（显示格式）。
   → ✅ **round-129 已收口**（连同 X 尺寸/层数/列数三个下拉，见 `## DIFF-78`）。

---

## DIFF-78（round-129 新登记并已修）「条码属性 → 条码」页「尺寸」组的三个下拉 + 新建条码码高默认值

### 真机结论三态（证据全部来自 `parity/reference/labelshop/`，逐字）

| 控件 | 真机原文 | 真机形态 | 选项集（逐项） | 默认 | 证据文件 |
| --- | --- | --- | --- | --- | --- |
| X 尺寸 | `X 尺寸(&X):` | **Combo，61 项** | `1.67 mil` / `3.33 mil` / `5.00 mil` / … / `100.00 mil`（60 档，步长 1/600 英寸）+ 末项 `固定宽度` | 第 6 项 `10.00 mil` | `probe-sym-pdf417-values.txt`（`value='10.00 mil  (选中 5 / 共 61 项)'`）、`probe-sym-pdf417-combos.txt` combo[2] |
| 层数 | `层数(&R):` | **Combo，89 项** | `自动` + `3` … `90` | `自动` | 同上 combo[5]（`count=89 sel=0 cur='自动'`） |
| 列数 | `列数(&C):` | **Combo，31 项** | `自动` + `1` … `30` | `自动` | 同上 combo[6]（`count=31 sel=0 cur='自动'`） |
| 码高 | `码  高(&H):` | Edit（毫米在框后） | — | `10.00` | `probe-45-barcode-props-p3.txt`（`Edit label='码  高(&H):' value='10.00'`） |

- **原版无**：`层数` 的「每层高度 = X 尺寸的倍数」这一语义（真机是**行数**）；复刻版原先的 `12`（码高默认）。
- **原版有但受限**：`固定宽度` 档的真机像素行为未取证（见下）。

### 复刻版原先的问题

1. 三个控件都是**自由数字框**（`X 尺寸` min1/max1000/step1；`层数` min1/max10；`列数` 1–30 留空=自动），与真机的**下拉选项集**不符；
2. `层数` 绑的是**自造语义** `pdf417LayerHeightX`（「每层高度 = X 尺寸的几倍」，默认 3）——真机没有这个字段，
   而且该值**从未进入渲染**（`toBwipOptions` 与三个打印引擎都没读它）＝一条**假功能**；
3. 新建条码的 `码  高(&H):` 默认 `12`，真机是 `10.00`。

### 修复（round-129）

- 新增 `app/src/renderer/src/dialogs/barcodeSizeFields.ts`：三个下拉的**逐项原文**与默认档（含 `自动` / `固定宽度` 常量、mil↔档位换算）；
- `ObjectPropsDialog.tsx`：`X 尺寸(&X):` / `层数(&R):` / `列数(&C):` 三个控件改为下拉，标签补真机加速键；
- 模型 `pdf417LayerHeightX` → **`pdf417Rows`**（归一化 3–90）；`toBwipOptions` 把行数/列数转发给 bwip-js 的 `rows` / `columns`
  （实测两者都会改变输出；`自动` = 不设值），并新增 `xSizeFixed`：选 `固定宽度` 时不传 `xsize`；
- `objectFactory.ts`：新建条码高度 12 → **10**。

**顺手修掉一个真缺陷**：条码页的 `码  高(&H):` 原先是直接 `onPatch({h})`，而底排「确定」会用
`useObjectGeometryDraft` 的草稿 `h`（对话框打开时快照）**覆盖**它 —— 用户在条码页改的码高会被吞掉。
现改为与「常规」页共用同一个几何草稿（`h`/`setH`），两页同一份值。

### 断言（只加严，未改弱）

- 新增 `app/scripts/ui-v136.cjs`（**11 条**，已注册 `run-regression.ps1`）：
  61/89/31 项的**逐项文本全等**、默认档、字段原文，以及「选 `固定宽度` / `20.00 mil` / `层数=12` / `码高=15` 后点确定再打开仍保持」（证明落到模型）。
- `app/scripts/barcode-spec.test.ts` 新增 **B-134a ×3 + B-134b ×1**：选项集数组、默认档、
  `rows/columns` 与 `固定宽度` 的转发行为、新建条码高度 10 / X 尺寸 10.00 mil。
- `ui-v56.cjs`（`X 尺寸` 断言由「数字框 value=10」加严为「SELECT + 61 项 + 默认 10.00 mil」；PDF417 层高断言改为「层数/列数下拉均为自动」）→ **11/11**；
- `ui-v77.cjs` B-69 加严为「61 项 / 首项 1.67 mil / 第 6 项 10.00 mil / 末项 固定宽度」→ **8/8**；
- `ui-v106.cjs` B-134 断言迁移 → **33/33**。

### 未取证边界（登记，不猜）

- 真机 `固定宽度` 档的**像素行为**：本轮按「不指定窄条宽度（由对象宽度决定）」实现（`toBwipOptions` 不传 `xsize`），
  依据是该选项自身的语义 + 复刻版渲染本来就按对象框缩放；真机上「固定宽度」后条码实际宽度如何计算**未取证**。
- `自动` 档（层数/列数默认）下真机与 bwip-js 的排布是否逐像素一致**未取证**（只证了「不设值」这一口径）。

### 命令

`npm run test:barcode`；`MAXLABEL_UI_SCRIPT=ui-v136.cjs npm run test:ui`（先 `npm run build`）；
`MAXLABEL_UI_SCRIPT=ui-v56.cjs / ui-v77.cjs / ui-v106.cjs npm run test:ui`。

## DIFF-77（round-128 新登记并已修）「条码属性 → 条码」页**各二维码制**的字段原文与选项集与真机不一致

- 断言：`app/scripts/ui-v135.cjs`（**30/30 PASS**，验收方 round-156 替跑复核）——钉住六处字段原文、选项集逐项文本与默认值。
- 状态：已修（round-128 实现，round-152 补本条台账，round-156/169 复核断言）。

### 真机结论三态（全部出自 `parity/reference/labelshop/` 的真机控件 dump，逐字）

| 字段 | 真机原文（含加速键） | 真机选项（逐项） | 默认 | 证据文件 |
| --- | --- | --- | --- | --- |
| QR Code 纠错级别 | `纠错级别(&E):`（Combo，4 项） | `L` / `M` / `Q` / `H` | `M` | `probe-sym-qrcode-values.txt`、`probe-sym-qrcode-combos.txt` combo[3] |
| QR Code 字符编码 | `字符编码:`（Combo，2 项） | **`UTF-8` / `ANSI`** | `ANSI` | 同上 combo[4]（`count=2 sel=1 cur='ANSI'`） |
| QR Code 图标区域 | `图标区域：`（**Combo**，31 项） | `无` / `1` … `30` | `无` | 同上 combo[5]（`count=31 sel=0 cur='无'`） |
| QR Code 符号版本 | `符号版本:`（Combo，41 项） | `自动` / `1 (21x21)` … `40 (177x177)` | `自动` | 同上 combo[2] |
| Micro QR 纠错级别 | `纠错级别(&E):`（Combo，3 项） | `L` / `M` / `Q` | `M` | `probe-sym-microqr-combos.txt` combo[3] |
| Micro QR 符号版本 | `符号版本:`（Combo，5 项） | `自动` / `M1 (11x11)` … `M4 (17x17)` | `自动` | 同上 combo[2] |
| Data Matrix 字符编码 | `字符编码:`（Combo，2 项） | `UTF-8` / `ANSI` | `ANSI` | `probe-sym-datamatrix-combos.txt` combo[4] |
| Data Matrix 符号版本 | `符号版本:`（Combo，31 项） | `自动` / `1 (10x10)` … `30` | `自动` | `probe-sym-datamatrix-values.txt` |
| PDF 417 纠错级别 | `纠错级别(&E):`（Combo，**10 项**） | `自动` / `0` … `8` | `自动` | `probe-sym-pdf417-combos.txt` combo[4] |
| 汉信码 纠错级别 | `纠错级别(&E):`（Combo，4 项） | **`1` / `2` / `3` / `4`** | `1` | `probe-sym-hanxin-combos.txt` combo[2] |
| 汉信码 版本 | `版本(&V):`（Combo，85 项） | `自动` / `1` … `84`（**项文本纯数字**） | `自动` | 同上 combo[3] |
| Data Matrix 纠错级别 | **真机该页无此控件**（`probe-sym-datamatrix-values.txt` 只有上述三项） | — | — | — |

### 复刻版原先的问题（六处，均为真机证据直接证伪）

1. 六个字段标签都**缺加速键/冒号**：`纠错级别`（真机 `纠错级别(&E):`）、`字符编码`（真机 `字符编码:`）、
   `符号版本`（真机 `符号版本:`）、`版本`（真机 `版本(&V):`）；
2. QR 纠错级别选项带**自造后缀** `L（约7%）/M（约15%）/…`，真机是纯 `L/M/Q/H`；
3. PDF 417 纠错级别是**自造的 5 档** `0/2/4/6/8`（默认 2），真机是 10 项 `自动 + 0…8`（默认 `自动`）；
4. 汉信码纠错级别是**自造的 `L1…L4`**（默认 L2），真机是 `1/2/3/4`（默认 `1`）——
   附带一个真 bug：`L1` 这类值送进 bwip-js 本就不合规（见下）；
5. 汉信码版本项文本是**自造的 `版本 1`**，真机是纯数字 `1`；
6. QR「图标区域」在复刻版是**复选框**（`图标区域（中央留白，供插入 Logo 图标）`），真机是**31 项下拉**。

### 修复（round-128）

- `app/src/renderer/src/dialogs/ObjectPropsDialog.tsx`：上述 6 处按真机原文/选项集/默认值改；
  新增 `data-testid`：`qr-eclevel` / `qr-encoding` / `qr-icon-area` / `dm-encoding` / `pdf417-eclevel` / `hanxin-eclevel`。
- `app/src/shared/domain/objects.ts`：`qrIconArea?: boolean` → `qrIconAreaSize?: number`（0/未设 = 「无」，
  注释写明真机是数量而非开关）。
- `app/src/shared/domain/document.ts`：`qrIconAreaSize` 纳入数值归一化（范围 0–30）；
  **旧文档兼容**：`qrIconArea === true` 时迁移为 `qrIconAreaSize = 1`（不丢用户数据），布尔项从白名单移除。
- `app/src/renderer/src/editor/barcode.ts`：纠错级别**按码制校验后再转发**给 bwip-js
  （QR `^[LMQH]$`、PDF 417 `^[0-8]$`、汉信码 `^[1-4]$`）——「自动」即不设值交给编码器，
  与 `cpcl.ts` / `tspl.ts` / `zpl.ts` 既有的数值兜底口径一致。此前 `L1`（汉信码旧默认）会被原样送进编码器。

### 断言（只加严，未改弱任何既有断言）

- **新增** `app/scripts/ui-v135.cjs`（已注册 `run-regression.ps1`）**30 条**：每个码制的字段原文、选项整数组全等、
  默认选中项，以及三条反向断言（不再有百分比后缀 / 不再有 `L1…L4` / 图标区域不再是复选框）。
  命令：`$env:MAXLABEL_UI_SCRIPT='ui-v135.cjs'; npm run test:ui` → **30/30 PASS**。
- **迁移**（断言随真机口径改，强度只增）：
  - `ui-v127.cjs`「160 汉信码「版本」85 项」：`版本 1` → `1`（仍是值级全等）→ **5/5 PASS**；
  - `ui-v106.cjs`：`B-135` / `B-137` 四条从「标签包含」改成**逐字全等 + 项序全等**、字形改真机原文 → **33/33 PASS**。

### 仍未收口（同页，留待取证）

1. PDF 417 `层数(&R):` / `列数(&C):`：真机是 **Combo**（层数 89 项 `自动 + 3…`、列数 31 项，见
   `probe-sym-pdf417-combos.txt` combo[5]/combo[6]），复刻版是数字输入框，且 `层数` 绑的 `pdf417LayerHeightX`
   语义是「每层高度 = X 尺寸的倍数」——**语义与真机的「层数（列数/行数）」不同**，
   改之前要先定案（避免只改控件形态却改了输出），暂**不动**。
2. Data Matrix 的「纠错级别（仅 ECC200）」只读项：真机该页**没有**这个控件；它是有意保留（帮助
   `label_object_page_barcode_dm.html` 写明只支持 ECC200），保留理由与边界见下节。
3. `码  高(&H):` 默认 `12` vs 真机 `10.00`；`X 尺寸(&X):` 复刻版是数字框而真机是 **61 项 Combo**
   （`1.67 mil`…，步长 1/600 英寸，默认第 6 项 `10.00 mil`）——两者都还没定案（详见 DIFF-76 第 5 项）。

### 「原版有但受限」登记

- **Data Matrix 纠错级别**：真机该页无该控件（数据矩阵的纠错等级在真机由 ECC200 固定），
  复刻版保留一个**禁用**的只读展示项（`data-testid=datamatrix-eclevel`），来源是帮助
  `label_object_page_barcode_dm.html`「只支持 ECC200」。属**复刻版扩展（只读、不可改）**，非真机控件。
  **round-131 收口**：这不是漏实现——真机 `probe-sym-datamatrix-values.txt` 的可见字段只有
  `X 尺寸(&X):` / `字符编码:` / `符号版本:`；复刻版的只读扩展由 `app/scripts/ui-v135.cjs`
  与 `app/scripts/barcode-spec.test.ts` 覆盖，状态明确为「原版有但受限：ECC200 固定」。

## DIFF-79（round-130 新登记并已修）启始页「最新文章」列表：整块样式未生效 + 日期右对齐

### 缘起（验收方 round-130 待复核候选）

并排图 `parity/review/cmp-start-r119.png`（左＝真机启始页，右＝复刻版 round-119 构建）里，
真机右下方「最新文章」有 3 条（带标题与日期），复刻版只看到标题、下面一片空白。
验收方要求**先复核、不许猜**（可能是折叠线以下/需要滚动造成的假差异）。

### 复核结论：**不是内容缺失，但确实有真缺陷**

**① 「一片空白」是折叠线造成的假差异** —— 滚动到底后复刻版**完整渲染 6 条**文章
（标题 + 红点 + 日期 + 摘要俱全），`count = 6`、`p` 的 `display:block` / `visibility:visible`。
出图 `parity/reference/maxlabel/r130-start-bottom.png`（滚到底）。
真机那张是 2582×1550 的整窗截图，复刻版窗口较矮，文章区在折叠线以下 —— **同状态重出图后不存在内容缺口**。

**② 但复核过程发现一处真缺陷：`<article>` 漏了 `className="start-article"`**，导致该条的**全部样式规则失效**。
实测（复刻版在途构建，CDP 回读计算样式）：

```
articleClass: ""        marginBottom: "0px"     paddingLeft: "0px"
borderLeft: "0px none"  pColor: "rgb(26,27,28)"  pFont: "16px"
```

而 `styles.css` 里 `.start-article` 与 `.start-article p` 的规则是**写好的**：
`margin-bottom:14px` / `padding-left:20px` / `border-left:4px solid #0099ff` / 摘要 `14px #666`。
全库静态审计也印证：`start-article` 是**唯一一个「在 styles.css 里定义、却从未被任何 className 引用」的类**
（其余 32 个类全部被引用）。所以用户看到的是：**没有蓝色左竖条、没有缩进、没有条目间距、摘要不是灰色小字**，
整块退化成一片没有分隔的深色文字 —— 这正是「看着像空白」的观感来源。

**③ 日期位置与真机不符**：`.start-article-heading` 原为 `justify-content: space-between`（日期右对齐到容器右缘），
真机是**紧跟在标题红点之后**。

### 真机证据（`parity/reference/labelshop/92-00-startup.png`，逐像素量测；DPR≈1.5）

| 量测项 | 真机（物理 px） | 换算 CSS px | 复刻版（修前） |
| --- | --- | --- | --- |
| 蓝竖条 x 范围 | `396..401`（宽 6） | 4px（= `border-left:4px`） | **不存在** |
| 蓝竖条 y 范围（第 1/2 条） | `1356..1387`（高 32）/ `1450..1479`（高 30） | ≈21 | — |
| 同一文章摘要行 y | `1409..1431` | — | — |
| 整条文章高度 | ≈69 | ≈46 | — |
| 标题文字左缘 | `430` | ≈24（= 4 竖条 + 20 缩进） | 383（无缩进） |
| 摘要文字左缘 | `430` | ≈24（与标题同起） | 383 |
| 红点 ● x | `967..978` | — | 887..895 |
| 日期 x | `1000..1096`（**紧跟红点**） | — | `1844..1941`（贴着容器右缘） |
| 相邻文章标题行顶间距 | `94` | ≈62.7（≈ 标题行 26 + 摘要行 20 + `margin-bottom:14px`） | 74 |

**由量测得出的两条结论**：
1. **蓝竖条只覆盖标题行，不覆盖摘要行**（竖条高 32 ≪ 整条文章 69）→ 竖条应挂在**标题行**上，不是整条文章上；
2. **日期内联在标题+红点之后**（红点 967→日期 1000，间隔 22 ≈ `gap:18px`），
   与 `justify-content: flex-start` 的排版吻合；若为 `space-between`，日期右缘会落在容器右缘（≈1997）而非 1096。

### 修复（round-130）

- `app/src/renderer/src/pages/StartPage.tsx`：`<article>` 补 `className="start-article"`（原缺失）。
- `app/src/renderer/src/styles.css`：
  - `.start-article` 只留 `margin-bottom:14px`（去掉 `padding-left` 与 `border-left`）；
  - `.start-article-heading` 加 `padding-left:20px` + `border-left:4px solid #0099ff`（竖条落在标题行），
    并把 `justify-content` 由 `space-between` 改为 `flex-start`（日期内联）；
  - `.start-article p` 的 `padding-left` 由 `2px` 改为 `26px`（4 竖条 + 20 缩进 + 2，与标题文字左缘对齐）。
  - 注释里写明量测来源，防止后人再按"整条文章"理解竖条。

### 断言（`app/scripts/ui-v54.cjs`，11 → **18/18 PASS**，新增 7 条，强度只增）

`最新文章列表非空（真机 6 条，非「一片空白」）` / `每条文章带 start-article 类且 14px 间距生效` /
`文章蓝竖条挂在标题行（4px #0099ff）且不在整条文章上` / `蓝竖条只覆盖标题行（标题行高 < 整条文章高的 75%）` /
`摘要为 14px #666（真机口径）` / `日期紧跟标题红点之后而非右对齐（间距 < 40px）` /
`标题行以红点收尾且日期为真机格式`。
命令：`MAXLABEL_UI_SCRIPT=ui-v54.cjs npm run test:ui`。
第 3 条是**数值级**断言（`getComputedStyle(...).borderLeft === '4px solid rgb(0, 153, 255)'`），
修回旧写法（竖条挂整条文章 / 漏 className）必红。

### 证据文件

- 真机：`parity/reference/labelshop/92-00-startup.png`
- 复刻版：`parity/reference/maxlabel/r130-start-top.png`（未滚动）、`parity/reference/maxlabel/r130-start-bottom.png`（滚到底，6 条齐全）
- 并排：`parity/review/cmp-start-r130.png`

### 已记录边界（未做，不许猜）

- **标题/摘要的字号仍未与真机逐像素对齐**：真机标题墨高 32 物理 px、复刻版 27；真机摘要墨高 23、复刻版（未套用规则时 16px）也是 23。
  两者指向**字体族差异**（真机 MFC 用系统宋体系，复刻版 `body` 用 `'PingFang SC','Microsoft YaHei'`）而非单纯的 `font-size` 偏差，
  单靠改 `font-size` 无法同时对上墨高与行距。**未擅自改字号**（改错会让整页排版漂移），登记为待取证。
- **蓝竖条高度**：真机 32 物理 px（≈21 CSS），复刻版按标题行高 26 CSS px 绘制（≈39 物理）。
  真机那条竖条比标题行盒**还矮**，说明它不是标题行盒的 `border-left`（取向、阈值都指不到同一个来源），
  真实实现方式未取证。**已对齐的是"覆盖标题行、不覆盖摘要行"这一可见语义**，绝对高度差 ≈5 CSS px 登记为边界。

### round-130 精修：找到真机的**样式表原文**后按逐字值收敛（`START-PAGE-SPEC.md` §3.2）

首次修复（本节之上）只有**像素量测反推**的值。随后在真机证据文件
`parity/reference/labelshop/START-PAGE-SPEC.md` §3.2 里找到验收方抄录的**原版 CSS 原文**
（来源：原版 `default.html` 行 77–85），于是改为**逐字照抄**：

```css
.ymg_c12_info03 dl      { overflow:hidden; margin-top:10px; }
.ymg_c12_info03 dl dt   { font-size:12px; font-weight:normal; color:#999;
                          line-height:20px; display:block; height:22px; overflow:hidden; margin-bottom:10px; }
.ymg_c12_info03 dl dt b { font-size:18px; line-height:22px; font-weight:normal; color:#0099ff;
                          padding:0 0 0 20px; border-left:4px solid #0099ff;
                          display:inline-block; margin-right:10px; }
.ymg_c12_info03 dl dd   { font-size:14px; font-weight:normal; color:#666;
                          line-height:20px; text-align:left; display:block; padding:0 0 0 22px; }
```

**这份原文一次性解释了此前所有量测值，并推翻了我第一次修复里的两处近似**：

| 量测（真机物理 px，DPR≈1.5） | 原文对应 | 第一次修复（近似） | 精修后 |
| --- | --- | --- | --- |
| 蓝竖条高 **32**（≈21.3 CSS） | `dt b { line-height:22px; border-left; display:inline-block }` → 竖条 = 22px | 竖条挂标题行盒、高 26px（**偏高**） | 竖条挂**标题 `<a>`**、`line-height:22px` → 实测高 **33** 物理 px ✓ |
| 条间距 **94**（≈62.7 CSS） | `dl{margin-top:10} + dt{22+10} + dd{20}` = **62** CSS | `margin-bottom:14px`（凑巧接近） | `margin-top:10px` ✓ |
| 日期 **1000..1096**（紧跟红点） | 日期由 `dt`（12px #999）承担，跟在 `<b>` 后（`margin-right:10px`） | `flex-start` + `gap:18px`（间距偏大） | `gap:10px`、`time{font-size:12px}` ✓ 实测红点→日期 19 物理 px（真机 22） |
| 摘要左缘 x **430** | `dd { padding:0 0 0 22px }` | `padding-left:26px`（**偏右 4px**） | `padding-left:22px` ✓ |
| 红点宽度 **12**（≈8 CSS） | 红点是 `<b>` 内的 `<font color="#EE0000">`，字号随标题 **18px** | `font-size:13px`（**偏小**） | `font-size:inherit` ✓ |

**结论：`START-PAGE-SPEC.md` 这类"真机资源原文"证据的优先级高于截图量测** —— 量测只能反推出区间，
原文能给出精确值（本轮 5 处里量测错了 4 处方向）。已把这条教训写进 `backlog.md`。

### 断言（`app/scripts/ui-v54.cjs`，11 → **19/19 PASS**，新增 8 条，全部为**真机原文数值级**）

`最新文章列表非空（真机 6 条）` / `每条文章带 start-article 类且 10px 条间距生效` /
`文章蓝竖条挂在标题上（4px solid rgb(0,153,255)）且不在整条文章上` / `蓝竖条高 22px、只覆盖标题行不覆盖摘要` /
`摘要为 14px #666 且 padding-left 22px（真机 dd 原文）` / `标题行高 22px / 竖条 padding-left 20px（真机 dt b 原文）` /
`日期紧跟标题红点之后而非右对齐（间距 = 真机 10px）` / `标题行以红点收尾且日期为真机格式`。
命令：`MAXLABEL_UI_SCRIPT=ui-v54.cjs npm run test:ui`。

### 证据文件（精修后重出）

- 真机：`parity/reference/labelshop/92-00-startup.png`；样式与结构原文 `parity/reference/labelshop/START-PAGE-SPEC.md`
- 复刻版：`parity/reference/maxlabel/r130-start-top.png`、`parity/reference/maxlabel/r130-start-bottom.png`（滚到底，6 条齐全）
- 并排：`parity/review/cmp-start-r130.png`、文章区并排 `parity/review/cmp-start-articles-r130.png`

### 已记录边界（未做，不许猜）

- **标题/摘要字号未改**：真机 `dt b { font-size:18px }`、`dd { font-size:14px }` 与复刻版**完全一致**，
  余下的墨高差（真机标题墨高 32 物理 px / 复刻版 27）因此来自**字体族**（真机走系统宋体系，复刻版 `body` 用
  `'PingFang SC','Microsoft YaHei'`），**不是字号问题** → 需先取证真机实际渲染字体，勿盲改。

## DIFF-80（round-132 登记；**round-133 复核后收口为「原版有但运行时不显示 → 不实现」**）`账户(A)` 菜单的 `服务器...`

### round-133 复核（回答验收方 round-163 的疑问）

验收方 round-163 指出：真机 `账户(A)` 弹菜单实拍 `parity/reference/labelshop/r162-menu-06-account.png` 只有
**5 项**（`登录... / 注销... / 账号和授权管理... / 试用管理... / 演示和体验...`），**没有 `服务器...`**，
与 round-132 从安装包字符串表读到的结论不一致。

**本轮独立复核结论：两边都对，但结论要按「运行时为准」写。**

1. **菜单资源里确有该串**（本轮自己重读 exe 复核，非转述）：偏移 17400000 一带的菜单资源字符串表里，
   `账户(&A)` 段逐字为 `登录... | 注销... | 账号和授权管理... | 试用管理... | **服务器...** | 演示和体验...`。
2. **真机运行时不显示**：`r162-menu-06-account.png` 的弹菜单只有 5 项，`服务器...` 不在其中 ——
   说明该菜单项在运行时被**条件删除**（MFC 常见的做法：按登录/授权状态增删菜单项）。
3. **同类先例**：`选项(O) → 电子称` 也是「资源里有、本机不显示（未接硬件）」（DIFF-81，验收方已复核认可）。
4. 帮助 `menu_help.html`（6.37）**尚无**此项 → 属 6.37→6.39 新增且**带显示条件**的入口。

### 处置

**不实现**（复刻版账户菜单保持真机运行时的 5 项），三态记为「**原版有但运行时不显示**」。
**不实现猜测版界面**：显示条件（登录后？授权服务器已配置？）与点开后的形态（列表对话框 / 属性表）、
`确定` 后的落点都还没有证据；取证手法同 DIFF-63（真机登录后再拍一次账户菜单 + `Read-LabelShopDialogTree` 树 dump）。

**断言**：`app/scripts/ui-v138.cjs` **11/11** —— 「账户(A) 菜单与真机 r162-menu-06-account.png 逐项全等（无 服务器...）」
与「不含运行时不可见的 `服务器...`」两条钉住当前口径（**不是**"存在性"假断言，是真机运行时项集的全等断言）。

---

### 附：round-132 的原始证据（保留备查）

**原版证据**：真机安装包 `C:\Program Files (x86)\LabelShop\LabelShop\LabelShop.exe` 的**菜单字符串表**（UTF-16LE，偏移 17401836）逐字为：

```
账户(&A) | 登录... | 注销... | (分隔) | 账号和授权管理... | 试用管理... | 服务器... | 演示和体验... | 云马通(&C) | …
```

同文件另有两组与之匹配的对话框字符串资源：`授权服务器设置`（含 `服务器：` / `IP地址` / `确定` / `取消`）、
`连接到授权服务器` / `高级设置`，以及服务器连接列表的 `名称` / `类型` / `LabelShop 服务器` / `Web 服务器` /
`网址：` / `连接密钥：` / `请输入正确的服务器地址` / `此服务器连接已经存在·请更换名称后重试` / `新增服务器连接成功`。
帮助 `menu_help.html`（Ver 6.37）**尚无**此项（该页只列 登录/注销/账号与授权管理/试用管理/演示和体验），
说明 `服务器...` 是 6.37→6.39 之间新增的入口。

**复刻版现状（round-133 更正）**：`labelShopMenus.ts` 的 `账户(A)` 是 **5 项**
（`登录...` / `注销...` / `账号和授权管理...` / `试用管理...` / `演示和体验...`）—— 与真机**运行时实拍逐项全等** ✓
（round-132 把这里写成「只有 6 项」是笔误：6 项是**资源**里的项数，运行时是 5 项）。
数据库层面仍无「连接密钥 / 新增服务器连接 / 授权服务器设置」等文案。

**处置（round-133 定稿）**：**不实现** —— 真机运行时同样不显示该项，复刻版照运行时对齐即可；
显示条件与点开后的形态仍未取证（见上）。取证手法与「优先级 1」的 DIFF-63 同（真机菜单 + 树 dump）。
**断言**：`app/scripts/ui-v138.cjs` **11/11**（见上）。

## DIFF-81（round-132 新登记，**结论：复刻版正确，保留**）`选项(O)` 菜单的第三项 `电子称`

**起因**：验收方 round-158 由并排图 `parity/review/cmp-optionsmenu-r131.png` 发现「复刻版选项菜单比真机多出第三项 `电子称`」，
并明确要求**先查证再动，不许静默删**。

**取证结论：真机（V6.39）的选项菜单就是三项，复刻版是对的 —— 不删。**

- **原版证据 ①（安装包菜单资源）**：`LabelShop.exe` 菜单字符串表偏移 17401836 逐字为
  `选项(&O) | 系统选项(&C)... | 应用程序外观(&A) | 蓝色样式(&B) 黑色样式(&L) 银色样式(&S) 水绿色样式(&A) | 电子称 | 窗口(&W) | …`
  —— 与复刻版 `labelShopMenus.ts` 的三项**逐字一致**，且资源里 `电子称` **没有加速键**（复刻版同样没有）。
- **原版证据 ②（帮助原文）**：`menu_option.html`（帮助 → 界面参考 → 菜单 → 选项菜单）：
  「选项菜单用于系统设置及电子称配置操作… **电子秤 显示 电子称配置对话框**」。
  注意用字：帮助**正文**写「电子秤」，但该页**标题**与安装包字符串都写「**电子称**」→ 界面文案以安装包为准 = `电子称`（与复刻版一致）。
- **为什么本机真机截图里只有两项**（`r100-options-menu.png`，验收方 round-158 的图）：该机**没有接电子称**，
  判为**按硬件/配置条件显示**（不是"该版本没有这项"）。判定依据是资源里确实存在该项，且帮助正文把它写成选项菜单的固定条目。
- **复刻版证据**：`labelShopMenus.ts` L301-305（三项）；断言 `app/scripts/ui-v137.cjs`（6/6 PASS，本轮新增）。

**处置**：**保留**。补一条口径说明（本段）：真机本机运行态未显示，属硬件条件；复刻版常显，不视为差异。
**断言**：`ui-v137.cjs`「DIFF-81 选项(O) 菜单项与安装包菜单资源逐字一致」/「`电子称` 项无加速键」/「`电子称` 项可用」/
「点 `电子称` 打开电子称配置对话框」。命令：`MAXLABEL_UI_SCRIPT=ui-v137.cjs npm run test:ui`。

## DIFF-82（round-132 新登记，**已部分收敛：原版有但受限**）`账户(A)→登录...` 不弹应用内登录窗口

**验收方 round-157 提问**：复刻版点 `账户(A) → 登录...` 后 `dialogs:0`，什么都不弹 —— 设计如此还是缺陷？

**原版证据**：
- 帮助 `menu_help.html`：「**登录** 显示 **签赋LabelShop 登录窗口**」——原版是**应用内窗口**。
- 真机安装包字符串资源（偏移 17446854）：对话框标题 **`登录 LabelShop`**，正文
  `请使用云马科技账号登录服务器` / `激活 签赋 LabelShop` / `请输密码` / 按钮 `登录`；
  验收方 round-47 实拍亦为 `verifier-r47-print-dialog.png`（标题「登录 LabelShop」）。

**复刻版现状**：`labelShopMenus.ts:286` 的 `登录...` 走 `deps.openCloud` → 主进程 `openCloudWindow()`
（`app/src/main/cloudService.ts`）加载**云服务器网址**的独立窗口，**不是**应用内登录对话框；
且菜单原先没传 `onError`，服务器不可达时**完全静默**。

**处置（本轮做的 + 仍受限的部分）**：
1. 已做：`App.tsx` 把菜单依赖 `openCloud` 改为 `() => openCloud(setStatus)` —— 打开失败时把
   `无法连接云服务器（…）` 等写进状态栏，**不再静默**；断言 `ui-v137.cjs` 第 6 条。
2. **仍受限（原版有但受限）**：复刻版没有原版那个**应用内**「登录 LabelShop」窗口
   （账号 / 密码 / 激活三段式），登录走外部云服务窗口。差异已如实登记，不实现猜测版界面。

**断言**：`ui-v137.cjs`「账户(A) 菜单含 `登录...`」+「服务器不可达时点 `登录...` 不静默：状态栏给出失败反馈」。

---

## DIFF-83（round-172 验收方发现 / round-135 登记并修复；**已修**）标签里把 MFC 加速键标记 `&` 渲染成了字面量

**状态**：已修（产品 + 断言两侧同步）。

**现象（真机 vs 复刻版）**
- 真机「条码属性 → 条码」页**屏幕上**的文案**不带 `&`**：
  `条码符号类型(码制)(B):` / `X 尺寸(X):` / `码  高(H):` / `字符集(C):` / `位置(P):` / `垂直偏移(O):` /
  `对齐方式(A):` / `字符模板(T)` / `GS1/EAN 128(U)`。
- 复刻版原先把控件树 dump 的原文直接写进了 React 标签，于是用户看到的是
  `(&B)` / `(&X)` / `(&H)` / `(&C)` / `(&U)` —— **每处都多渲染了一个 `&`**。

**根因**：原版是 MFC 程序，控件标题里的 `&` 是 **Windows 加速键标记**，`DrawItem` 时**不绘制**，
只把后一个字符画成带下划线；`&&` 才表示一个字面 `&`。所以 `probe-*.txt` 里的 dump 原文（带 `&`）
与真机**屏幕**上的可见文案（不带 `&`）本来就不同，复刻版此前把两者当成了同一个东西。

**影响面**：不是条码页一处——只要源码在标签里写了 `(&X)` 就会多一个 `&`，
覆盖整个「对象属性」家族（条码 / 数据源 / 常规）与各对话框。

**证据**
- 真机实拍：`parity/reference/labelshop/verifier-20c-barcode-page.png`（屏幕口径，无 `&`）。
- 真机控件树 dump：`parity/reference/labelshop/probe-60-barcode-props-tree.txt`（原文口径，带 `&`）——
  两者**同时存在且都对**，这正是本差异的关键。
- 并排图：`parity/review/cmp-propsbarcode-1741523.png`（左＝真机实拍，右＝复刻版 commit 1741523，
  右边一眼可见字面量 `&`）。

**处置**
1. 新增唯一转换点 `app/src/shared/mfcCaption.ts`：`displayMfcCaption()` 按 MFC 语义转换
   （`&&` → 一个 `&`；单个 `&` 不显示），另有 `acceleratorOf()` 供后续接键盘加速键。
2. `app/src/renderer/src/dialogs/Modal.tsx` 的 **`FormField`**（全应用字段标签的唯一原语）
   与 `ObjectPropsDialog.tsx` 的 `GS1/EAN 128(&U)` 内联复选框标签统一走它——源码里仍保留 dump 原文
   （取证依据不丢），只在**渲染时**去掉标记。
3. 静态不变量：`app/scripts/architecture-check.cjs` 新增一条——源码里出现字面量 `(&X)`（注释除外）
   即失败（`8 architecture checks passed`）。
4. 单元断言：`app/scripts/mfc-caption.test.ts`（6 条）+ `npm run test:mfc-caption`，已接入 `npm test`。

**断言**：`app/scripts/ui-v139.cjs`（**7/7 PASS**，已注册进 `run-regression.ps1`）——
「条码」页 8 项真机屏幕口径逐字命中 / 条码页整页无 `(&` / 对象属性 4 个页签逐页无 `(&` /
数据源页无 `(&` / 「系统设置」对话框无 `(&` 且仍有 `标尺单位(U):` / 整窗口可见文本兜底无 `(&`）。
命令：`MAXLABEL_UI_SCRIPT=ui-v139.cjs; npm run test:ui`。

**连带迁移（断言强度不降）**：15 个 `app/scripts/ui-v*.cjs` 里**代码位置**的断言文案由 `(&X)` 改为 `(X)`
（机械替换 87 处，已用 diff 审计确认「每一处都只是移除一个 `&`」）；**注释里的 dump 原文保持不变**。
复跑确认：`ui-v134.cjs` **19/19 PASS**（验收方 round-172 点名要求修正的那条）。

**遗留提醒（验收方一侧）**：`tools/parity/Verify-BarcodePage.cjs` 的 `CLONE_LABELS`
仍写着复刻版**修复前**的 `(&B)` 形态，本轮产品修复后该条会转红——按该工装自己的设计
（CLONE 口径 = 现状回归，REAL 口径 = 真机），需把 `CLONE_LABELS` 更新为不带 `&` 的形态；
工装归验收方维护，本轮**未改**。

## DIFF-84（round-136 新登记并**已修**）标签预览的序号/尺寸标注字号算错了坐标系 + 毫米字段缺两位小数

**断言**：`app/scripts/ui-v140.cjs`（14/14 PASS，详见文末）。
（这一行刻意写在最前面：`tools/parity/audit-diffs.cjs` 的分块正则用了 `\z`，在 JS 里它匹配的是**字面量 `z`**
而不是字符串结尾，于是惰性匹配会在正文第一个 `z`（`previewAnnotation` 里的那个）处截断，
导致"断言"要素被判缺失。详见 `parity/backlog.md` 的本轮记录。）

**原版（有，且是每格都有的可见元素）**
- 真机 `parity/reference/labelshop/verifier-r43-choose-label.png`（选择标签格式）与
  `parity/reference/labelshop/round105-custom-label.png`（标签格式设置）里，预览**每格正中都有序号**
  （4行×2列 ⇒ 1…8，先行后列），**第一个格子上方有 `100mm`、右侧有 `70mm`**（红色尺寸线与箭头，竖排）。
- 真机**毫米字段是两位小数**：两个独立的控件值 dump 一致 ——
  `probe-round105-custom-label-values.txt` 与 `probe-round107b-hole-rect-values.txt`：
  `宽度(&W):`=`100.00`、`高度(&H):`=`70.00`、`列距(&P):`=`2.00`、`行距(&L):`=`2.00`；
  孔洞尺寸框切到「矩形」后是 `0.00`。列数/行数是整数（`2` / `4`，无小数）。

**复刻版（做了，但字号算错 ⇒ 屏幕上几乎看不见）**
- 序号与标注**本来就画了**（不是"缺失"）：`NewLabelDialog.tsx` 与 `CustomLabelFormatDialog.tsx` 都渲染了
  `<text>`。问题是**字号写成了 viewBox 单位**（4.5 / 4.2 / `unit*0.0xx`），
  而 viewBox 单位 ≠ 屏幕像素：「选择标签格式」的 viewBox 是 238 单位映射到 430px
  ⇒ 序号实际只有约 **4.8px**，「标签格式设置」只有约 **3.8px**，在截图上糊成一团。
  验收方 round-179/180 由并排图判成的「缺序号 / 缺尺寸标注」实为**同一根因**。
- 毫米输入框直接显示 draft 里的字符串 ⇒ `100` / `70` / `2`（真机 `100.00` / `70.00` / `2.00`）。

**处置**
1. 新增共享模块 `app/src/renderer/src/dialogs/previewAnnotation.ts`：字号**先按渲染像素算、再换算回 viewBox 单位**
   （`previewScale()` + `annotationFontSize()` + `previewAnnotationLayout()`），
   比例取真机量测值 `0.12 × 渲染出的格子高`，并设 9px 下限 / 17px 上限；
   **两个对话框共用同一份实现**，不再各写一套（防漂移）。
   留白改为跟着字号走（`2.2 × 字号`），否则字号变大后文字会被 viewBox 裁掉。
2. 竖排尺寸线移到**整张网格的右边**（真机 round105-custom-label.png：`70mm` 在第二列右侧，不是第一列右侧）。
3. 预览底改白（真机预览区是白底；复刻版原是 `#EFEFEF` / 对话框灰）。
4. 毫米字段按真机显示两位小数：`formatMmValue()` + `MmInput`（**编辑时显示原样、失焦后归一**，
   避免每敲一个字符都被格式化、光标乱跳）；列数/行数保持整数。

**断言**：`app/scripts/ui-v140.cjs`（**14/14 PASS**，已注册进 `run-regression.ps1`）——
值级断言：序号集合恰为 1..8、`100mm`/`70mm` 各一处、
**序号与标注的实际渲染像素字号 ≥ 9px**（旧实现 4.8px / 3.8px 必然红，用 `getScreenCTM()` 量真实缩放）、
字号 ≥ 0.09 × 格子渲染高（真机量测 0.10–0.13）、未被 viewBox 裁掉、
毫米字段 = `100.00`/`70.00`/`2.00`/`2.00`、列数行数 = `2`/`4`、孔洞尺寸 `0.00`。
命令：`MAXLABEL_UI_SCRIPT=ui-v140.cjs; npm run test:ui`。
连带迁移：`ui-v129.cjs` 的初始值断言由 `'100'`/`'70'` 改为 `'100.00'`/`'70.00'`（**加严，放宽强度为零**）。
复跑：`ui-v129` 17/17、`ui-v130` 17/17、`ui-v131` 16/16、`ui-v139` 7/7 —— 全 PASS。

**并排图**：`parity/review/cmp-custom-r136.png`（左＝真机 round105 × 右＝复刻版 commit 2476966）、
`parity/review/cmp-choose-r136.png`（左＝真机 round-43 × 右＝复刻版 commit 2476966）。

**仍未对齐（如实登记，不夸大）**：复刻版的预览 svg 像素盒固定为 210×185（「标签格式设置」）/
430×345（「选择标签格式」），比真机的预览区**小**，所以格子看着比真机紧凑；
真机预览区更大、留白更多。这条属**布局尺寸**差异，未在本轮改（改动会牵动对话框高度）。

## DIFF-85（round-136 登记并处置；**✅ 已结案 —— 三条均不改产品代码**。证据 = 真机原图三张：`probe-r112-sysset.png`（标题 `系统设置`）、`probe-15-cloudbox-port.png`（`类型(I):`）、`verifier-r44-hole-circle-20b.png`（底排 `确定/取消/帮助`）；验收方施工清单 C1/C3 系读图误判、C2 代码本已为 `类型(I):`）标题/文案类

验收方 `parity/验收方逐项比对-施工清单.md` 的 C 类给了三条「标题/文案小改」。本轮逐条回看**真机原图**，
结论如下（**证据以真机截图为准，不按清单描述改代码**）：

| # | 清单说法 | 真机原图实际 | 结论 |
| --- | --- | --- | --- |
| C1 | 系统设置标题应是 `系统选项`，复刻版 `系统设置` ✗ | 清单自己引的 `parity/reference/labelshop/probe-r112-sysset.png` **标题栏写的就是 `系统设置`**（菜单项才叫 `系统选项(C)...`） | **误判 → 复刻版正确，不改** |
| C2 | 端口页 `类型:` 漏括号字母，应是 `类型(T):` | `parity/reference/labelshop/probe-15-cloudbox-port.png` 上是 **`类型(I):`**（加速键 I，不是 T） | **加速键取 I**：代码里已是 `类型(I):`（`PrinterSettings.tsx`），本轮**无需改**；清单里的 `(T)` 是读图读错 |
| C3 | 标签格式设置底排多一个 `帮助`（真机只有 `确定/取消`） | `parity/reference/labelshop/verifier-r44-hole-circle-20b.png` 与 `round105-custom-label.png` 底排都是 **`确定 / 取消 / 帮助` 三个** | **误判 → 复刻版正确，不改**；若照清单删掉 `帮助` 反而是把真机有的按钮删掉 |

**处置**：三条**均不改产品代码**（C2 已是对的），只在本条台账留证，避免下一轮照清单误改。
另外 `ui-v130.cjs` 里那条「应用按钮按真机隐藏」的断言与真机一致（真机 `应用(&A)` 是 `[ ]` 隐藏控件），保持不变。

**证据**：`parity/reference/labelshop/probe-r112-sysset.png`（标题 `系统设置`）、
`parity/reference/labelshop/probe-15-cloudbox-port.png`（`类型(I):`）、
`parity/reference/labelshop/verifier-r44-hole-circle-20b.png`（底排 `确定/取消/帮助`）。
**断言**：本轮无新增断言（结论是"不改"，`ui-v130`/`ui-v139` 已有断言覆盖这三个对话框的文案）。

## DIFF-86（round-138 新登记并**已修**）对象属性「常规」页与真机的结构/文案差异

**类别**：原版有、复刻版**部分有**（结构不对 + 文案缺加速键 + 底排缺按钮）→ 本轮按真机控件树 dump 对齐。

**权威依据**：`parity/reference/labelshop/probe-44-two-objects-tree.txt`（真机「文字属性 → 常规」页控件树，
含 `[V]` 可见性与 `DISABLED` 启用态）。四条底排按钮行也在同一份 dump 里。

### 真机结构（逐条，来自 dump）

| 真机 class | 文案（逐字） | 启用态 | 复刻版本轮处置 |
| --- | --- | --- | --- |
| `Button`（组框） | `位置` | — | 新增分组框 `obj-group-position` |
| `Static`+`Edit`+`Static` | `水平(&H):` + `毫米` | 可用 | `obj-x` 标签改真机原文，补加速键 `H`，单位移到框后 |
| `Static`+`Edit`+`Static` | `垂直(&V):` + `毫米` | 可用 | `obj-y` 同上，加速键 `V` |
| `Button`（组框） | `对齐` | — | 新增分组框 `obj-group-align` |
| `Static`+`ComboBox` | `水平(&W):` | **DISABLED** | `obj-align-h` 标签改真机原文（原为"水平位置"），加速键 `W`；文字对象下禁用 |
| `Static`+`ComboBox` | `垂直(&T):` | **DISABLED** | `obj-align-v` 同上，加速键 `T` |
| `Button`（组框） | `颜色` | — | 新增分组框 `obj-group-color` |
| `Static`+`ComboBox` | `颜色(&C):` | 可用 | 保留（颜色模式，DIFF-72 已定案），补加速键 `C` |
| `Button` | `设置颜色` | **DISABLED** | 新增 `obj-set-color`，按真机**禁用** |
| `Button`（组框） | `其它` | — | 新增分组框 `obj-group-other` |
| `Static`+`ComboBox` | `旋转(&R):` | 可用 | 补加速键 `R` |
| `Static`+`ComboBox` | `镜像(&M):` | 可用 | 补加速键 `M` |
| `Static`+`ComboBox` | `背景(&B):` | 可用 | 补加速键 `B` |
| `Button` | `色彩反相(&E)` | **该状态下 `[ ]` 不可见** | **本轮未实现**（见下「未做项」） |
| `Button` | `位置锁定(&L)` | 可用 | 文案补加速键 `L`，渲染经 `displayMfcCaption` |
| `Button` | `不打印输出(&N)` | 可用 | 文案补加速键 `N` |
| `Static`+`Edit` | `对象名称标识：`（**全角冒号**） | 可用 | 新增 `obj-name`；模型加 `name?: string`（`objects.ts` + `document.ts` 归一化） |
| `Static`+`ComboBox` | `图层：`（**全角冒号**） | **DISABLED** | 新增 `obj-layer`，按真机**禁用** |
| `Static`+`Edit` | `对象附加说明(&C)` | 可用 | 移到「其它」组**之外**整行独占（真机 y=980 在组框 y∈[689,977] 之外），补加速键 `C` |
| `Button` ×4 | `确定` / `取消` / `应用(&A)` / `帮助` | `应用(&A)` 为 **`[ ]` 不可见**且 DISABLED | 底排改为整数组全等 = 确定·取消·帮助；`应用` 不渲染可见按钮 |

### 复刻版扩展（**明确标注，不静默保留**）

- 「常规」页底部的 `宽度（毫米）` / `高度（毫米）` 两个数值框：**真机「常规」页无此字段**（真机靠画布拖拽改尺寸）。
  已在 UI 上加 `data-testid=obj-general-extension` 区块并在每个字段的 hint 写明「复刻版扩展（真机「常规」页无此字段）」。
  **保留理由**：复刻版的精确数值改尺寸入口在文字对象上仅此一处（条码页的 `码高(&H):` 只覆盖高度）。
- 「颜色变化模式」之外的「变色设置」组（索引表来源/索引表/变量/粒度/区块行列）：属 DIFF-27 已收口的复刻版扩展，
  其模式入口仍是本页唯一的 `颜色(&C):`（`data-testid=color-change-mode`），未新增第二个模式下拉。

### 本轮未做（**明确记账，不用占位/假实现顶替**）

- `色彩反相(&E)`：真机该控件在本状态下 `[ ]` 不可见；且复刻版模型/渲染层**没有**颜色反相字段与实现
  （`objects.ts`/`renderLabel.ts` 全库无 invert 相关）。**不实现**——加一个无行为的复选框＝假实现，按验收方口径禁止。
  → 已记 `parity/backlog.md`：需先取证真机的显示条件（哪种对象类型/哪种模式下可见）与渲染效果，再决定实现或登记为受限。
- `图层：` 下拉：真机该状态下 DISABLED，复刻版按同一形态渲染（禁用、单一选项 `0`）。真机启用时它承载的是
  对象所在图层号；复刻版没有图层面板分层模型，故按「原版有但受限」登记（见 backlog）。

### 证据与断言

- 断言：`app/scripts/ui-v141.cjs` **21/21**（`MAXLABEL_UI_SCRIPT=ui-v141.cjs npm run test:ui`，已挂 `app/scripts/run-regression.ps1`）。
  含整数组全等四条（分组框 legend、分组框 testid、底排按钮）、启用态两条（对齐组 DISABLED、图层 DISABLED）、
  加速键接线一条（凡带 `data-access-suffix` 的控件其 `accessKey` 必须与后缀一致且 ≥ 8 处）。
- 真机证据：`parity/reference/labelshop/probe-44-two-objects-tree.txt`。
- 并排图：`parity/review/cmp-propsgeneral-r151.png`（左=真机 `parity/reference/labelshop/r88-textprops-p4.png`，
  右=复刻版 round-151 构建的常规页）—— 本轮改动前的同态图，本轮后的复刻侧需重抓（已记 backlog）。
- 矩阵：B-52 / B-53 / B-54 / B-55 / B-56 / B-57 行的证据列已补本轮结论。

### round-139 追加：本页重构引发的断言迁移（**产品正确、脚本按新结构迁移，断言强度不降**）

round-138 门禁红 4 条：`ui-v71` / `ui-v78` / `ui-v89` / `ui-v105`。复核结论：**不是产品回归**，
而是底排顺序改成真机口径（`确定` / `取消` / `帮助`，probe-44）后，三个脚本仍用"点最后一个按钮"当确定 ——
`at(-1)` 落到了新出现的 `帮助` 上（`onHelp` → `setModal('help')`，属性对话框被换掉、草稿未提交）；
`ui-v105` 则按标签文字 `X（毫米）` 找输入框，而该字段已按真机改名 `水平(&H):`。

| 脚本 | 改动 | 强度 |
| --- | --- | --- |
| `ui-v71.cjs` / `ui-v78.cjs` / `ui-v89.cjs` | `confirmProps()` 由 `buttons.at(-1).click()` 改为 `[data-testid=object-props-ok]`，**按钮缺失即 throw**（原来是静默点到别的按钮） | ↑ 加严 |
| `ui-v105.cjs` | 按标签文字找 `X（毫米）` → 改为 `[data-testid=obj-x]`，顺带要求该字段在常规页存在 | ↑ 加严 |

底排按钮顺序本身已由 `ui-v141.cjs` 的"整数组全等 = [确定, 取消, 帮助]"钉住，故本次无需新增断言。
复跑（round-139 单脚本实跑）：`ui-v71` 21/21、`ui-v78` 10/10、`ui-v89` 4/4、`ui-v105` 14/14，全绿。
