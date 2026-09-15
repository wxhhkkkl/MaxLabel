# Parity 攻坚队列（按优先级取活）

规则：每轮从**同一个模块**取 3-6 条做完做透；做完勾掉并把证据写进 `matrix.md`。新发现的缺口补到对应模块下，写明来源（帮助文档文件 / 真机截图名 / 代码位置）。

真机编辑态参考截图：`parity/reference/labelshop/40-editor.png`（主框架）、`31-wizard-2.png`（选择标签格式）、`30-wizard-1.png`（模板向导）。
真机起始页：`00-main.png`；菜单弹窗：`menu-file.png`/`menu-view.png`/`menu-help.png`/`menu-option.png`/`menu-account.png`/`menu-cloud.png`。

---

## P0-A 主界面框架与操作习惯（对应 matrix 章节 A）

- [ ] A1 编辑态菜单栏 12 项与顺序对齐：`文件(F) 编辑(E) 查看(V) 工具(T) 排列(A) 数据库(D) 账户(A) 云马通(C) 选项(O) 窗口(W) 帮助(H) 建议与反馈`（原版见 `40-editor.png`；无文档时只显示前若干项，需按上下文切换）
- [ ] A2 主工具栏（第 1 行）按钮分组与顺序对齐原版（文件/编辑/历史/打印区/对象工具/数据库/显示/帮助，逐组核对图标语义与 tooltip）
- [ ] A3 格式栏（第 2 行）：字体下拉、字号、粗体/斜体/下划线/颜色、对齐、边框等，逐项接线
- [ ] A4 对齐栏（第 3 行）：对齐/旋转/尺寸/居中/间距/顺序/位置，逐项接线
- [x] A5 状态栏字段与顺序：打印机名 | 标签规格 | 使用数据库状态 | 图标区 | 缩放百分比（原版见 `40-editor.png`/`44-statusbar.png`；round-07 已按六段顺序收口）
- [x] A6 左侧对象/图层面板与右侧打印面板（参数设置/打印服务器/帮助 三页签 + 输入数据 + 打印数量/单签拷贝/打印）结构对齐（round-07 已由 ui-v53 与 `02-editor.png` 验证）
- [ ] A7 起始页布局对齐原版（账户区、优惠券/待支付/待收货计数、标签商城/新手入门、开始列表、客服、最近；右侧重要通知与签赋学堂等内容区）
- [ ] A8 无文档 vs 有文档两种上下文下的菜单/工具栏可用性差异（原版会裁剪菜单项）
- [ ] A9 快捷键全量：以 `shortcut_main.html` 为准逐条实现（含 Ctrl+N/O/S/P/W、Ctrl+Z/Y、Ctrl+A/T、Tab、Ctrl+C/V/X、Shift+Delete、Delete、Alt+Enter、Ctrl+G/U/L/B、方向键 0.5mm/Shift 5mm、Ctrl++/-、Ctrl+Alt+0、空格拖动）
- [ ] A10 未保存关闭流程（保存/不保存/取消，取消必须终止整个关闭动作）与多标签页流程
- [ ] A11 右键上下文菜单（画布/对象/标签页三处，原版见 `menu_context.html`）

## P0-B 编辑器对象能力（对应 matrix 章节 B）

