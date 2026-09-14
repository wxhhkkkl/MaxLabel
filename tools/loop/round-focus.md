本轮进入 **P0-B：编辑器对象能力**（换模块了，不要再改 A 的界面框架）。目标是把**对象属性对话框**做到与帮助文档逐项一致。

## 依据（按优先级）

1. 真机观察：`parity/reference/labelshop/INDEX.md`、`FINDINGS.md`；真机「标签格式设置」对话框的控件清单见 `parity/reference/labelshop/92-obj-props.png` 与 INDEX 里的 listctl 枚举记录。
2. 帮助文档（**这是本轮主要依据**，逐页读原文，不要凭印象）：
   - `app/docs/labelshop-help-zh/label_object_page_general.html`（通用页）
   - `label_object_page_text.html`（文字页）、`label_object_page_font.html`（字体页）
   - `label_object_page_barcode.html` + 各码制专页：`label_object_page_barcode_128.html`、`_code39.html`、`_codabar.html`、`_ean13.html`、`_itf14.html`、`_itl25.html`、`_dm.html`、`_qr.html`、`_pdf417.html`、`_hx.html`、`_rss.html`
   - `label_object_page_picture.html`、`label_object_page_rect.html`、`label_object_page_rfid.html`
   - `label_object_page_data.html`（数据页，为下一轮 C 模块打底）
   - 对象级编辑：`label_object_edit.html`、`label_object_modify.html`、`label_object_change.html`、`label_object_size.html`、`label_object_form.html`
3. 矩阵条目：`parity/matrix.md` 的 **B 章节（B-01 起）**，本轮至少收口 6-10 条。

## 本轮要求

1. **逐页对照**：每个页签的**标题、字段标签、默认值、取值范围、单位、下拉枚举、按钮**都要与帮助原文一致；文档里写明的默认值（例如条码 X 尺寸单位 mil、PDF417 层高默认 X 尺寸 3 倍、DataMatrix 仅支持 ECC200 等）必须落到实现里。
2. 对话框的**页签顺序**与名称要与真机一致（通用 / 文字 / 字体 / 数据 …；条码对象还要有对应码制的专页）。真机多页签对话框的页签名以 `FINDINGS.md` 与 `INDEX.md` 记录为准。
3. 每个对象类型的属性页都要能通过**双击对象 / `Alt+Enter`** 打开，且改动立即反映到画布与打印场景（`ResolvedPrintScene`）。
4. 新增 CDP 断言（`app/scripts/ui-vNN.cjs`，挂进 `app/scripts/run-regression.ps1`）：至少断言 ① 文字对象属性页的页签名与顺序；② 条码对象的码制下拉包含矩阵里列出的全部码制；③ 某个默认值（如某码制的 X 尺寸单位/默认值）与帮助原文一致。
5. 不允许只加界面不接线；不允许把字段做成只读占位。
6. 边做边提交（每收口 1-2 个页签就提交一次）；提交前 `powershell -File tools/parity/Check-Matrix.ps1` 必须 exit 0。
7. `parity/matrix.md` 的 B 章节条目按实际完成情况标 `已实现`/`部分` 并写证据（测试名 + 帮助文档出处）；`parity/backlog.md` 勾掉对应项。
8. 不要改 `parity/reference/labelshop/` 下的真机证据；不要改 `tools/parity/LabelShopCtl.ps1`（真机取证工装）。
