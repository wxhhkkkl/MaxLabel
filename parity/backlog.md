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
- [ ] B3 RFID 对象属性页（EPC/USER/TID 区、锁定）
- [ ] B4 图形对象（矩形/椭圆/直线/斜线）属性页
- [ ] B5 图片对象属性页（来源、缩放方式、单色/抖动）
- [ ] B6 表格对象（行列、单元格合并、边框）
- [ ] B7 对象创建方式：工具栏工具 + 画布拖放区域（文字/条码/线/矩形/椭圆/图片/表格/RFID）
- [ ] B8 选择/移动/缩放/旋转（鼠标与键盘微移）
- [ ] B9 对齐/排列/组合/层次/位置全套命令
- [x] B10 对象级格式化与子串截取

- [x] DIFF-13 对象属性入口：双击对象与 Alt+Enter 打开模态属性对话框，关闭后保留选中；证据 `app/scripts/ui-v57.cjs` 7/7、`parity/reference/maxlabel/B1-text-placed.png`、`B2-text-props.png`

本轮新增缺口：

- [ ] B2 后续：PDF417 的列数/层高、条码颜色与透明背景还需逐一核对 TSPL/ZPL/CPCL 指令降级行为；来源 `label_object_page_barcode_pdf417.html`、`label_object_page_general.html`，当前属性模型已保存这些值。
- [ ] B1 后续：字体宽度比例与字符间距的打印机内建字体限制尚未按具体驱动逐项核验；来源 `label_object_page_font.html`、`label_object_text.html`。

## P0-C 数据源与数据库（对应 matrix 章节 C）

- [x] C1 数据源对话框结构与 7 类变量入口对齐
- [x] C2 常量 / 日期 / 时间 / 键盘输入 变量参数与默认值（round-13 补齐键盘提示、输入方式和打印开始时输入流程；证据 `datasource_type_keyboard.html`、`DataSourceEditor.tsx`、`TransientModals.tsx`、`ui-v59.cjs`、`C6-data-source-keyboard.png`）
- [x] C3 序列号变量（前缀/起始/步长/位数/重复/打印后推进/回写模板）
- [x] C4 数据库字段变量与绑定（round-13 收口 C18–C21：字段名选择、单标签记录偏移、当前记录画布预览、变化标签首选数据库；证据 `datasource_type_database.html`、`DataSourceEditor.tsx`、`LabelEditor.tsx`、`App.tsx`、`datasource.ts`、`print-engine.test.ts`、`ui-v59.cjs`、`C5-data-source-database.png`）
- [x] C5 脚本变量（已收口 C26–C30：VBScript/JavaScript 安全表达式、模板生命周期、V_TOTALLABELS 与全局变量；证据 `datasource_type_script.html`、`datasource.ts`、`scene.ts`、`printPreviewService.ts`、`printExecutor.ts`、`print-engine.test.ts`、`ui-v60.cjs`、`C7-data-source-script.png`）
- [ ] C6 变量高级功能：子变量、截取、控制字符、长度控制（本轮已收口 C37–C47：控制字符 1–31、双左尖括号转义、子串图标/样本/编辑排序、共享变量、电子称配置；剩余 C48–C50 仍待核）
- [ ] C7 数据导入：CSV / 制表符文本 / Excel（xlsx）
- [ ] C8 ODBC / SQL 连接管理（多连接、测试连接、查询导入、打印前刷新）
- [ ] C9 打印时数据集推进与重复检查

本轮已完成：C-37/C-38/C-39/C-41/C-42/C-43/C-44/C-45/C-46/C-47；C-55 与 DIFF-16 已在同轮先行完成。证据见 `parity/matrix.md`，实现与回归见 `app/src/shared/domain/datasource.ts`、`app/src/renderer/src/dialogs/DataSourceEditor.tsx`、`app/scripts/print-engine.test.ts`、`app/scripts/ui-v60.cjs`。

## P0-D 打印链路（对应 matrix 章节 D）

- [ ] D1 打印对话框（`print_dlg_main.html`）：字段、默认值、按钮
- [ ] D2 打印机配置（指令集/端口/分辨率/属性：速度、浓度、热敏/热转印、标签类型、顶部偏移、介质处理、出纸回退）
- [ ] D3 打印预览（缩放、翻页、拼版）
- [ ] D4 测试打印（1 张、不写日志、不推进序列号）
- [ ] D5 打印日志（JSONL、查看/清理入口）
- [ ] D6 打印数量 × 单签拷贝、序列号与数据集推进顺序
- [ ] D7 TSPL / ZPL / CPCL 指令输出与快照
- [ ] D8 拼版/多标签（行列、间距、顺序、起点、偏移）

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

- [ ] B11 标签品牌枚举 2 项：`京成云马标签`(225 条) / `普林泰科标签`(50 条)
- [ ] B12 标签类型枚举按品牌过滤的 `CateName`（共 17 个分类；注意**不是** `Label_Type` 整数 0/1）
- [ ] B13 标签名称 275 条按原顺序与原文（**不要 Trim、不要归一化全角 ×、损坏的 `?` 照抄**），格式 `<Name> | W×H mm | Cols×Rows | 角 | 页/盒`
- [ ] B14 只读信息行精度差异照抄：`纸张：  210 毫米 X 297 毫米`（整数毫米）、`标签：  100.00 毫米 X 70.00 毫米`（两位小数）
- [ ] B15 `标签格式设置` 对话框页签 `打印机/页面/标签/其它`，默认停在 `标签` 页；字段默认值见 `FINDINGS.md` 第 10 条
- [ ] B16 底部按钮顺序 `选择(Q)`/`自定义(N)`/`取消(C)`/`帮助(H)`，`选择(Q)` 为默认按钮

## 已识别差异（收口后勾掉，细节写进 parity/diffs.md）

- [ ] DIFF-1 复刻版菜单栏文案「云服务(C)」与真机「云马通(C)」不一致
- [ ] DIFF-2 复刻版起始页内容区是简化版，缺原版的「重要通知/签赋学堂/标签商城/各类不干胶标签」内容块与客服/最近区结构
- [x] DIFF-3 已补「模板向导 → 选择标签格式」两步新建流程；四个选项、默认新建、打开文件、帮助/教程等价动作及 userData 跳过设置由 `app/scripts/ui-v55.cjs` 覆盖，原版证据 `30-wizard-1.png`/`31-wizard-2.png`
- [ ] DIFF-4 真机状态栏含「共 x 页/y 页/盒」规格串与数据库字段；复刻版为「未打开标签模板/未使用数据库」文案，需逐字段对齐
- [x] DIFF-6 状态栏标签规格已按整数/去尾零、布局形状与 rows×cols 枚数显示；页/盒仅来自标签格式数据 `layout.pagesPerBox`（ui-v53 + `44-statusbar.png`）