- [x] B1 文字对象属性页各页签（内容/字体/数据/格式化等）字段与默认值对齐
- [x] B2 条码对象属性页：码制列表与每种码制的专有页签（128/39/93/Codabar/EAN13/EAN8/UPC/ITF14/ITF25/Matrix25/RSS/QR/DataMatrix/PDF417/汉信码/中国邮政码）
- [x] B3 RFID 对象属性页（EPC/USER/TID 区、锁定）；证据：round-24 ui-v71.cjs + B6-rfid-tab.png
- [x] B4 图形对象（矩形/椭圆/直线/斜线）属性页；证据：round-24 ui-v71.cjs + B5-rect-tab.png
- [x] B5 图片对象属性页（来源、缩放方式、单色/抖动）；证据：round-24 ui-v71.cjs
- [x] B6 表格对象（行列、单元格合并、边框）；证据：`ObjectPropsDialog.tsx`/`table.ts`/`fabricObjects.ts`、`ui-v76.cjs` 4/4、`B76-table-props.png`
- [x] B7 对象创建方式：工具栏工具 + 画布拖放区域（文字/条码/线/矩形/椭圆/图片/表格/RFID）；证据：round-24 ui-v71.cjs
- [ ] B8 选择/移动/缩放/旋转（鼠标与键盘微移）
- [ ] B9 对齐/排列/组合/层次/位置全套命令
- [x] B10 对象级格式化与子串截取

### round-29 B 排列对齐簇

- [x] B-19/B-20：对齐以首个蓝色句柄对象为参考，多选对象相对标签居中按视觉并集整体平移；实现 `operations.ts`，模型回归 `editor-operations.test.ts`，端到端回归 `ui-v75.cjs`。
- [x] B-24/B-26：三对象间距保持首尾边界且等距，多选按视觉并集中心左旋90°；实现 `operations.ts`，模型回归 `editor-operations.test.ts`，端到端回归 `ui-v75.cjs`。

### round-30 B 尺寸把柄与表格簇
- [x] B-15/B-16：条码尺寸按 0.1 毫米步长离散；SHIFT 角把柄使矩形成正方形；文字中间把柄可长扁、角把柄保持比例。证据：`resizeBehavior.ts`/`LabelEditor.tsx`、`editor-operations.test.ts` 27/27、`ui-v76.cjs` 4/4、`B76-table-handles.png`。
- [x] B-43：表格属性提供行列/边框、合并单元格；明确禁止在单元格直接排入文字/条码；渲染与打印沿用 `merges`。证据：`ObjectPropsDialog.tsx`/`table.ts`/`fabricObjects.ts`、`ui-v76.cjs` 4/4、`B76-table-props.png`。

### round-31 B 条码码制与特殊选项簇
- [x] B-68/B-70：码制下拉 18 项按帮助顺序排列，特殊选项按码制切换并保留 Code128 独立页签。证据：`ui-v77.cjs`、`ObjectPropsDialog.tsx`、`B77-barcode-code128-options.png`。
- [x] B-74/B-75：Code128 的 GS1/EAN-128、`^1` FNC1 说明及自动/A/B/C/手动字符集入口和默认值。证据：`ui-v77.cjs`、`barcode.ts`、`B77-barcode-code128-options.png`。
- [x] B-85：QR Code 特殊选项含 GS1、纠错级别、ANSI/UTF-8 编码与图标区域。证据：`ui-v77.cjs`、`B77-barcode-code128-options.png`。
- [ ] B-69 余项：企业版「缩减量」未提供；当前按帮助中“企业版以上可用”的版本边界保留为部分，证据 `ui-v77.cjs` 已覆盖其余尺寸字段。

- [x] DIFF-13 对象属性入口：双击对象与 Alt+Enter 打开模态属性对话框，关闭后保留选中；证据 `app/scripts/ui-v57.cjs` 8/8 + `app/scripts/ui-v73.cjs` 3/3（含非 100% 缩放、工作区滚动、直接向监听容器派发）、`parity/reference/maxlabel/B1-text-placed.png`、`B2-text-props.png`

本轮新增缺口：

### round-27 已收口

- [x] DIFF-24 工具栏禁用规则：未连库时数据库七键禁用；未选中对象时组合/取消组合禁用；选中两个对象后组合可用。证据 `editorAvailability.ts`、`Toolbar.tsx`、`FormatBar.tsx`、`labelShopMenus.ts`、`editor-operations.test.ts` 32 项、`ui-v74.cjs` 10/10、`DIFF24-toolbar-disabled.png`

