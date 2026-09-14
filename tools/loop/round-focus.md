# 本轮任务队列（按顺序取第一项**尚未完成**的来做；一项做完做透再进下一项）

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

## 第 4 项：P0-D 打印链路（模块 D，75 条）

依据 `print_dlg_main.html`、`print_dlg_dbs.html`、`print_dlg_input.html`、`print_printer_cfg_main.html`、`print_printer_cfg_port.html`、`print_printer_cfg_cmd.html`、`print_preview.html`、`print_printlog.html`、`print_dupcheck.html`、`print_extractpic.html`、`print_summary.html`、`print_printer_labelshop.html`；真机截图 `63-dlg-print.png`、`64a-dlg-adv-print-options.png`、`64b-dlg-adv-print-cropmark.png`、`61b-dlg-label-format-printer.png`。
重点：打印对话框分组（`打印机`/`打印范围`/`设置`）与字段（`打印数量`/`单签拷贝`/`启始记录`/`只打印数据表中当前记录行的数据`/`打印后更新变量数据`/`打印标签边框`(禁用)/`旋转180度输出`）、按钮 `预览`/`打印`/`测试打印`、`选择起始标签`与`自动跟踪起始标签位置`、`高级选项`（`页眉页脚`/`定位裁切标记`，位置偏移默认 `-5.00 毫米`、模板默认 `&D &T &F - &P`）、数据库打印高级选项（`打印时自动设置数据库记录数量`/`拷贝数量从数据库字段引入`/`字段名称`/`允许打印时输入第一个标签的拷贝数量`）。

---

## 通用硬性要求（每项都适用）

1. 边做边提交（每收口 1-2 条就 `git add -A && git commit`），提交前 `powershell -File tools/parity/Check-Matrix.ps1` 必须 exit 0。
2. 每个用户可见行为都要有回归测试或 CDP 冒烟断言，并在汇报里给出命令与结果。
3. 改完重抓证据截图（`tools/parity/MaxLabelCtl.ps1`），产物留在 `parity/reference/maxlabel/`。
4. 不要改 `parity/reference/labelshop/` 下的真机证据；不要改 `tools/parity/LabelShopCtl.ps1`（真机工装由验收方维护）。
5. 不要一轮跨多个模块；本轮队列里取一项，做透。
