# 本轮任务队列（按顺序取第一项**尚未完成**的来做）

**模块推进节奏（重要）**：第 2 项（C 数据源与数据库）与第 4 项（D 打印链路）**交替推进**——本轮做 C 就在 C 里收口 6-10 条，下一轮换 D 收口 6-10 条，再回 C，如此轮换，直到两项都收口；其余项（第 3、5、6 项）在轮换间隙按需插入。**理由**：验收方记分卡显示 D 章节长期 0% 会成为整体达标瓶颈（`parity/SCORECARD.md` 可随时查看各章节覆盖率）。第 7 项（E 其他，16 条）体量小，可在任一轮顺带做完。

**当前覆盖率基线（验收方记分卡 `parity/SCORECARD.md`）**：A 30% / B 9% / C 33% / D 0% / E 0%，合计 21%；未收口差异 5 条（DIFF-11/12/14/15/16）。

判断"已完成"的依据：`parity/diffs.md` 对应行已标 ✅、`parity/matrix.md` 对应条目已标 `已实现` 且有证据（测试名+截图名）、相关 UI 断言挂在 `app/scripts/run-regression.ps1` 里并通过。**每轮只做一项**，做完更新台账再提交；若某项被上一步做完，直接进下一项，不要重复劳动。

先看 `parity/FAILURES.md`：非空则本轮唯一任务是修它。

---

## 第 1 项：DIFF-13 对象属性交互方式（模态属性对话框）

原版行为：**双击对象 = 打开该对象的属性对话框**（帮助 `label_object_edit.html`；真机状态栏提示原文「选取对象、移动对象，双击修改对象属性」），`Alt+Enter` 是同一入口。属性界面是**模态对话框**，页签按对象类型不同，页签名以帮助原文为准（通用 `label_object_page_general.html` / 文字 `label_object_page_text.html` / 字体 `label_object_page_font.html` / 数据 `label_object_page_data.html`；条码另有码制专页 `label_object_page_barcode_*.html`）。

复刻版实测（验收方已跑通对象链路，场景 `tools/parity/scenarios/object-flow.json`）：
- 选中对象时右侧出现内嵌「属性」面板（页签 `数据源`/`文本样式`/`常规`）：`parity/reference/maxlabel/B1-text-placed.png`
- **双击对象**后面板消失、对象取消选中、**不弹属性界面**：`parity/reference/maxlabel/B2-text-props.png`

**实测缺陷（必须修，见 `parity/diffs.md` DIFF-13.4）**：在对象周围 9 个点派发 `dblclick`、以及直接向监听容器派发 `dblclick`，`[data-testid=object-props-dialog]` 全部为 false；而 `Alt+Enter` 正常。诊断假设：`onDblClickDom` 里 `scenePointer()` 返回**场景坐标**而 `hitTest` 用 `getBoundingRect()` 的**视口坐标**，缩放 79% 时错位导致永不命中。要求：双击（任意缩放/平移下）必须打开属性对话框，并用坐标一致的命中判定；新增非 100% 缩放下的 CDP 断言。同时仍要求：双击与 `Alt+Enter` 都打开模态属性对话框；页签名与顺序对齐原文；字段/默认值延续 round-10 实现；内嵌面板去留自定但**入口与操作习惯必须与原版一致**，且不能两处改同一属性而不同步；新增 CDP 断言（双击开框、Alt+Enter 开框、关闭后对象仍选中）；重抓 `B1`/`B2` 证据；更新 DIFF-13 与矩阵 B 章节条目。

## 第 2 项：P0-C 数据源与数据库（模块 C，101 条）

依据帮助原文（逐页读，不要凭印象）：`datasource_main.html`、`datasource_type.html`、`datasource_type_fix.html`（常量）、`datasource_type_serial.html`（序列号）、`datasource_type_date.html`、`datasource_type_time.html`、`datasource_type_database.html`、`datasource_type_keyboard.html`、`datasource_type_script.html`（脚本，含 VBScript 生命周期）、`datasource_subvariable.html`、`datasource_shard.html`、`datasource_advanced.html`、`datasource_advanced_cut.html`、`datasource_advanced_length.html`、`datasource_advanced_controlchar.html`、`datasource_input_scale.html`；对象级：`label_object_page_data*.html`；数据库：`database_main.html`、`database_import.html`、`database_import_text.html`、`database_import_excel.html`、`database_import_odbc.html`、`database_import_cloud.html`、`database_multi.html`、`database_bind.html`、`database_print*.html`。

要求：① 数据源对话框的**变量类型入口与顺序**（常量/序列号/日期/时间/数据库/键盘输入/脚本）对齐；② 每类变量的字段、默认值、取值范围按原文；③ 高级功能：子变量、子串截取、长度控制、控制字符、小数位/比例（`datasource_input_scale`）；④ 序列号的打印后推进与回写模板行为；⑤ 数据库导入（文本/Excel/ODBC）与多连接管理；⑥ 打印时数据集推进与重复检查（`print_dupcheck.html`）。
本轮至少收口 **C 章节 8-12 条**，每条在矩阵写证据（帮助文件名 + 实现文件 + 测试）。新增 CDP 断言覆盖：变量类型入口、某类的默认值、序列号推进一次的实际效果。