- [x] DIFF-25 颜色索引表：补齐颜色索引/颜色/RGB颜色值/十六进制四列表格与增删行，支持颜色名和 `#RRGGBB`。证据 `ObjectPropsDialog.tsx`、`ui-v74.cjs` 10/10（含公共表编辑）、`DIFF25-color-index-table.png`

- [x] DIFF-26 自动旋转输出页面：系统选项持久化，并接入预览、正式打印和指令导出共享打印场景。证据 `OptionsDialog.tsx`、`prepareDocumentForPrint`、`print-engine.test.ts` 93 项（ResolvedPrintScene + TSPL）、`ui-v74.cjs` 10/10、`DIFF26-auto-rotate-options.png`
- [x] DIFF-18 RFID 属性页：五组独立访问控制、Access/Kill 随机生成、默认十六进制，并让右侧 RFID 选项与模态页同步。证据 ObjectPropsDialog.tsx、PropertyPanel.tsx、ui-v78.cjs 10/10、B6-rfid-tab.png
- [x] DIFF-19/20 文字与条码属性页命名：行宽度/毫米行距、字体宽度缩放倍数/字间距、Symbol/楷体/仿宋及供人识读字符原文字段。证据 ObjectPropsDialog.tsx、FormatBar.tsx、BarcodeDataFields.tsx、ui-v78.cjs 10/10
- [ ] B2 后续：PDF417 的列数/层高、条码颜色与透明背景还需逐一核对 TSPL/ZPL/CPCL 指令降级行为；来源 `label_object_page_barcode_pdf417.html`、`label_object_page_general.html`，当前属性模型已保存这些值。
- [ ] B1 后续：字体宽度比例与字符间距的打印机内建字体限制尚未按具体驱动逐项核验；来源 `label_object_page_font.html`、`label_object_text.html`。

## P0-C 数据源与数据库（对应 matrix 章节 C）

