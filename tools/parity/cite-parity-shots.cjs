/**
 * 验收方 round-109：把已入库的"当轮构建并排图/复刻图"写进矩阵证据列（只改证据列，不动其它列）。
 * 目的：让普查能把这 6 行算成「四件套齐」（普查按证据列里出现的文件名判定）。
 * 安全：① 只对指定的 6 行做"在最后一个单元格末尾追加"；② 幂等（已含标记就不再追加）；③ 写完自检行数与表格结构。
 */
const fs = require('fs')
const path = require('path')

const repo = 'D:\\workspace\\maxlabel'
const matrix = path.join(repo, 'parity', 'matrix.md')
const MARK = '**验收方 round-109 补（当轮构建证据）**'

/** 行号 → 追加文本 */
const PLAN = {
  'A-206': 'parity/review/cmp-choose-label-r112.png（并排：左=真机 round-43「选择标签格式」，右=复刻版 round-112 构建）',
  'C-76': 'parity/review/cmp-choose-label-r112.png（并排：左=真机 round-43，右=复刻版 round-112 构建）；parity/reference/maxlabel/clone-choose-label-r112.png（复刻图）',
  'C-84': 'parity/review/cmp-choose-label-r112.png（并排：左=真机 round-43，右=复刻版 round-112 构建）',
  'B-28': 'parity/review/cmp-props-r113.png（并排：左=真机「条码属性」verifier-20c-barcode-page.png，右=复刻版 round-113 构建）',
  'B-70': 'parity/review/cmp-props-r113.png（并排：左=真机「条码属性 → 条码」页，右=复刻版 round-113 构建）',
  'C-81': 'parity/reference/maxlabel/clone-custom-r114.png（复刻图：round-114 构建的「标签格式设置」）；parity/review/cmp-custom-r114.png（并排：左=真机 round-44，右=复刻版 round-114 构建）',
}

/** 主界面（A-174 界面元素 / A-165 状态栏）：`cmp-editor-r116.png` = 左真机 round-43（100×20mm 文档）× 右复刻版 round-116 构建。
 *  可比的是**界面框架**（菜单栏各项、工具栏、左面板、右面板「打印」区、状态栏）；
 *  **画布内容不可比**（真机那张是 100×20mm 带孔文档，复刻版是默认 100×70 文档），引用时写明。 */
const EDITOR_CMP = 'parity/review/cmp-editor-r116.png'
PLAN['A-174'] = `并排图 ${EDITOR_CMP}（左=真机 round-43 主界面，右=复刻版 round-116 构建）：**界面框架可比** —— 菜单栏（文件/编辑/查看/工具/排列/数据库/账户/云马通/选项/窗口/帮助/建议与反馈）、工具栏、左侧面板（起始页/文档标签/图层）、右侧「打印」区（参数设置/打印服务器页签、输入数据、打印机、打印数量/单张拷贝、打印按钮）、状态栏；**画布内容不可比**（真机为 100×20mm 带孔文档，复刻版为默认 100×70）`
PLAN['A-165'] = `并排图 ${EDITOR_CMP}（左=真机 round-43，右=复刻版 round-116 构建）：两图**状态栏均完整可见**（真机：打印机名+分辨率+格式名+数据库状态+光标位置+缩放；复刻版：打印机 / 纸张 / 数据库 / 光标 / 缩放 分段）——本行只主张状态栏的**分段结构与可见性**，具体数值随文档/打印机状态变化`

/* A-271（启始页右区）与 A-42（模板属性设置）等行**先出图再引用**：出图后用具体文件名加进来。
 * 教训（round-118）：不要先写带占位符（如 `<轮次>`）的引用 —— 占位符抽不出合法路径，存在性检查会放行，
 * 于是把不存在的文件名写进了证据列。现在的规则是：**追加文本里必须至少有一个真实存在的 parity 路径**。 */

const fsp = require('fs')
/** 从追加文本里抽出所有 tools/ 或 parity/ 形式的路径，逐个做存在性检查；缺一个就整行跳过该行。
 *  目的：绝不把**不存在**的文件名写进证据列（那会让覆盖率虚高）。存在性审计脚本：tools/parity/check-evidence-files.cjs */