## 第 3 项：DIFF-12 选择标签格式对话框收口（7 个子项）

按 `parity/diffs.md` 的 DIFF-12 表逐条做：预览尺寸标注（`100mm`/`70mm`）、只读行格式（全角冒号 + 两空格 + 大写 `X`）、`选择标签` 分组框、`安装(I)` 按钮、移除本对话框里多余的 `外形形状`/`孔洞`、按钮 `选择(Q)`/`自定义(N)`/`取消(C)`/`帮助(H)` 与默认按钮高亮、按 `LABEL-FORMAT-SPEC.md` 导入完整 275 条标签格式枚举。对照图 `parity/review/r09-choose.png`。

## 第 4 项：P0-D 打印链路（模块 D，75 条）—— 先读 `parity/diffs.md` 的 **DIFF-14**（我已把打印对话框的分区/字段/按钮对照表列全）

依据 `print_dlg_main.html`、`print_dlg_dbs.html`、`print_dlg_input.html`、`print_printer_cfg_main.html`、`print_printer_cfg_port.html`、`print_printer_cfg_cmd.html`、`print_preview.html`、`print_printlog.html`、`print_dupcheck.html`、`print_extractpic.html`、`print_summary.html`、`print_printer_labelshop.html`；真机截图 `63-dlg-print.png`、`64a-dlg-adv-print-options.png`、`64b-dlg-adv-print-cropmark.png`、`61b-dlg-label-format-printer.png`。
重点：打印对话框分组（`打印机`/`打印范围`/`设置`）与字段（`打印数量`/`单签拷贝`/`启始记录`/`只打印数据表中当前记录行的数据`/`打印后更新变量数据`/`打印标签边框`(禁用)/`旋转180度输出`）、按钮 `预览`/`打印`/`测试打印`、`选择起始标签`与`自动跟踪起始标签位置`、`高级选项`（`页眉页脚`/`定位裁切标记`，位置偏移默认 `-5.00 毫米`、模板默认 `&D &T &F - &P`）、数据库打印高级选项（`打印时自动设置数据库记录数量`/`拷贝数量从数据库字段引入`/`字段名称`/`允许打印时输入第一个标签的拷贝数量`）。

---

## 通用硬性要求（每项都适用）

1. 边做边提交（每收口 1-2 条就 `git add -A && git commit`），提交前 `powershell -File tools/parity/Check-Matrix.ps1` 必须 exit 0。
2. 每个用户可见行为都要有回归测试或 CDP 冒烟断言，并在汇报里给出命令与结果。
3. 改完重抓证据截图（`tools/parity/MaxLabelCtl.ps1`），产物留在 `parity/reference/maxlabel/`。
4. 不要改 `parity/reference/labelshop/` 下的真机证据；不要改 `tools/parity/LabelShopCtl.ps1`（真机工装由验收方维护）。
5. 不要一轮跨多个模块；本轮队列里取一项，做透。

## 第 5 项：A 章节收尾（把剩余「部分」条目逐条收口）

`parity/matrix.md` 里 A 章节仍有 18 条为 `部分`，逐条处理（能补断言的就补，确实是等价替代的就在证据列注明并改 `已实现`）：

1. **A-31 空格+滚轮缩放**：补一条 CDP 断言（按住空格滚轮改变缩放）——目前只断言了"空格+拖动平移"。
2. **A-35/37/38 打开/保存/另存为**：为这三个入口各补 CDP 断言。文件对话框不可用时，用等价路径（例如通过 IPC/文档 codec 直接断言保存产物、用最近文件或固定路径打开），并在证据列写清用的哪条等价路径。
3. **A-42 模板属性设置**：断言对话框可打开 + 关键字段存在（对照帮助 `label_page_other.html` / `label_config_label.html`）。
4. **A-44 退出**：断言退出入口触发未保存确认流程（保存/不保存/取消），取消必须终止退出。
5. **A-34 新建条幅飘带**：原版 `文件 → 新建条幅飘带` 是独立入口；确认复刻版行为（当前是独立 `handleBannerNew`），若只是普通新建则按原版语义补齐或注明等价替代。
6. **A-39/43 分享/最近文档**：原版为禁用态（未登录/无最近文件）。确认复刻版禁用规则与原版一致（无最近文件禁用、未登录禁用分享），补断言。
7. **A-49/50 查看菜单**：复刻版多了 `显示打印窗体` / `显示图层窗体` 两项（原版没有）——**要么删掉，要么在矩阵证据列注明「等价替代」并说明理由**；同时断言 标签旋转/缩放相关项行为。
8. **A-248~A-252 工具菜单的放大/缩小/适应宽度/适应高度/适合窗口**：菜单项与快捷键走同一套回调，补断言证明**菜单点击**也能改变缩放/适应（不只是快捷键）。
9. **A-269 起始页最近文件**：真机有 `test` 条目。造一个真实最近文件（打开/保存一次）后断言列表出现该条目、点击后能打开；空态文案也保留。
10. **A-271 起始页右区**：运营图文为等价自制素材，在证据列明确写「等价替代：原版为服务端下发位图，本地无法取证」，其余分区/文案按 `START-PAGE-SPEC.md`。