- [x] C1 数据源对话框结构与 7 类变量入口对齐
- [x] C2 常量 / 日期 / 时间 / 键盘输入 变量参数与默认值（round-13 补齐键盘提示、输入方式和打印开始时输入流程；证据 `datasource_type_keyboard.html`、`DataSourceEditor.tsx`、`TransientModals.tsx`、`ui-v59.cjs`、`C6-data-source-keyboard.png`）
- [x] C3 序列号变量（前缀/起始/步长/位数/重复/打印后推进/回写模板）
- [x] C4 数据库字段变量与绑定（round-13 收口 C18–C21：字段名选择、单标签记录偏移、当前记录画布预览、变化标签首选数据库；证据 `datasource_type_database.html`、`DataSourceEditor.tsx`、`LabelEditor.tsx`、`App.tsx`、`datasource.ts`、`print-engine.test.ts`、`ui-v59.cjs`、`C5-data-source-database.png`）
- [x] C5 脚本变量（已收口 C26–C30：VBScript/JavaScript 安全表达式、模板生命周期、V_TOTALLABELS 与全局变量；证据 `datasource_type_script.html`、`datasource.ts`、`scene.ts`、`printPreviewService.ts`、`printExecutor.ts`、`print-engine.test.ts`、`ui-v60.cjs`、`C7-data-source-script.png`）
- [ ] C6 变量高级功能：子变量、截取、控制字符、长度控制（C37–C47 已收口；后续继续核对帮助中未拆成矩阵条目的比例/小数位细节）
- [ ] C7 数据导入：CSV / 制表符文本 / Excel（xlsx）（已收口 C48、C70–C72、C77–C78、C81–C82；ODBC 已补连接/认证/表查询入口，云端数据库四步引导已补但表字段回传和实际导入仍待云服务 IPC，来源 `database_import_cloud.html`、证据 `C24-cloud-database-workflow.png`）
- [ ] C8 ODBC / SQL 连接管理（已收口 C56、C58–C59、C73–C74：驱动配置、Windows/SQL Server 认证、服务器/数据库/表/SQL、连接列表、多连接选项；真实驱动连接、SQL Server 表查询和打印前刷新仍待硬件/环境核对，来源 `database_import_odbc.html`、证据 `C22-odbc-workflow.png`、`C23-odbc-connection-defaults.png`）
- [ ] C13 云模板元数据与权限（C79–C80 仍部分：共享用户库/组库分类、关键字和描述尚未接入云服务协议；来源 `label_label_shareas.html`、`label_label_saveas.html`）
- [x] C9 打印时数据集推进与重复检查（本轮收口 C-60～C-69：数据库记录导航、打印数量/单签拷贝/起始记录、高级数据库打印 3 项、定位四方向与模糊查找；证据 `database_print*.html`、`PrintDialog.tsx`、`MoreDialogs.tsx`、`printExecutor.ts`、`ui-v62.cjs`、`C12-database-locator.png`、`C13-database-print-dialog.png`）
- [x] C10 标签格式设置页面/打印机/其它页签（收口 C-90～C-101：预定义页只读、自定义纸张/A4、打印方式、起始位置/首选方向/偏移、用户格式命名保存和回开；依据 `label_page_page.html`、`label_page_printer.html`、`label_page_other.html`，实现 `TemplatePropsDialog.tsx`、`document.ts`、`layout.ts`，回归 `ui-v70.cjs` 15/15，证据 `C18-label-format-tabs.png`、`C19-label-format-page.png`、`C20-label-format-other.png`）
- [x] C11 查看比例与标签旋转（收口 C-85/C-86：工具栏/查看菜单/状态栏比例控件，以及标尺箭头旋转页面；证据 `ui-v79.cjs` 6/6、`C21-view-scale-rotation.png`）
- [x] C12 查看比例/标签旋转四种模式（收口 C-87/C-88/C-89：工具栏、查看菜单、状态栏比例入口及正常/左旋90/右旋90/旋转180；证据 `ui-v79.cjs` 6/6、`C21-view-scale-rotation.png`）

本轮已完成：C-60/C-61/C-62/C-63/C-64/C-65/C-66/C-67/C-68/C-69。数据库记录导航与定位查找按 `database_print.html`、`database_print_search.html` 逐项实现；打印范围与高级选项按 `database_print_start.html`、`database_print_copy.html` 接线。证据见 `parity/matrix.md`、`app/scripts/ui-v62.cjs`、`tools/parity/scenarios/database-print-flow.json`、`parity/reference/maxlabel/C12-database-locator.png`、`C13-database-print-dialog.png`。

## P0-D 打印链路（对应 matrix 章节 D）

- [x] D1 打印对话框（`print_dlg_main.html`）：字段、默认值、按钮；`ui-v63.cjs` 10/10，`print-dialog-check.json` missingCount=0，证据 `D1-print-dialog.png` / `D2-print-advanced-*.png`
- [x] D2 打印机配置（指令集/端口/分辨率/属性：速度、浓度、热敏/热转印、标签类型、顶部偏移、介质处理、出纸回退）；`PrinterSettings.tsx` + `ui-v63.cjs` 12/12，证据 `D3-printer-properties.png` / `D3-printer-port.png`
- [x] D3 打印预览（缩放、翻页、拼版）；预览入口由 `PrintDialog.tsx` 接入 `usePreviewWorkflow`，统一使用 `ResolvedPrintScene`；证据 `D4-print-preview.png`，独立预览窗口实现见 `printPreviewService.ts` / `previewWindow.ts`
- [x] D4 测试打印（1 张、不写日志、不推进序列号）；`print-engine.test.ts` 真实执行 `executePrint(test, …)` 断言命令一次、日志零次、序列号回写零次
- [x] D5 打印日志（JSONL、查看/清理入口）；`PrintHistoryDialog.tsx` + `registerLogIpc.ts`，CSV 表头回归覆盖 `print_printlog.html` 保存项目，已有 `ui-v49.cjs` 历史对话框断言
- [x] D6 打印数量 × 单签拷贝、序列号与数据集推进顺序；`app/src/shared/print/plan.ts` 统一生成逻辑/物理标签数与序列号推进数，`app/scripts/print-engine.test.ts` 覆盖 D-46/D-47。
- [x] D7 TSPL / ZPL / CPCL 指令输出与快照；保留 `app/fixtures/protocol/*.prn`，新增 `app/fixtures/protocol/protocol-snapshots.json` 与 `test:print` SHA-256/关键指令回归。
- [x] D8 拼版/多标签（行列、间距、顺序、起点、偏移）；共享 `app/src/shared/print/layout.ts` 的 `pageCells` 与 `resolvePrintPlanPageScene`，`app/scripts/print-engine.test.ts` 覆盖列式/右下起点/偏移并集。