function refsMissing(text) {
  const re = /(?:tools\/)?parity\/[A-Za-z0-9._\-\u4e00-\u9fa5/]+\.(?:png|txt|md|json|cjs|ps1|log|pdf)/g
  const hits = text.match(re) || []
  if (hits.length === 0) return ['（追加文本里没有任何可识别的 parity 证据路径）']
  return hits.filter((h) => !fsp.existsSync(path.join(repo, h.replace(/\//g, path.sep))))
}

/* 文件菜单（A-34/35/37/38/39）：`cmp-menu-r119.png` = 左真机 round-43「文件」菜单展开态 × 右复刻版 **round-119 构建**，
 *  且**两侧都是"有文档态"**（round-121 那张 r115 是无文档态、两边不可比，已废弃不用）。
 *  同态对比结论：14 项**全部存在、顺序一致**；唯一差异是 `分享` 的加速键（真机 `分享(T)...` vs 复刻版 `分享(I)...`，已在任务清单登记）。 */
/* 模板属性设置（A-42）：`cmp-templateprops-r119.png` = 左真机 round-44「标签格式设置」（= 文件→模板属性设置打开的同一个对话框）× 右复刻版 round-119 构建。
 *  真机图取自 verifier-r44-hole-circle-20b.png（round-44 真机实拍）。 */
PLAN['A-42'] = '并排图 parity/review/cmp-templateprops-r119.png（左=真机 round-44「标签格式设置」，右=复刻版 round-119 构建）；复刻图 parity/reference/maxlabel/clone-templateprops-r119.png'

/* 打印机属性 → 端口页（D-22/23/28）：`cmp-printerport-r119.png` = 左真机 `probe-15-cloudbox-port.png` × 右复刻版 round-119 构建。
 *  ⚠️ 两侧**选中的端口类型不同**（真机 `蜂打打云盒` / 复刻版 `打印机驱动程序接口`），所以本图只主张
 *  "端口页存在 + 四个页签（首选项/端口/自定义命令/工具）+ 类型下拉与端口参数的控件形态"；字段集差异待同态复核。 */
const PORT_CMP = 'parity/review/cmp-printerport-r119.png'
/** 同态版（两侧「类型」都= 蜂打打云盒）：这是**更权威**的那张 —— round-135 的字段集差异已被它证伪（是状态差异）。 */
const PORT_CMP_BOX = 'parity/review/cmp-printerportbox-r119.png'
/** 复刻侧图（普查的"复刻版证据"要 reference/maxlabel/ 前缀才认 ✓） */
const PORT_CLONE = 'parity/reference/maxlabel/clone-printerport-r119.png'
const PORT_CLONE_BOX = 'parity/reference/maxlabel/clone-printerportbox-r119.png'
for (const [id, what] of [
  ['D-22', '端口选择控件（`类型` 下拉 + 端口参数）在两侧都存在'],
  ['D-23', '`类型` 下拉与端口参数下拉的控件形态在两侧都存在（选项枚举见 `probe-18-com-port-combos.txt`）'],
  ['D-28', '打印机端口相关控件在该页可见（真机同页为 `输出端口` 组）'],
]) {
  PLAN[id] = `并排图 ${PORT_CMP}（左=真机打印机属性→端口，右=复刻版 round-119 构建）：两侧该页都有 ${what}；四页签一致。**注意两侧选中的端口类型不同**，字段集差异另见待复核记录`
  PLAN[id] += `。**同态复核（两侧类型都=蜂打打云盒）：${PORT_CMP_BOX}** —— 该图证明字段集一致（` + '`类型` + `云盒`/`未检测到云盒` + `设置`' + ` 两边都有），round-135 记的"字段集差异"是状态差异；仍存差异：加速键 ` + '`类型(I)`/`类型(T)`' + `、复刻版多 ` + '`指令编码`' + ` 与红色校验提示、底排按钮形态`
  PLAN[id] += `；复刻图 ${PORT_CLONE}、${PORT_CLONE_BOX}`
}

/* 启始页（A-271 起始页右区）：`cmp-start-r119.png` = 左真机启始页 × 右复刻版 round-119 构建。
 *  两侧都能看到右区的三块（重要通知 / 签赋学堂 / 各类不干胶标签）与「最新文章」标题；
 *  ⚠️ banner 里的商品图是版权素材、复刻版用自绘图形替代（已记录边界）；「最新文章」列表是否为空待复核。 */
PLAN['A-271'] = `并排图 parity/review/cmp-start-r119.png（左=真机启始页，右=复刻版 round-119 构建）：右区三块（重要通知 / 签赋学堂 / 各类不干胶标签）与「最新文章」标题两侧都有；复刻图 parity/reference/maxlabel/clone-start-r119.png`
/* 文件菜单（A-34/35/37/38/39）：`cmp-menu-r119.png` = 左真机 round-43「文件」菜单 × 右复刻版 round-119 构建，两侧同为"有文档态"。
 *  同态对比结论：14 项全部存在、顺序一致；唯一真差异是 `分享` 的加速键（真机 T / 复刻版 I，已登记待改）。 */
/* 系统设置「常规」页的 9 个控件（A-177…A-185）：真机图 `probe-r112-sysset.png`（round-112 实拍）逐项可见 ——
 *  语言组（界面语言）、单位组（标尺单位）、非打印对象组（输出非打印对象 / 不选中非打印对象）、
 *  其它组（允许运行脚本 / 启动时运行模板向导 / 自动旋转输出页面 / 标签工作区背景颜色 / 恢复默认）✓ */
const SYSSET_SHOT = 'parity/reference/labelshop/probe-r112-sysset.png'
const SYSSET_ROWS = {
  'A-177': '语言组的 `界面语言(L):` 下拉（本机值 简体中文）',
  'A-178': '单位组的 `标尺单位(U):` 下拉（本机值 毫米）',
  'A-179': '非打印对象组的 `输出非打印对象(P)` 复选框',
  'A-180': '非打印对象组的 `不选中非打印对象(N)` 复选框',
  'A-181': '其它组的 `允许运行脚本(S)` 复选框',
  'A-182': '其它组的 `启动时运行模板向导` 复选框',
  'A-183': '其它组的 `自动旋转输出页面` 复选框',
  'A-184': '其它组的 `标签工作区背景颜色：`（色块 + 恢复默认）',
  'A-185': '其它组的 `恢复默认` 按钮',
}
for (const [id, what] of Object.entries(SYSSET_ROWS)) {
  PLAN[id] = `真机证据（round-112 实拍）：${SYSSET_SHOT} —— 该图完整拍到「系统设置 → 常规」页，其中 ${what} 逐字可见；页面结构见 parity/reference/labelshop/PROBE-round112-sysset.md`
  PLAN[id] += `。并排图 parity/review/cmp-sysset-r115.png（左=真机「系统设置·常规」probe-r112-sysset.png，右=复刻版 round-115 构建，两侧同为常规页）`
}

/* 主界面标尺与框架（A-175/A-176）：真机图 `verifier-r43-editor-hole.png`（round-43 实拍编辑态）——
 *  该图可见水平/垂直标尺、窗口标题栏、模板编辑区、状态栏与右侧快捷打印区 ✓ */
const EDITOR_SHOT = 'parity/reference/labelshop/verifier-r43-editor-hole.png'
PLAN['A-175'] = `真机证据（round-43 实拍）：${EDITOR_SHOT} —— 图中可见水平标尺、垂直标尺与版面（标尺刻度随缩放变化）`
PLAN['A-176'] = `真机证据（round-43 实拍）：${EDITOR_SHOT} —— 图中可见窗口标题栏（含文档名与登录态后缀）、模板编辑区、状态栏与右侧快捷打印区`

/* 条码属性「条码」页（B-38/39/68/69/70/71/72）：真机图 `verifier-20c-barcode-page.png`（round-20 实拍）——
 *  该图完整拍到该页：`条码符号类型(码制)(B):`（值 Code 128）、尺寸组（`X 尺寸(X):` / `码  高(H):`）、
 *  `条码特殊选项` 组（`☐GS1/EAN 128(U)` / `字符集(C):`）、`供人识读字符` 组（`位置(P):` / `垂直偏移(O):` / `对齐方式(A):` / `☐字符模板(I)`）、页尾 `颜色:` 色块。
 *  引用措辞按"该图确实能看到什么"写，**不夸大**（例如下拉的完整选项列表、条宽比/缩减量不在这张图里）。 */
const BARCODE_SHOT = 'parity/reference/labelshop/verifier-20c-barcode-page.png'
const BARCODE_ROWS = {
  'B-68': '该页顶部就是 `条码符号类型(码制)(B):` 下拉（本机取值 `Code 128`）',
  'B-70': '`条码特殊选项` 分组可见（含 `☐GS1/EAN 128(U)` 与 `字符集(C):`）',
  'B-71': '`供人识读字符` 分组三项齐全：`位置(P):` / `垂直偏移(O):` / `对齐方式(A):`',
  'B-72': '`供人识读字符` 组内的 `☐字符模板(I)` 复选框可见',
}
for (const [id, what] of Object.entries(BARCODE_ROWS)) {
  PLAN[id] = `真机证据（round-20 实拍）：${BARCODE_SHOT} —— ${what}；页面整体结构另见 parity/reference/labelshop/PROBE-verifier-object-tabs.md`
  // 同一张「条码属性」并排图也能给这些行当并排证据（它拍的就是该页；每行只主张自己那部分可见）
  PLAN[id] += `。并排图 parity/review/cmp-props-r113.png（左=真机 ` + '`verifier-20c-barcode-page.png`' + `，右=复刻版 round-113 构建，两侧同为「条码属性 → 条码」页）`
}
PLAN['B-68'] += '；该页顶部控件在并排图两侧都可见'
PLAN['B-71'] += '；`供人识读字符` 三项在并排图两侧都能逐项对上'
PLAN['B-72'] += '；`字符模板` 复选框在并排图两侧都可见'
// 这三行只被该图**部分**覆盖：按"图中确实可见的那几个控件"写清楚，避免夸大。
PLAN['B-38'] = `真机证据（部分覆盖，round-20 实拍）：${BARCODE_SHOT} —— 图中可见码制控件的**当前取值** ` + '`Code 128`' + `（完整候选列表需另拍展开态，见 B-68 的下拉）`
PLAN['B-39'] = `真机证据（部分覆盖，round-20 实拍）：${BARCODE_SHOT} —— 尺寸组中 ` + '`X 尺寸(X):`' + ` 与 ` + '`码  高(H):`' + ` 可见；**条宽比不在该页的这张图里**，需按码制另取`
PLAN['B-69'] = `真机证据（部分覆盖，round-20 实拍）：${BARCODE_SHOT} —— 可见 ` + '`X 尺寸(X):`' + ` / ` + '`码  高(H):`' + `；` + '`条宽比`' + ` 与 ` + '`缩减量`' + ` 不在这张图内（缩减量属企业版字段）`

/* 关于对话框 / 对象属性数据源页（round-129 新出的同态并排图）——
 *  `cmp-about-r129.png`（左=真机 66-dlg-about.png，右=复刻版 round-129 构建）
 *  `cmp-datasource-r129.png`（左=真机 r88-textprops-p1.png「文字属性→数据源」，右=复刻版 round-129 构建） */
const ABOUT_CMP = 'parity/review/cmp-about-r129.png'
const DATASOURCE_CMP = 'parity/review/cmp-datasource-r129.png'
/** 行号是**核对过**的（round-129 我原来拍脑袋写的一批 id 全错，被下面的校验脚本拦下了 → 只留真正相关且图里拍得到的行）。 */
const ABOUT_ROWS = ['A-68']
for (const id of ABOUT_ROWS) {
  PLAN[id] = `并排图 ${ABOUT_CMP}（左=真机「关于」对话框 parity/reference/labelshop/66-dlg-about.png，右=复刻版 round-129 构建）；复刻图 parity/reference/maxlabel/clone-about-r129.png。该行含"帮助菜单 → 关于"，两侧「关于」对话框可比版本行/产品ID/激活/官网/版权结构（本行只主张其中"关于"这一项）`
}
const DATASOURCE_ROWS = ['B-90', 'B-91', 'B-92']
for (const id of DATASOURCE_ROWS) {
  PLAN[id] = `并排图 ${DATASOURCE_CMP}（左=真机「文字属性 → 数据源」页 parity/reference/labelshop/r88-textprops-p1.png，右=复刻版 round-129 构建的对象属性数据源页）；复刻图 parity/reference/maxlabel/clone-datasource-r129.png。两侧同为数据源页，可比「子串列表 / 数据源(S) / 显示数据(D) / 变量共享名称(N) / 高级选项」结构`
}

/* round-157 新出的两张同态并排图（round-131 构建）：
 *  `cmp-toolbar-r131.png`（左=真机工具栏 » → 添加或删除按钮 ▸ 91-toolbar-customize-submenu.png）→ A-121
 *  `cmp-install-r131.png`（左=真机「安装 LabelShop 打印机」probe-07-install-printer.png）→ D-34/D-35 */
const TOOLBAR_CMP = 'parity/review/cmp-toolbar-r131.png'
const INSTALL_CMP = 'parity/review/cmp-install-r131.png'
PLAN['A-121'] = `并排图 ${TOOLBAR_CMP}（左=真机「工具栏 » → 添加或删除按钮 ▸」parity/reference/labelshop/91-toolbar-customize-submenu.png，右=复刻版 round-131 构建）；复刻图 parity/reference/maxlabel/clone-toolbar-r131.png。两侧同为"添加或删除按钮"的两级菜单形态`
PLAN['D-34'] = `并排图 ${INSTALL_CMP}（左=真机「安装 LabelShop 打印机」parity/reference/labelshop/probe-07-install-printer.png，右=复刻版 round-131 构建）；复刻图 parity/reference/maxlabel/clone-install-r131.png。两侧同为安装/移除入口界面`
PLAN['D-35'] = `并排图 ${INSTALL_CMP}（同图）：两侧都可比"可安装的打印机列表"区域（真机图里即安装对话框的机型列表）`

/* 选项菜单（A-51/A-52）：`cmp-optionsmenu-r131.png` = 左真机 r100-options-menu.png（两项：系统选项(C)... / 应用程序外观(A) ▸）
 *  × 右复刻版 round-131 构建。两侧都能看到这两项 ✓；⚠️ 复刻版菜单里还多出第三项「电子秤」（已在任务清单登记为待核实的差异）。 */
const OPTIONSMENU_CMP = 'parity/review/cmp-optionsmenu-r131.png'
PLAN['A-51'] = `并排图 ${OPTIONSMENU_CMP}（左=真机「选项」菜单 parity/reference/labelshop/r100-options-menu.png，右=复刻版 round-131 构建）；复刻图 parity/reference/maxlabel/clone-optionsmenu-r131.png。两侧都能看到 ` + '`系统选项(C)...`' + ` 项且文案与加速键一致`
PLAN['A-52'] = `并排图 ${OPTIONSMENU_CMP}（同图）：两侧都能看到 ` + '`应用程序外观(A)`' + ` 子菜单项 ✓（复刻版另有第三项「电子秤」——真机这张图里没有，已登记待核实是否按硬件条件显示）`

/* 打印对话框（D-02「用途入口」）：`cmp-printdialog-r131.png` = 左真机 probe-63-30-print-dialog.png × 右复刻版 round-131 构建。
 *  复刻版这一侧是走「文件(F) → 打印(P)...」打开的（右侧面板的「打印」是直接开印、不弹对话框 ✓）。 */
PLAN['D-02'] = `真机证据（完整路径）：parity/reference/labelshop/probe-63-30-print-dialog.png；并排图 parity/review/cmp-printdialog-r131.png（左=真机打印对话框，右=复刻版 round-131 构建的「文件→打印」对话框，两侧同为打印对话框）；复刻图 parity/reference/maxlabel/clone-printdialog-r131.png`

/* （round-150 那批菜单引用已作废删除：那些 r150-menu-*.png 其实是"没有菜单"的画面 ✗，见 round-155 纠错） */

/* 对象属性「字体页 / 常规页」（round-151 新出的同态并排图，round-151 构建）——
 *  `cmp-propsfont-r151.png`（左=真机文字属性→字体页 r88-textprops-p2.png）
 *  `cmp-propsgeneral-r151.png`（左=真机文字属性→常规页 r88-textprops-p4.png） */
const PROPSFONT_CMP = 'parity/review/cmp-propsfont-r151.png'
const PROPSGENERAL_CMP = 'parity/review/cmp-propsgeneral-r151.png'
PLAN['B-61'] = `真机证据：parity/reference/labelshop/r88-textprops-p2.png（round-88 真机「文字属性 → 字体」页实拍）；并排图 ${PROPSFONT_CMP}（左=真机同图，右=复刻版 round-151 构建的字体页）；复刻图 parity/reference/maxlabel/clone-propsfont-r151.png`
PLAN['B-64'] = `真机证据：parity/reference/labelshop/r88-textprops-p2.png；并排图 ${PROPSFONT_CMP}（同图）：两侧都可比字体宽度缩放/颜色/字间距所在的字体页`
PLAN['B-54'] = `真机证据：parity/reference/labelshop/r88-textprops-p4.png（round-88 真机「文字属性 → 常规」页实拍）；并排图 ${PROPSGENERAL_CMP}（左=真机同图，右=复刻版 round-151 构建的常规页）；复刻图 parity/reference/maxlabel/clone-propsgeneral-r151.png —— 该行含"常规页的颜色（固定/可变颜色模式）"，两侧都可比`
PLAN['B-52'] = `真机证据：parity/reference/labelshop/r88-textprops-p4.png（round-88 真机「文字属性 → 常规」页实拍）；并排图 ${PROPSGENERAL_CMP}（左=真机同图，右=复刻版 round-151 构建的常规页）；复刻图 parity/reference/maxlabel/clone-propsgeneral-r151.png`
PLAN['B-55'] = `真机证据：parity/reference/labelshop/r88-textprops-p4.png；并排图 ${PROPSGENERAL_CMP}（同图）：两侧都可比旋转/镜像/背景所在的常规页`

/* round-162 **确定性**菜单取证（菜单栏方向键遍历，避免 Alt+A 被"排列/账户"抢键）：
 *  r162-menu-01-edit … r162-menu-10-help —— 10 张**逐张目视确认** ✓；round-156 那批里有 3 张贴错标签 ✗（已作废删除）。
 *  数据库菜单用 round-160 的 r160-db-menu.png（内容已核对 ✓，与 r162-menu-05-database 同尺寸同内容 ✓）。 */
const MENU_REAL = {
  edit: 'parity/reference/labelshop/r162-menu-01-edit.png',
  view: 'parity/reference/labelshop/r162-menu-02-view.png',
  tool: 'parity/reference/labelshop/r162-menu-03-tool.png',
  arrange: 'parity/reference/labelshop/r162-menu-04-arrange.png',
  database: 'parity/reference/labelshop/r160-db-menu.png',
  account: 'parity/reference/labelshop/r162-menu-06-account.png',
  cloud: 'parity/reference/labelshop/r162-menu-07-cloud.png',
  options: 'parity/reference/labelshop/r162-menu-08-options.png',
  window: 'parity/reference/labelshop/r162-menu-09-window.png',
  help: 'parity/reference/labelshop/r162-menu-10-help.png',
}
const MENU_CMP_R162 = (k) => `parity/review/cmp-menu-${k}-r162.png`
const MENU_CLONE = (k) => `parity/reference/maxlabel/clone-menu-${k}-r150.png`
const MENU_FAMILY = [
  ['A-45', 'edit', '编辑菜单', '撤消(U)/恢复(R)/剪切(T)/复制(C)/粘贴(P)/全选(A)/删除(D)/键盘输入变量顺序(Q)/属性'],
  ['A-48', 'view', '查看菜单', '工具栏(T)/格式栏(F)/对齐栏(A)/状态栏(S)（带勾选）与 显示启始页/打印历史记录/图层窗体/对象信息'],
  ['A-57', 'tool', '工具菜单', '选取(S)/条码(B)/文字(T)/线条(L)/斜线(L)/矩形(R)/图片(P)/表格(G)/数据(D)'],
  ['A-60', 'arrange', '排列菜单', '组合(G) Ctrl+G/取消组合(U) Ctrl+U/位置锁定 Ctrl+L/移到最前/前移/后移/移到最后'],
  ['A-54', 'database', '数据库菜单', '设置数据库(D).../更新数据库'],
  ['A-66', 'account', '账户菜单', '登录.../注销.../账号和授权管理.../试用管理.../演示和体验...'],
  ['A-63', 'window', '窗口菜单', '新建窗口(N) + 已打开窗口列表（1 启始页 / 2 新标签模板1，带勾选）'],
  ['A-68', 'help', '帮助菜单', '帮助主题(H)/在线网站(W)/查找更新版本/关于(A)...'],
]
for (const [id, key, name, what] of MENU_FAMILY) {
  PLAN[id] = `真机证据：${MENU_REAL[key]}（round-${key === 'database' ? '160' : '162'} 真机「${name}」**弹出菜单**实拍，内容含 ${what} ✓）；` +
    `复刻图 ${MENU_CLONE(key)}；并排图 ${MENU_CMP_R162(key)}（左=真机同图，右=复刻版 round-150 构建，两侧同为该菜单展开态）`
}
/* ⚠️ 并排图当场暴露的两条差异（已写进任务清单，等循环处置）：
 *  ① 复刻版「工具」菜单多出 `RFID` 项（DIFF-65 的现场图像证据 ✓）；
 *  ② 复刻版「工具」菜单里 `表格(G)` 与 `数据(D)` 的顺序与真机相反（真机：数据(D) 在 表格(G) 之前 ✗）—— 新发现。 */

/* round-160 数据库菜单专项（r160-db-menu.png = 真机「数据库(D)」**弹出菜单**实拍，含 设置数据库(D).../定位记录(S)/更新数据库/
 *  第一条记录/上一条记录/下一条记录/最后一条记录/删除数据库(E) 共 8 项 ✓）+ 复刻侧同名菜单（clone-menu-database-r150.png ✓）
 *  + 并排图 cmp-menu-database-r162.png ✓ → A-55（记录定位与翻页）、A-56（删除数据库）两行可凑齐四件套 */
const DB_MENU_REAL = 'parity/reference/labelshop/r160-db-menu.png'
const DB_MENU_CLONE = 'parity/reference/maxlabel/clone-menu-database-r150.png'
const DB_MENU_CMP = 'parity/review/cmp-menu-database-r162.png'
PLAN['A-55'] = `真机证据：${DB_MENU_REAL}（round-160 真机数据库菜单实拍：` + '`定位记录(S)`/`第一条记录`/`上一条记录`/`下一条记录`/`最后一条记录`' + ` ✓）；复刻图 ${DB_MENU_CLONE}；并排图 ${DB_MENU_CMP}（左=真机同图、右=复刻版 round-150 构建，两侧同为数据库菜单展开态）`
PLAN['A-56'] = `真机证据：${DB_MENU_REAL}（该图末项即 ` + '`删除数据库(E)`' + ` ✓）；复刻图 ${DB_MENU_CLONE}；并排图 ${DB_MENU_CMP}`

/* round-161 批量补真机证据：用**已逐张目视确认**的菜单弹出图，给同菜单内的行补"真机 + 复刻 + 并排"三件。
 *  已确认内容的图：r160-db-menu（数据库：设置数据库/定位记录/更新数据库/四条记录导航/删除数据库）、
 *  r162-menu-01-edit（编辑：撤消/恢复/剪切/复制/粘贴/全选/删除/键盘输入变量顺序/属性）、
 *  cmp-menu-tool-r162 左侧（工具：选取/条码/文字/线条/斜线/矩形/图片/数据/表格/放大/缩小/适应宽度/适应高度/适合窗口）。 */
const BULK = [
  // 数据库菜单（图：r160-db-menu.png）
  ['A-231', 'database', '`设置数据库(D)...`'],
  ['A-232', 'database', '`定位记录(S) Ctrl+F`'],
  ['A-233', 'database', '`更新数据库`'],
  ['A-234', 'database', '`第一条记录`'],
  ['A-235', 'database', '`上一条记录`'],
  ['A-236', 'database', '`下一条记录`'],
  // 编辑菜单（图：r162-menu-01-edit.png）
  ['A-46', 'edit', '`剪切(T)`/`复制(C)`/`粘贴(P)`/`删除(D)`'],
  ['A-47', 'edit', '`全选(A)`/`键盘输入变量顺序(Q)`/`属性`'],
  // 工具菜单（图：r162-menu-03-tool.png）
  ['A-58', 'tool', '`放大(I)`/`缩小(O)`'],
  ['A-59', 'tool', '`适应宽度`/`适应高度`/`适合窗口(W)`'],
  ['A-238', 'tool', '`选取(S)`'],
  ['A-239', 'tool', '`条码(B)`'],
  ['A-240', 'tool', '`文字(T)`'],
  ['A-241', 'tool', '`线条(L)`'],
]
for (const [id, key, what] of BULK) {
  PLAN[id] = `真机证据：${MENU_REAL[key]}（真机菜单弹出实拍，其中 ${what} 逐项可见 ✓）；` +
    `复刻图 ${MENU_CLONE(key)}；并排图 ${MENU_CMP_R162(key)}（两侧同为该菜单展开态）`
}

/* round-163 用**已核验**的查看/排列菜单图补行（这些行本来就有断言 ✓，补上真机+复刻+并排即成四件套）。
 *  查看图（已目视 ✓）：工具栏(T)/格式栏(F)/对齐栏(A)/状态栏(S)/显示启始页(M)/打印历史记录/显示打印窗体(P)/显示图层窗体(L)/
 *  显示对象信息(R) Ctrl+R/适应宽度/适应高度/撑满窗口(W) Ctrl+Alt+0/放大(I) Ctrl+=/缩小(O) Ctrl+-/标签旋转 ▸
 *  排列图（已目视 ✓）：组合(G) Ctrl+G/取消组合(U) Ctrl+U/对齐 ▸/尺寸 ▸/间距 ▸/旋转 ▸/位置锁定 Ctrl+L/移到最前/前移/后移/移到最后 Ctrl+B
 *  ⚠️ 标"（部分）"的行：图里只到子菜单入口 `X ▸`，子菜单内具体命令**未展开** ✗ —— 只主张"该入口存在" ✓。 */
const R163 = [
  ['A-49', 'view', '`显示启始页(M)`/`打印历史记录`/`显示打印窗体(P)`/`显示对象信息(R) Ctrl+R`'],
  ['A-50', 'view', '`适应宽度`/`适应高度`/`撑满窗口(W)`/`放大(I)`/`缩小(O)`/`标签旋转 ▸`'],
  ['A-61', 'arrange', '`对齐 ▸` 入口'],
  ['A-62', 'arrange', '`尺寸 ▸`/`间距 ▸`/`旋转 ▸` 三个入口，以及 `移到最前`/`前移`/`后移`/`移到最后`'],
  ['B-19', 'arrange', '`对齐 ▸` 入口（部分：子菜单未展开）'],
  ['B-24', 'arrange', '`间距 ▸` 入口（部分：子菜单未展开）'],
  ['B-26', 'arrange', '`旋转 ▸` 入口（部分：子菜单未展开）'],
  ['B-27', 'arrange', '`尺寸 ▸` 入口（部分：子菜单未展开）'],
  ['B-21', 'arrange', '`组合(G) Ctrl+G`'],
  ['B-22', 'arrange', '`取消组合(U) Ctrl+U`'],
  ['B-23', 'arrange', '`移到最前`/`前移`/`后移`/`移到最后 Ctrl+B`'],
  ['B-25', 'arrange', '`位置锁定 Ctrl+L`'],
]
for (const [id, key, what] of R163) {
  PLAN[id] = `真机证据：${MENU_REAL[key]}（round-162 真机「${key === 'view' ? '查看' : '排列'}菜单」弹出实拍，含 ${what} ✓）；` +
    `复刻图 ${MENU_CLONE(key)}；并排图 ${MENU_CMP_R162(key)}`
}

/* round-164 真机「条码属性 → 条码页」主页实拍（verifier-20c-barcode-page.png，已目视确认内容 ✓）：
 *  图中可见：`条码符号类型(码制)(B): Code 128`、分组 尺寸（`X 尺寸(X): 10.00 mil`、`码 高(H): 10.00 毫米`）、
 *  分组 条码特殊选项（`☐ GS1/EAN 128(U)`、`字符集(C): 自动`）、分组 供人识读字符（`位置(P): 条码下方`、`垂直偏移(O): 0.00 毫米`、
 *  `对齐方式(A): 居中`、`☐ 字符模板(T)`）、`颜色:` 色块与下拉、底排 `确定/取消/帮助`。
 *  ⚠️ 该图是 **Code 128** 状态 → 与码制相关的项（条宽比、缩减量、RSS/QR/DataMatrix 选项等）**不在**这张图里 ✗，不给它们引用。 */
const BARCODE_PAGE_REAL = 'parity/reference/labelshop/verifier-20c-barcode-page.png'
PLAN['B-74'] = `真机证据：${BARCODE_PAGE_REAL}（该图「条码特殊选项」组里 ` + '`☐ GS1/EAN 128(U)`' + ` 与 ` + '`字符集(C): 自动`' + ` 逐字可见 ✓ —— 本行说的 Code 128 特殊选项正是这两项）`
PLAN['B-75'] = `真机证据：${BARCODE_PAGE_REAL}（同上：` + '`字符集(C):`' + ` 下拉当前值为 ` + '`自动`' + ` ✓，与真机默认值一致）`
PLAN['B-69'] = `真机证据：${BARCODE_PAGE_REAL}（**部分**：该图「尺寸」组里 ` + '`X 尺寸(X): 10.00 mil`' + ` 与 ` + '`码 高(H): 10.00 毫米`' + ` 可见 ✓；` + '`条宽比`/`缩减量`' + ` 属其它码制、此图未呈现 ✗）`
PLAN['B-72'] = `真机证据：${BARCODE_PAGE_REAL}（该图「供人识读字符」组末行 ` + '`☐ 字符模板(T)`' + ` 可见 ✓；其展开后的格式化内容另见专行证据）`

const MENU_CMP = 'parity/review/cmp-menu-r119.png'
PLAN['A-34'] = `并排图 ${MENU_CMP}（左=真机 round-43「文件」菜单，右=复刻版 round-119 构建，**两侧同为有文档态**）：两侧都能看到 ` + '`新建条幅飘带`' + ` 项且文案一致`
PLAN['A-35'] = `并排图 ${MENU_CMP}（同态）：两侧都能看到 ` + '`打开(O)... Ctrl+O`' + ` 且文案与加速键一致`
PLAN['A-37'] = `并排图 ${MENU_CMP}（同态）：两侧都能看到 ` + '`保存(S) Ctrl+S`' + ` 且文案与加速键一致`
PLAN['A-38'] = `并排图 ${MENU_CMP}（同态）：两侧都能看到 ` + '`另存为(A)...`' + ` 且文案一致（真机该项无加速键显示，复刻版同）`
PLAN['A-39'] = `并排图 ${MENU_CMP}（同态）：两侧都能看到「分享」项；**加速键不同**（真机 分享(T)... / 复刻版 分享(I)...）——差异已登记，引用本图即为此项证据`

/** 真机证据（菜单项形态）：`verifier-r43-file-menu.png` 是 round-43 真机编辑态「文件」菜单的实拍，
 *  能证明这些菜单项**存在、文案与加速键**；它**不**证明各菜单项打开的对话框内容（那属于各自的行）。 */
const MENU_FILE = 'parity/reference/labelshop/verifier-r43-file-menu.png'
const MENU_ROWS = ['A-33', 'A-34', 'A-35', 'A-36', 'A-37', 'A-38', 'A-39', 'A-40', 'A-43', 'A-44']
for (const id of MENU_ROWS) {
  // 不要覆盖更具体的条目（A-34/A-35 另有并排图引用）——round-121 踩过：后面的赋值把前面的覆盖了，结果那两条没写进去。
  if (PLAN[id]) continue
  PLAN[id] = `真机证据（菜单项形态，round-43 实拍）：${MENU_FILE} —— 该图完整拍到「文件」菜单的各项文案与加速键，可佐证本行菜单项存在；打开后的对话框内容另见各自行的证据`
}

const raw = fs.readFileSync(matrix, 'utf8')
const lines = raw.split(/\r?\n/)
let changed = 0
for (let i = 0; i < lines.length; i++) {
  const m = /^\|\s*([A-E]-\d+)\s*\|/.exec(lines[i])
  if (!m) continue
  const id = m[1]
  const add = PLAN[id]
  if (!add) continue
  const addPaths = (add.match(/(?:tools\/)?parity\/[A-Za-z0-9._\-\u4e00-\u9fa5/]+\.(?:png|txt|md|json|cjs|ps1|log|pdf)/g) || [])
  const missing = refsMissing(add)
  if (missing.length) { console.log(`[skip] ${id} 引用的文件还不存在：${missing.join(', ')}`); continue }
  // 幂等判据用**内容**（该行是否已经引用了这批文件），而不是用标记 —— 否则同一行第二次补别的图会被误跳过。
  const already = addPaths.every((p) => lines[i].includes(p))
  if (already) { console.log(`[skip] ${id} 已引用过这些文件`); continue }
  // 追加到该行最后一个单元格：**必须插在最后一个 `|` 之前**。
  // 踩坑记录：A-206 行尾是 `。|`（最后一个竖线前**没有空格**），用 lastIndexOf(' |') 会插到单元格内部、把列数从 6 变 5，
  // 触发 Check-Matrix 违规。所以这里只认"行尾竖线"。
  const trimmedEnd = lines[i].replace(/\s+$/, '')
  if (trimmedEnd.endsWith('|')) {
    lines[i] = trimmedEnd.slice(0, -1).replace(/\s+$/, '') + `  ${MARK}：${add} |`
  } else {
    // 少数行**没有结尾竖线**（例如 A-271 原本就少写了一个 `|`，Check-Matrix 容忍但结构不完整）。
    // 这种行不能按"插在最后竖线前"处理（会插进单元格中间），直接追加到行尾、**并保持它原有的形状**（不擅自补竖线）。
    lines[i] = trimmedEnd + `  ${MARK}：${add}`
    console.log(`[note] ${id} 该行没有结尾竖线，按"追加到行尾"处理（未改动其结构）`)
  }
  changed++
  console.log(`[ok] ${id} 已补证据引用`)
}
if (changed > 0) fs.writeFileSync(matrix, lines.join('\r\n'), 'utf8')
console.log(`\n共修改 ${changed} 行（矩阵：${path.relative(repo, matrix)}）`)

// 自检：表格数据行数 + 提示权威校验脚本
// 注意：**不要**用"每行竖线数是否相等"做自检 —— 单元格正文里本身可能含 `|`（例如"宽×高 | 说明"），
// 于是会出现一堆假异常（round-109/118 都被这个假象误导过）。列结构的权威判定是 `tools/parity/Check-Matrix.ps1`。
const after = fs.readFileSync(matrix, 'utf8').split(/\r?\n/)
const rows = after.filter((l) => /^\|\s*[A-E]-\d+\s*\|/.test(l)).length
console.log(`自检：矩阵数据行 ${rows} 行。列结构请跑：powershell -File tools/parity/Check-Matrix.ps1（权威）`)
console.log(`引用存在性请跑：node tools/parity/check-evidence-files.cjs；覆盖度请跑：node tools/parity/survey-evidence-coverage.cjs`)