每收口一条就更新 `parity/matrix.md`（状态 + 证据）并提交；全部做完后 A 章节不应再有 `部分`（除非是明确标注的等价替代）。
## 第 6 项：验收方新发现的两处缺口（做第 2/5 项时一并带上，若已顺手修好则跳过）

1. **DIFF-15 状态栏「数据库」段格式**：帮助要求显示 `当前记录号/总记录数（当前记录的打印拷贝数）`，复刻版现在显示 `数据库：N 个数据集`（`App.tsx` 里拼的字符串）。改为原版口径，并补断言：导入 3 行数据集后状态栏出现 `1/3` 形式。
2. **DIFF-16 分隔文本导入编码**：帮助要求 BOM 自动识别、无 BOM 时按 GBK/GB18030（`database_import_text.html`）。复刻版 `dataImport.ts` 目前按 UTF-8 读取，中文 GBK 文件会乱码。要求：按 BOM 判定 UTF-8/UTF-16，无 BOM 回退 GB18030（主进程已有 `iconv-lite`），并补测试：同一份中文 CSV 以 UTF-8(带 BOM) 与 GBK 两种编码保存，导入后中文列名与值都要正确。
## 第 7 项：DIFF-17 图形对象模型与属性页（模块 B）

对照帮助 `label_object_page_rect.html`（标题「直线和方框对象的属性」）与 `toolbar_mainbar.html` 收口：
1. 图形对象统一一种类型，属性页补 `形状`（矩形/圆角矩形/椭圆）、`圆角半径`、`填充方框内部`；`填充颜色`/`描边颜色` 改名为原文 `填充色`/`线条色`。
2. 属性页命名对齐：图形 → `方框和圆形`；直线/斜线 → `直线和斜线`。
3. 工具栏去掉独立 `椭圆` 按钮（原版没有；椭圆由 `形状` 属性产生），或保留但在矩阵注明「等价替代」。
4. 保证 `条码/矩形/表格/线/斜线/图片` 都能按"拖拽区域"创建（原版 `label_object_create_drag.html` 语义）。
5. 补 CDP 断言：图形属性页含三个新字段、`形状=椭圆` 后画布渲染为椭圆、工具栏对象按钮集合与 `toolbar_mainbar.html` 一致（选取/条码/文字/线条/斜线/矩形/图片/表格/RFID/数据）。
6. 更新 `parity/diffs.md` 的 DIFF-17 与 `parity/matrix.md` 的 B-01/B-04/B-06/B-07/B-41 证据。
**D 模块补充要求（验收方核查后追加）**：
- 补断言：**测试打印后 `userData/print-log.jsonl` 行数不变、序列号不推进**（帮助 `print_dlg_main.html` 明确「测试打印不写日志、不自动更新变量」）；`printExecutor.ts` 已有 `test` 分支，需要断言把它钉住。
- 核对 `print_printlog.html` 的「保存打印数据项目」粒度：CSV 导出表头需覆盖原版要求的项目。
## 第 8 项：DIFF-18 RFID 属性页访问控制

按 `parity/diffs.md` 的 DIFF-18：① 访问控制改成帮助要求的 5 组分区控制（`EPC Block` / `User Block` / `TID Block` / `Access Password` / `Kill Password`，各含 锁定/解锁/不操作）；② `Access 口令`/`Kill 口令` 补「随机生成」按钮；③ 补 CDP 断言（5 组存在；随机生成后为 8 位十六进制）；④ 右侧内嵌属性面板的 `RFID 选项` 与模态对话框重复，按 DIFF-13.2 口径统一。
## 第 9 项：B 章节补逐项断言（与第 7/8 项一起做）

验收方对账发现这些 B 条目**接线与禁用规则已有断言，但具体项未逐项断言**，请补齐（补完把矩阵对应条目从 `部分` 改 `已实现` 并写断言名）：
1. **B-19 对齐**：左端 / 右端 / 顶部 / 底部 / 水平中齐 / 垂直中齐 —— 断言两个对象对齐后的实际坐标。
2. **B-20 相对标签位置**：水平居中 / 垂直居中 / 标签左侧 / 顶部 / 右侧 / 底部 —— 断言对象相对标签边界的坐标。
3. **B-24 间距**：水平间距相同 / 垂直间距相同（至少选三个对象）—— 断言三者间距相等。
4. **B-26 旋转**：左旋 90° / 旋转 180° / 右旋 90° —— 断言旋转后角度与包围盒。
5. **B-15/B-16 尺寸调整**：拖动把柄改变尺寸（按步长离散）、按住 SHIFT 保持水平垂直一致、角把柄与中间把柄差异。
6. **B-43 表格**：单元格合并、「单元格内不能直接排入文字条码」规则。
7. **B-02/B-12 选取**：选取工具激活后显示对象句柄；蓝色把柄为主对象。