### round-36 D 打印计划与命令输出

- [x] D-46/D-47：数据库启始记录、打印数量/单签拷贝、序列号推进与物理数量已由统一 `PrintPlan` 固化；证据 `app/scripts/print-engine.test.ts` D-46/D-47 断言。
- [x] D-55：命令/文件输出对话框显示命令模式，并禁用页式打印起始标签与自动跟踪；证据 `app/scripts/ui-v80.cjs` 4/4、`parity/reference/maxlabel/D11-command-output-dialog.png`。
- [x] D-7/D-8：三协议快照和多标签布局参数回归已加入 `test:print`；来源 `print_dlg_main.html`、`print_summary.html`，实现 `app/src/shared/print/engine.ts`、`layout.ts`。

### round-19 D 打印机首选项簇

- [x] D-09/D-10/D-12/D-15/D-17/D-18/D-19/D-20：打印速度、打印浓度、打印方式、标签类型、顶部偏移、介质处理、出纸回退与保存为默认值。依据 `print_printer_cfg_main.html`；实现 `app/src/renderer/src/dialogs/PrinterSettings.tsx`、`app/src/shared/domain/printer.ts`、`app/src/shared/print/tspl.ts`；回归 `app/scripts/ui-v64.cjs`、`app/scripts/print-engine.test.ts`；证据 `parity/reference/maxlabel/D6-printer-preferences.png`。
- [x] D-24/D-25/D-26/D-27/D-28/D-29：端口六类配置已按 `print_printer_cfg_port.html` 收口；USB/Windows 驱动端口支持系统打印机选择与刷新，TCP/LPT/COM 有条件字段和保存前校验，蓝牙使用系统 SPP 虚拟 COM 端口；回归 `app/scripts/ui-v69.cjs` 9/9、`print-engine.test.ts`，证据 `D10-printer-port-usb.png` / `D10-printer-port-tcp.png` / `D10-printer-port-bluetooth.png` / `D10-printer-port-lpt.png` / `D10-printer-port-com.png` / `D10-printer-port-driver.png`。
- [x] D-57/D-58：打印时输入数据对话框、回车确认、取消/帮助流程已收口；`TransientModals.tsx` + `ui-v66.cjs` 3/3，证据 `D9-print-time-input.png`，来源 `print_dlg_input.html`。
- [x] D-68：打印时数据查重入口与按数据指纹去重已接通；依据 `print_dupcheck.html`，实现 `PrintAdvancedDialog.tsx` / `printExecutor.ts` / `print-plan.ts`，回归 `ui-v65.cjs` 与 `print-engine.test.ts`，证据 `D7-print-advanced-dupcheck.png`。

### round-20 D 条码图片导出簇

- [x] D-69：条码右键「导出(E)...」与 Ctrl+E 共用「导出条码图片文件」窗口；实现 `labelShopMenus.tsx` / `App.tsx` / `ExportModal.tsx`，回归 `ui-v67.cjs` 7/7，证据 `D8-barcode-export.png`，来源 `print_extractpic.html`。
- [x] D-70：输出目录、`目录...` 选择器与写入路径校验；实现 `ExportModal.tsx` / `main/index.ts`，回归 `ui-v67.cjs`，证据 `D8-barcode-export.png`，来源 `print_extractpic.html`。
- [x] D-71：条码内容/流水号文件名、前缀和扩展名示例；实现 `ExportModal.tsx`，回归 `ui-v67.cjs`，证据 `D8-barcode-export.png`，来源 `print_extractpic.html`。
- [x] D-72：屏幕显示/打印输出、目标 DPI 与 300 DPI 限制；实现 `ExportModal.tsx`，回归 `ui-v67.cjs`，证据 `D8-barcode-export.png`，来源 `print_extractpic.html`。
- [x] D-73：放大倍数默认 3 并参与预览位图尺寸；实现 `ExportModal.tsx`，回归 `ui-v67.cjs`，证据 `D8-barcode-export.png`，来源 `print_extractpic.html`。
- [x] D-74：条码缩减、左右/上下边空及预览宽高；实现 `ExportModal.tsx`，回归 `ui-v67.cjs`，证据 `D8-barcode-export.png`，来源 `print_extractpic.html`。
- [x] D-75：导出数量默认 10、范围 1–99999、批量 BMP/PNG 输出；实现 `ExportModal.tsx` / `main/index.ts`，回归 `ui-v67.cjs`，证据 `D8-barcode-export.png`，来源 `print_extractpic.html`。

## P1-E 其他（对应 matrix 章节 E）

- [ ] E1 选项/配置对话框（`config_general.html`）各项
- [ ] E2 帮助菜单（联机帮助 CHM、在线教程、关于、建议与反馈）
- [ ] E3 云模板/共享模板/授权激活界面
- [ ] E4 安装/升级/注册相关界面（非阻塞）

---

## P0-A2 起始页精修（依据 `parity/reference/labelshop/START-PAGE-SPEC.md`，证据 `00-main.png`）

- [x] A12 左栏布局按规格：宽 220px 白底，账户区（80×80 圆形头像 + `未登录` + 三个计数格 `0/优惠券`、`0/待支付订单`、`0/待收货订单` + `标签商城`/`新手入门` 蓝底 #4DB8FF 按钮，各 40% 宽 30px 高）；证据：`app/scripts/ui-v54.cjs`、`parity/reference/maxlabel/00-main.png`
- [x] A13 `开始` 列表按原版（**原文用「模版」不是「模板」**）：`客服1QQ：1669809392` / `客服2QQ：3395913685` / `客服电话：4000-987-360` / `新建标签模版` / `打开标签模版` / `打开本机模版` / `下载云马通APP`(橙色 #ff6600)；`开始` 标题行右侧橙色 `云马通首页`；证据：`app/scripts/ui-v54.cjs`
- [x] A14 客服三行：`客服1QQ：1669809392`、`客服2QQ：3395913685`、`客服电话：4000-987-360`（原版在 `开始` 列表内，无独立容器）；证据：`StartPage.tsx`、`app/scripts/ui-v54.cjs`、`parity/review/real-startpage-left.png`
- [x] A15 `最近` 列表接本地最近文件（数据源 `RecentFile`，兼容原版记录字段），点击走 `LabelShop:OpenDocument:<路径>`；空态与折叠行为按规格；证据：`useRecentTemplates.ts`、`StartPage.tsx`、`app/scripts/ui-v54.cjs`
- [x] A16 起始页自定义协议入口全部接线：`LabelShop:NewDocument` / `OpenDocument` / `OpenDocument:<路径>` / `OpenLocal` / `OpenCodingV` / `OpenULogin:<URL>` / `OpenUrl:<URL>` / `labelshop:UserLogin`；证据：`StartPage.tsx`、`App.tsx`、`app/scripts/ui-v54.cjs`
- [x] A17 右区内容块结构：顶部广告位（远程位图，**等价代替**自制素材）+ `最新文章` + 下载块；运营图文文案无法从本地取证，矩阵里注明「等价替代」；证据：`StartPage.tsx`、`styles.css`、`app/scripts/ui-v54.cjs`
- [x] A18 去掉复刻版自造的 `MaxLabel` 品牌标题行（原版是头像图 + `未登录`）；证据：`app/scripts/ui-v54.cjs`、`parity/reference/maxlabel/00-main.png`
- [ ] A19 登录态账号名与会员计数仍为固定未登录/0，待接账号服务数据；来源：`parity/reference/labelshop/START-PAGE-SPEC.md` §2.A、§4
- [ ] A20 顶部运营位仍为 CSS 等价自制素材，运行时远程位图 URL 未取证；来源：`parity/reference/labelshop/START-PAGE-SPEC.md` §3.4、§7

## P0-B2 选择标签格式 / 标签格式设置（依据 `LABEL-FORMAT-SPEC.md`，证据 `60`/`61`）

- [x] B11 标签品牌枚举 2 项：`京成云马标签`(225 条) / `普林泰科标签`(50 条)；证据 `labelFormats.generated.ts`、`label-formats.test.ts`、`ui-v72.cjs`
- [x] B12 标签类型枚举按品牌过滤的 `CateName`（共 17 个分类；注意**不是** `Label_Type` 整数 0/1）；证据 `NewLabelDialog.tsx`、`label-formats.test.ts`、`ui-v72.cjs`
- [x] B13 标签名称 275 条按原顺序与原文（**不要 Trim、不要归一化全角 ×、损坏的 `?` 照抄**），格式 `<Name> | W×H mm | Cols×Rows | 角 | 页/盒`；证据 `labelFormats.generated.ts`、`generate-label-formats.cjs`、`label-formats.test.ts`
- [x] B14 只读信息行精度差异照抄：`纸张：  210 毫米 X 297 毫米`（整数毫米）、`标签：  100.00 毫米 X 70.00 毫米`（两位小数）；证据 `ui-v72.cjs`、`DIFF12-choose-label.png`
- [x] B15 `标签格式设置` 对话框页签 `打印机/页面/标签/其它`，默认停在 `标签` 页；字段默认值见 `FINDINGS.md` 第 10 条；选择入口与设置页已分离，证据 `C18-label-format-tabs.png`、`C19-label-format-page.png`、`C20-label-format-other.png`
- [x] B16 底部按钮顺序 `选择(Q)`/`自定义(N)`/`取消(C)`/`帮助(H)`，`选择(Q)` 为默认按钮；证据 `ui-v72.cjs`、`DIFF12-choose-label.png`

## 已识别差异（收口后勾掉，细节写进 parity/diffs.md）

- [ ] DIFF-1 复刻版菜单栏文案「云服务(C)」与真机「云马通(C)」不一致
- [ ] DIFF-2 复刻版起始页内容区是简化版，缺原版的「重要通知/签赋学堂/标签商城/各类不干胶标签」内容块与客服/最近区结构
- [x] DIFF-3 已补「模板向导 → 选择标签格式」两步新建流程；四个选项、默认新建、打开文件、帮助/教程等价动作及 userData 跳过设置由 `app/scripts/ui-v55.cjs` 覆盖，原版证据 `30-wizard-1.png`/`31-wizard-2.png`
- [ ] DIFF-4 真机状态栏含「共 x 页/y 页/盒」规格串与数据库字段；复刻版为「未打开标签模板/未使用数据库」文案，需逐字段对齐
- [x] DIFF-6 状态栏标签规格已按整数/去尾零、布局形状与 rows×cols 枚数显示；页/盒仅来自标签格式数据 `layout.pagesPerBox`（ui-v53 + `44-statusbar.png`）
