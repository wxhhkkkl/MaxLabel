## round-77 系统选项 / 系统设置各页生效行为（已完成）

- [x] A-177～A-185 与 A-257～A-265（16 条 `部分` → `已实现`）：系统选项/系统设置对话框的**每一项开关都断言了生效后的可见结果**，不再只做存在性盘点。断言脚本 `app/scripts/ui-v103.cjs` 9/9（`MAXLABEL_UI_SCRIPT=ui-v103.cjs npm run test:ui`），已登记进 `app/scripts/run-regression.ps1`。
  - A-177/A-257 界面语言：仅「简体中文」且默认选中，保存后写入选项。
  - A-178/A-258 标尺单位：切到英寸后状态栏鼠标位置按 `in` 显示（3 位小数）、标题变 `鼠标位置（in）`，写入选项。
  - A-179/A-259 输出非打印对象：默认勾选，取消后 `printNonPrintable=false` 并回读一致（打印场景 `includeSuppressed` 取该值）。
  - A-180/A-260 不选中非打印对象：勾选后画布上的非打印对象点不中、取消勾选后恢复可选中。
  - A-181/A-261 允许执行脚本：默认不勾选，勾选后 `allowScript=true` 写入选项（脚本门控见 `src/shared/domain/datasource.ts:348`）。
  - A-182/A-262 启动时运行模板向导：勾选后重载应用自动弹出模板向导。
  - A-184/A-264、A-185/A-265 标签工作区背景颜色：改色后工作区底色立即跟随；「恢复默认」还原为 `#22BDED`。
- **本轮修出的 3 处用户可见缺陷**：
  1. **画布选中回调是挂载时的闭包**：`LabelEditor` 的建画布 effect 依赖数组为 `[]`，`onSelect` 直接闭包捕获，改完「不选中非打印对象」后画布选择仍走旧回调。改为与 `mouseRef`/`toolRef` 同款 `selectRef`，并让 `handleSelectObject` 返回最终生效的 id；被拒时同步 `discardActiveObject()`，保证非打印对象在画布上连句柄都不出现。
  2. **「启动时运行模板向导」二次启动无效**：原实现把它和「首启引导」耦合在同一次 `maxlabel.firstRun` 判定里，只有第一次启动才生效。改为每次启动按选项决定（勾选 → 模板向导；未勾选 → 仅首次启动给「新手入门」）。
  3. **属性对话框是事务式的**：改动先落本地草稿、点「确定」才提交，「取消」整页回滚（round-10 的设计）。测试脚本必须点「确定」才能验证写回。

### round-77 新发现缺口

- [ ] **B-141「写回未生效」很可能是误判**：本轮实测同一对话框的「不打印输出」勾选后按 Escape 关闭时读回为 false、点「确定」关闭时读回为 true。B-141 的 `barcodeAlign` 若也是用 Escape/取消 关闭后回读的，结论就成立不了。下一轮用「点确定再回读」的方式重测 B-141，若确实写回正常即可从 `部分` 改 `已实现`。来源：本轮 `app/scripts/ui-v103.cjs` 的 A-180 往返核验。
- [ ] **`app/scripts/ui-v102.cjs` 仍是 25/26**（1 条 B-141 断言失败），因此**没有**登记进 `run-regression.ps1`；待 B-141 重测后一并处理。
- [ ] A-49/A-50 查看菜单多出的「显示打印窗体」「显示图层窗体」仍未按原版语义处理。来源：`menu_view.html`。
- [ ] 待核仅剩 12 条：A-227～A-230（`label_page_label.html` 标签格式设置-标签页，字段名与形状枚举需对齐帮助原文）、A-246（工具菜单 RFID）、B-13/B-17/B-18/B-27（对象操作）、B-112～B-114（`barcode_summary.html` 码制特性）。建议下一轮整簇收口这 12 条，把待核清零。

## round-78 标签格式设置_标签 页收口（已完成）

- [x] A-227～A-230（4 条 `待核` → `已实现`）：按帮助 `label_page_label.html` 收口标签格式设置对话框的「标签」页。
  - 字段顺序与命名改为帮助原文：标签宽度/标签高度 → **水平间距**/**垂直间距**（原为「行间隔/列间隔」）→ 列数/行数 → 形状/孔洞。
  - `形状` 由四档（直角矩形/圆角矩形/圆形·椭圆形/**光盘标签**）收敛为帮助的三档：直角矩形 / 圆角矩形 / 圆形。
  - `孔洞` 改为 无 / 圆洞 + `孔洞尺寸（mm）`；圆形档补帮助提示「宽度与高度表示两个方向的直径，数值相同即为正圆形」。
  - **只有自定义标签格式可以修改**：预定义格式（`formatKind==='preset'`）下标签宽高、水平/垂直间距、列数行数 `readOnly`，形状/孔洞 `disabled`，并显示帮助原文提示。
  - 格式库 `corner=2` 的光盘类格式（608020/608021，117mm）不再落成独立的 `disc` 形状，改为「圆形 + 圆洞」，孔洞直径从格式名 `117mm/40mm` 解析（40 / 17 毫米）。
  - 实现：`app/src/renderer/src/dialogs/PaperFields.tsx`、`TemplatePropsDialog.tsx`、`NewLabelDialog.tsx`、`OptionsDialog.tsx`（默认新建形状文案）、`HelpDialog.tsx`。
  - 断言 `app/scripts/ui-v104.cjs` 14/14（`MAXLABEL_UI_SCRIPT=ui-v104.cjs npm run test:ui`），已登记进 `app/scripts/run-regression.ps1`；`ui-v90.cjs` 的 A-42 断言同步改为新字段名（14/14）。

- [x] B-141（`部分` → `已实现`）：条码「可变长度数据的对齐」写回链路核查完毕。属性对话框是事务式的——点「确定」提交、点「取消」或标题栏 X 回滚；旧断言用 X 关闭后回读，读到的是回滚旧值，属误判。`ui-v102.cjs` 改为断言「取消不写回 + 确定写回并保持」，**27/27**，并**重新登记回 `app/scripts/run-regression.ps1`**（round-77 曾因该条失败把它移出回归清单）。

### round-78 新发现缺口

- [ ] `parity/FAILURES.md`（round-77 记录的 `test:ui` exit=1）**未能复现**：全量 51 个脚本重跑，v52～v103 全绿，唯一 FAIL 是本轮改动 mid-run 造成的旧构建假失败（重建后 14/14 通过）。判定为上一轮的瞬时噪声/环境抖动；已在本轮把全量回归跑通并保持 exit 0。
- [ ] 属性属性对话框「取消/X 回滚、确定提交」的事务语义需要在帮助文档里找依据：`label_object_page_*.html` 未见明确描述，当前按 MFC 模态对话框的通行习惯实现（`ObjectPropsDialog.tsx` 注释）。若要逐字对齐真机，需抓真机「改值→X 关闭」的取舍证据。来源：`ObjectPropsDialog.tsx`、`label_object_page_general.html`。
- [ ] 待核仅剩 8 条：A-246（工具菜单 RFID）、B-13/B-17/B-18/B-27（对象操作）、B-112～B-114（`barcode_summary.html` 码制特性）。建议下一轮整簇清零。

# Parity 攻坚队列（按优先级取活）

## round-68 A3 格式栏逐控件点击行为（已完成）

- [x] A-122～A-137（16 条）：格式栏 15 个控件的点击行为逐项断言——字体/字号改值后与对象属性对话框**双向同源**；粗体/斜体/下划线/反白点击后格式栏按下且属性对话框对应字段同步；颜色取色后当前色与对话框同步；文字停靠居左/居中/居右/撑满四项逐项落到属性对话框「对齐」；组合把两个对象合成为 `组合(2)` 并带子对象、取消组合还原；控件可用性（组合需 ≥2 对象、取消组合需选中组合对象）；属性按钮打开模态属性对话框。实现与回归：`app/scripts/ui-v95.cjs`（16/16）、`app/scripts/run-regression.ps1`；证据 `parity/reference/maxlabel/A3-format-bar.png`、`A3-format-bar-group.png`；台账 `parity/matrix.md`。
  - **本轮修出的用户可见缺陷**：格式栏「字号」下拉原来按两位小数回算磅值（24pt→8.47mm→24.01pt），选完 24 磅后下拉取不到任何选项、显示为空白；改为按 0.1 取整（`app/src/renderer/src/editor/FormatBar.tsx`），与属性对话框口径一致。同时把该控件 tooltip 由「字号（磅）」改为帮助原文的「字号」。

### round-68 新发现缺口

- [x] A-138、A-151 及其下 24 个具体按钮（A-139～A-150、A-152～A-163）**round-72 已收口**：`app/scripts/ui-v99.cjs` 27/27 逐按钮点击断言（对齐六项按参考对象、居中/贴边按标签边界、旋转绕多选视觉中心、尺寸与参考对象相同、间距首尾固定、顺序整体上下移），并把对齐栏文案改回帮助原文（左齐/顶齐/右齐/底齐/垂直中齐/水平中齐/水平居中/垂直居中/左旋90度/旋转180度/右旋90度/水平同宽/垂直同宽/水平垂直相同/移到最前/前移/后移/移到最后/标签顶部/标签左侧/标签右侧/标签底部）。来源：`toolbar_align.html`。
- [ ] A-122/A3：格式栏（字体/字号/粗体/斜体/下划线/反白/颜色/文字停靠）仍是 `部分`，只做了存在性/禁用态盘点，缺逐控件点击行为断言。来源：`toolbar_format.html`。**建议下一轮按 A2 同一模式补 `ui-v100.cjs`。**
- [ ] 帮助 `toolbar_format.html` 原文把「居中」注为「文字右对齐」、「居右」注为「文字居中」，与原版按钮图标语义相反。复刻版按按钮名映射（居中→center、居右→right），已在矩阵 A-122 证据列注明；若要逐字照抄文档需真机二次取证。

## round-66 A1 主工具栏逐按钮点击行为（已完成）

- [x] A-84：新建 → 模板向导 → 新建标签格式对话框；A-87～A-92：剪切/复制/粘贴/删除/撤消/恢复的对象数与按钮可用性变化；A-93：打印三按钮顺序 + 对象工具集合与帮助顺序一致；A-94：标签格式设置打开模板属性对话框；A-95：打印预览打开独立预览窗口（CDP 目标数 +1）；A-96：打印打开打印对话框；A-97～A-106：十个对象工具的激活态与画布创建/点选行为；A-115～A-120：放大/缩小改 zoom-level、适应宽度/适应高度/撑满窗口写状态栏、帮助主题打开帮助。实现与回归：`app/scripts/ui-v93.cjs`（28/28）、`app/scripts/run-regression.ps1`；台账 `parity/matrix.md`。
  - 已记录边界：A-121「添加或删除按钮」（原版自定义工具栏）复刻版无对应入口，工具栏按钮固定。

### round-67 新发现缺口

- [ ] A-85：主工具栏「打开标签模版」仍无点击行为断言。**实测结论**：该按钮直连 `handleOpen` → `window.maxlabel.openTemplate()` → 主进程 `dialog.showOpenDialog(win, ...)`（`app/src/main/ipc/registerTemplateIpc.ts`），原生模态对话框会禁用宿主 BrowserWindow，CDP 既收不到也关不掉，点击后本轮所有后续断言都会失效；`window.maxlabel` 由 `contextBridge` 暴露、不可替换，因此无法在页面上下文里桩掉。**等价路径**：`handleOpen` 的打开语义已由 `ui-v90.cjs` 的固定路径 IPC 夹具（`openTemplatePath` + 最近文件回点）覆盖；工具栏按钮 → 同一 `handleOpen` 回调的接线由 `App.tsx` 的 `onOpen={() => void handleOpen()}` 与文件菜单 `打开(O)...` 共用。若要彻底钉死，需要在主进程加一个仅测试可见的文件选择器桩（属于产品代码改动，需另行决策）。来源：`toolbar_mainbar.html`。
- [x] A-86：主工具栏「保存」的点击行为已断言——文档自带路径时保存直接写回磁盘（不弹原生对话框）。证据 `app/scripts/ui-v94.cjs`（14/14）。
- [x] A-107～A-114：数据库工具栏七键在已连库状态下的点击行为已断言（设置数据库开对话框、定位记录按记录号落到 3/3、更新数据库反馈状态、第一/上/下一/最后一条记录记录指针 1/3→2/3→3/3 并夹紧）。证据 `app/scripts/ui-v94.cjs`（14/14）。
- [ ] 记录指针推进只覆盖了「无重复/无拷贝」场景：原版 `database_print.html` 的「打印后按打印数量推进多条记录」尚未与工具栏按钮联动断言（当前 `setRecord` 每次固定 ±1）。来源：`database_print.html`。
- [x] A-123～A-163 对齐栏 26 个按钮 **round-72 已收口**（`app/scripts/ui-v99.cjs` 27/27）。
- [ ] A-122/A3：格式栏（字体/字号/粗体/斜体/下划线/反白/颜色/文字停靠）仍只有存在性与禁用态盘点，缺逐控件点击行为断言。来源：`toolbar_format.html`。**建议下一轮按 A2 同一模式补 `ui-v100.cjs`。**
- [ ] A-49/A-50：查看菜单的「显示打印窗体」「显示图层窗体」仍在（原版没有），本轮未处理。来源：`menu_view.html`。

## round-65 DIFF-27 对象可变颜色（已完成）

- [x] DIFF-27：`ColorChangeConfig.mode` 七值（fixed/random/indexByContent/indexVar/valueVar/index/rgb）、索引表默认注入索引 0–9 十个预定义颜色、颜色值支持「,」与「|」两种分隔、按对象类型收敛变色粒度、图片仅单色黑白图可设可变颜色并给出提示。实现：`app/src/shared/domain/objects.ts`（`resolveColorChangePlan`/`parseColorValues`/`colorIndexForChar`/`colorGranularityOptions`/`DEFAULT_COLOR_INDEX_TABLE`）、`app/src/shared/domain/document.ts`（`normalizeColorChange` 迁移旧 `index`/`variable` 取值）、`app/src/renderer/src/rendering/fabricObjects.ts`（文字逐字符样式、条码区块/渐变蒙版着色、图片单色着色）、`ObjectPropsDialog.tsx`。证据：`npm run test:color` 11/11、`app/scripts/ui-v92.cjs` 11/11、`parity/reference/maxlabel/DIFF27-color-modes.png`、`DIFF27-color-value-pipe.png`。

### round-65 新发现缺口

- [ ] 条码区块/渐变变色的**指令输出**路径：当前 TSPL/ZPL/CPCL 对动态颜色走光栅化（`sceneNeedsRasterization`），需在真机上核对彩色条码的光栅输出效果（来源：`app/src/shared/print/capabilities.ts` 与 `color_main.html`）。
- [ ] 公共颜色索引表（`doc.colorIndexTable`）未在**模板属性对话框**里提供编辑入口，目前仅在对象属性页的「索引表来源=模板公共索引表」中编辑（来源：`ObjectPropsDialog.tsx` colorIndexDraft）。


## round-69 菜单栏四菜单逐项点击行为（A-60～A-68，已完成）

- [x] A-60 排列菜单：12 项与顺序/快捷键同真机 `54-editor-menu-arrange.png`；空文档未选中对象时 12 项全禁用；全选两个对象后转为可用（`组合` 需 ≥2 对象可用、`取消组合` 仍需选中组合对象故禁用）；`位置锁定` 点击后对象加锁定标记、再次点击取消。实现与回归：`app/scripts/ui-v96.cjs`（22/22）、`app/scripts/run-regression.ps1`。
- [x] A-61 排列→对齐：子菜单 12 项与帮助顺序一致；点击「标签左侧」后选中对象 x 落到标签左边界 0。**本轮修正**：子菜单项名由自造的「上对齐/下对齐」改为与真机对齐栏 tooltip 一致的「顶对齐/底对齐」（来源 `parity/reference/maxlabel/A1-toolbar-inventory.md` 的实测 tooltip）。
- [x] A-62 排列→尺寸/间距/旋转/层次顺序：三个子菜单项与帮助一致；点击「左旋90度」后对象 rotation=90；「移到最后」/「移到最前」改变图层顺序。
- [x] A-63/A-64/A-65 窗口菜单：真机 `57-editor-menu-window.png` 实测该版本窗口菜单只有「新建窗口(N) + 分隔线 + 已打开文档列表（当前项打勾）」，**没有**帮助 `menu_windows.html` 描述的「层叠/平铺/排列图标」。复刻版已同步移除这三项；`新建窗口` 保留为禁用（等价替代：原版为 MDI 子窗口，复刻版为单窗口多标签页）。
- [x] A-66/A-67 账户菜单：登录/注销/账号和授权管理/试用管理/演示和体验 五项与真机 `59-editor-menu-account.png` 一致（未登录时仅 `登录...` 与 `演示和体验...` 可点），点击「演示和体验...」打开新手入门对话框。
- [x] A-68 帮助菜单：项与分组同真机 `58-editor-menu-help.png`（帮助主题 ／ 在线网站 + 查找更新版本 ／ 关于，两条分隔线）；「帮助主题(H)」不显示 F1 快捷键文本（同截图，F1 键位仍有效）；点击打开帮助主题对话框。

### round-69 新发现缺口

- [ ] 帮助 `toolbar_format.html` 与 `menu_align.html` 的部分措辞与真机菜单/按钮实测不一致（已是第二次遇到）。建议后续以真机截图为准逐簇复核，把「文档过时」的结论写进 `parity/diffs.md`，避免每轮重复判断。来源：`parity/reference/labelshop/57-editor-menu-window.png`、`58-editor-menu-help.png`。
- [x] A-171～A-176、A-186（界面参考「主界面」12 个界面元素 + 空的 `config_system.html`）：12 个元素逐条收口。其中**元素 1 程序标题栏原为缺口**——复刻版窗口标题恒为静态 `MaxLabel`，既无版本号也无激活/登录状态；本轮新增 `app/src/shared/appTitle.ts`（`composeWindowTitle` 纯函数）+ `app/src/renderer/src/features/shell/useWindowTitle.ts` + IPC `app:version`/`app:window-title`，标题改为 `MaxLabel [未激活] V0.1.0 (请登录 LabelShop) - <当前文档>`，分段顺序与真机 `00-main.png`/`40-editor.png` 同构。证据：`app/scripts/app-title.test.ts` 7/7（`npm run test:title`）、`app/scripts/ui-v98.cjs` 28/28（`MAXLABEL_UI_SCRIPT=ui-v98.cjs npm run test:ui`）。来源：`interface_interface.html`、`interface_main.html`。

### round-71 新发现缺口

- [ ] **A12 主界面证据截图未抓成**：`tools/parity/MaxLabelCtl.ps1 -Action run` 本轮两次都在 4 分钟级未返回（`-NoBuild` 亦同），进程被手工终止，故 A-171~A-176 的矩阵证据只挂了命令与断言名（`MAXLABEL_UI_SCRIPT=ui-v98.cjs npm run test:ui`、`npm run test:title`），未附 `parity/reference/maxlabel/A12-*.png`。下一轮开场补抓：`powershell -File tools/parity/MaxLabelCtl.ps1 -Action capture` 或先 `-Action start` 再 `-Action shot`。
- [ ] **重复新建文档待查**：`ui-v98.cjs` 跑完「Ctrl+N → 模板向导 → 下一步 → 选择标签格式 → 选择」后，页签栏出现**两个**文档（`新标签模板1` 60×40 = `blankTemplate()` 原样、`新标签模板2` 100×70 = 对话框选定格式）。60×40 那个不来自 `handleNewFromDialog`（它会把宽高改成对话框的值）。复现命令 `MAXLABEL_UI_SCRIPT=ui-v98.cjs npm run test:ui`，在「新建标签模板先出模板向导」断言后打印 `document.querySelectorAll('[data-testid=document-tab]').length` 即可看到向导打开前已存在一个文档。怀疑与 `App.tsx` 第 646 行 `next.length === 0` 的兜底建文档路径有关，需单独立项排查。来源：本轮实测。

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
- [x] A-31 空格+滚轮缩放；`WorkArea.tsx` 支持与 Ctrl+滚轮相同的离散缩放，`ui-v86.cjs` 6/6，证据 `A7-space-wheel-zoom.png`。
- [x] A-248～A-252 工具菜单放大/缩小/适应宽度/适应高度/适合窗口均复用 `App.tsx` 的 `zoomIn`/`zoomOut`/`fit` 回调；`ui-v86.cjs` 6/6，证据 `A6-tools-menu-zoom.png`。

### round-56 A 文件菜单入口簇

- [x] A-34：文件菜单独立“新建条幅飘带”创建 100×15mm 文档；`App.tsx`/`ui-v90.cjs` 2/2；证据 `A8-file-menu.png`、`A8-banner-editor.png`。
- [x] A-35：打开入口、固定路径模板解析及 RecentFile 等价打开路径；`App.tsx`/`ui-v90.cjs` 2 项；证据 `A8-file-menu.png`、`A8-banner-editor.png`；文件选择器按本轮约定用固定路径 IPC 夹具。
- [x] A-37：脏文档时保存菜单启用并写回已打开文件；`App.tsx`/`ui-v90.cjs`；证据 `A8-file-menu.png`。
- [x] A-38：另存为入口启用且固定路径 IPC 产物可重新打开；`App.tsx`/`ui-v90.cjs`；证据 `A8-file-menu.png`。
- [x] A-39：未登录时分享入口禁用；`labelShopMenus.ts`/`ui-v90.cjs`；证据 `A8-file-menu.png`。
- [x] A-42：模板属性设置打开四页签并呈现关键字段；`TemplatePropsDialog.tsx`/`ui-v90.cjs`；证据 `A8-template-properties.png`。
- [x] A-43：RecentFile 空态、文件菜单子菜单和再次打开；`useRecentTemplates.ts`/`App.tsx`/`ui-v90.cjs`；证据 `A8-file-menu.png`。

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

### round-54 B 鼠标选取簇

- [x] B-10：单击单选、Ctrl 单击追加多选；`LabelEditor.tsx` 与 `ui-v88.cjs` 6/6，证据 `B10-B12-selection.png`。
- [x] B-11：Shift 单击切换/取消选择，标签空白区拖拽圈选；`LabelEditor.tsx`/`WorkArea.tsx` 与 `ui-v88.cjs` 6/6，证据 `B10-B12-selection.png`。
- [x] B-12：选取工具显示句柄，完整多选首个对象保持蓝色主对象；`LabelEditor.tsx` 与 `ui-v88.cjs` 6/6，证据 `B10-B12-selection.png`。

### round-55 B 文字页簇

- [x] B-65：文字属性页类型为单行/多行/圆形，默认单行；`ObjectPropsDialog.tsx`、`ui-v89.cjs` B-65 断言、证据 `B89-text-properties.png`，来源 `label_object_page_text.html`。
- [x] B-66：单行/多行文字的行宽度、垂直对齐和毫米行距；`ObjectPropsDialog.tsx`/`fabricObjects.ts`、`ui-v89.cjs` B-66 断言、证据 `B89-text-properties.png`，来源 `label_object_page_text.html`。
- [x] B-67：圆形文字角度、弧度、半径、回绕方向和文字方向，参数提交后保持；`ObjectPropsDialog.tsx`/`fabricObjects.ts`、`ui-v89.cjs` B-67 断言、证据 `B89-text-properties.png`，来源 `label_object_page_text.html`。

### round-31 B 条码码制与特殊选项簇
- [x] B-68/B-70：码制下拉 18 项按帮助顺序排列，特殊选项按码制切换并保留 Code128 独立页签。证据：`ui-v77.cjs`、`ObjectPropsDialog.tsx`、`B77-barcode-code128-options.png`。
- [x] B-74/B-75：Code128 的 GS1/EAN-128、`^1` FNC1 说明及自动/A/B/C/手动字符集入口和默认值。证据：`ui-v77.cjs`、`barcode.ts`、`B77-barcode-code128-options.png`。
- [x] B-85：QR Code 特殊选项含 GS1、纠错级别、ANSI/UTF-8 编码与图标区域。证据：`ui-v77.cjs`、`B77-barcode-code128-options.png`。
- [ ] B-69 余项：企业版「缩减量」未提供；当前按帮助中“企业版以上可用”的版本边界保留为部分，证据 `ui-v77.cjs` 已覆盖其余尺寸字段。

- [x] DIFF-13 对象属性入口：双击对象与 Alt+Enter 打开模态属性对话框，关闭后保留选中；证据 `app/scripts/ui-v57.cjs` 8/8 + `app/scripts/ui-v73.cjs` 3/3（含非 100% 缩放、工作区滚动、直接向监听容器派发）、`parity/reference/maxlabel/B1-text-placed.png`、`B2-text-props.png`

本轮新增缺口：

### round-27 已收口

- [x] DIFF-24 工具栏禁用规则：未连库时数据库七键禁用；未选中对象时组合/取消组合禁用；选中两个对象后组合可用。证据 `app/src/renderer/src/features/editor/editorAvailability.ts`、`app/src/renderer/src/editor/Toolbar.tsx`、`app/src/renderer/src/editor/FormatBar.tsx`、`app/src/renderer/src/features/commands/labelShopMenus.ts`、`app/scripts/ui-v74.cjs` 10/10、`app/scripts/ui-v85.cjs` 7/7、`app/scripts/ui-v87.cjs` 3/3、`parity/reference/maxlabel/DIFF24-toolbar-disabled.png`

- [x] DIFF-25 颜色索引表：补齐颜色索引/颜色/RGB颜色值/十六进制四列表格与增删行，支持颜色名和 `#RRGGBB`。证据 `app/src/renderer/src/dialogs/ObjectPropsDialog.tsx`、`app/scripts/ui-v74.cjs` 10/10、`app/scripts/ui-v85.cjs` 7/7（四列、私有/公共表、增删行、red/#00FF80 解析）、`parity/reference/maxlabel/DIFF25-color-index-table.png`

- [x] DIFF-26 自动旋转输出页面：系统选项持久化，并接入预览、正式打印和指令导出共享打印场景。证据 `app/src/renderer/src/dialogs/OptionsDialog.tsx`、`app/src/renderer/src/features/printing/printExecutor.ts`、`app/src/renderer/src/features/printing/printPreviewService.ts`、`app/src/renderer/src/features/printing/usePreviewWorkflow.ts`、`app/src/renderer/src/features/printing/useCommandExportWorkflow.ts`、`app/scripts/print-engine.test.ts` 104 组（ResolvedPrintScene + TSPL）、`app/scripts/ui-v74.cjs` 10/10、`app/scripts/ui-v85.cjs` 7/7、`parity/reference/maxlabel/DIFF26-auto-rotate-options.png`
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
- [x] C7 数据导入：CSV / 制表符文本 / Excel（xlsx）及云数据库四步导入（C48、C70–C72、C75、C77–C78、C81–C82）；云数据库由 `cloudRepository.ts`/`registerServiceIpc.ts` 接入文件/表/字段/记录查询，服务端不可用时显示明确空态而不伪造记录；来源 `database_import_cloud.html`、证据 `C24-cloud-database-workflow.png`、`ui-v81.cjs`、`ui-v83.cjs`。
- [ ] C8 ODBC / SQL 连接管理（已收口 C56、C58–C59、C73–C74：驱动配置、Windows/SQL Server 认证、服务器/数据库/表/SQL、连接列表、多连接选项；真实驱动连接、SQL Server 表查询和打印前刷新仍待硬件/环境核对，来源 `database_import_odbc.html`、证据 `C22-odbc-workflow.png`、`C23-odbc-connection-defaults.png`）
- [x] C13 云模板元数据与权限（C79–C80）：分享入口按登录状态启用，支持用户/组模板库、分类、关键字、描述，元数据随本地离线库及远程 HTTP 契约保存/列表/加载；证据 `CloudDialog.tsx`、`cloudRepository.ts`、`cloud.ts`、`ui-v83.cjs` 8/8，来源 `label_label_shareas.html`、`label_label_saveas.html`。
- [x] C9 打印时数据集推进与重复检查（本轮收口 C-60～C-69：数据库记录导航、打印数量/单签拷贝/起始记录、高级数据库打印 3 项、定位四方向与模糊查找；证据 `database_print*.html`、`PrintDialog.tsx`、`MoreDialogs.tsx`、`printExecutor.ts`、`ui-v62.cjs`、`C12-database-locator.png`、`C13-database-print-dialog.png`）
- [x] C10 标签格式设置页面/打印机/其它页签（收口 C-90～C-101：预定义页只读、自定义纸张/A4、打印方式、起始位置/首选方向/偏移、用户格式命名保存和回开；依据 `label_page_page.html`、`label_page_printer.html`、`label_page_other.html`，实现 `TemplatePropsDialog.tsx`、`document.ts`、`layout.ts`，回归 `ui-v70.cjs` 15/15，证据 `C18-label-format-tabs.png`、`C19-label-format-page.png`、`C20-label-format-other.png`）
- [x] C11 查看比例与标签旋转（收口 C-85/C-86：工具栏/查看菜单/状态栏比例控件，以及标尺箭头旋转页面；证据 `ui-v79.cjs` 6/6、`C21-view-scale-rotation.png`）
- [x] C12 查看比例/标签旋转四种模式（收口 C-87/C-88/C-89：工具栏、查看菜单、状态栏比例入口及正常/左旋90/右旋90/旋转180；证据 `ui-v79.cjs` 6/6、`C21-view-scale-rotation.png`）

本轮已完成：C-60/C-61/C-62/C-63/C-64/C-65/C-66/C-67/C-68/C-69。数据库记录导航与定位查找按 `database_print.html`、`database_print_search.html` 逐项实现；打印范围与高级选项按 `database_print_start.html`、`database_print_copy.html` 接线。证据见 `parity/matrix.md`、`app/scripts/ui-v62.cjs`、`tools/parity/scenarios/database-print-flow.json`、`parity/reference/maxlabel/C12-database-locator.png`、`C13-database-print-dialog.png`。

## P0-D 打印链路（对应 matrix 章节 D）
- [x] D-01/D-02/D-03/D-04：打印章节三个入口已由打印面板、打印对话框、独立预览和条码图片导出共同覆盖；证据 `ui-v50.cjs`、`ui-v63.cjs`、`ui-v67.cjs`、`D1-print-dialog.png`、`D4-print-preview.png`、`D8-barcode-export.png`。

- [x] D-05/D-06/D-07：打印概述的前提、标准图形输出裁剪、原生指令完全落在标签内才输出、非打印对象开关与顶部偏移已收口；`scene.ts`/`engine.ts`/`renderLabel.ts`，`app/scripts/print-engine.test.ts` D-05～D-07 断言。

- [x] D1 打印对话框（`print_dlg_main.html`）：字段、默认值、按钮；`ui-v63.cjs` 10/10，`print-dialog-check.json` missingCount=0，证据 `D1-print-dialog.png` / `D2-print-advanced-*.png`
- [x] D2 打印机配置（指令集/端口/分辨率/属性：速度、浓度、热敏/热转印、标签类型、顶部偏移、介质处理、出纸回退）；`PrinterSettings.tsx` + `ui-v63.cjs` 12/12，证据 `D3-printer-properties.png` / `D3-printer-port.png`
- [x] D3 打印预览（缩放、翻页、拼版）；预览入口由 `PrintDialog.tsx` 接入 `usePreviewWorkflow`，统一使用 `ResolvedPrintScene`；证据 `D4-print-preview.png`，独立预览窗口实现见 `printPreviewService.ts` / `previewWindow.ts`
- [x] D4 测试打印（1 张、不写日志、不推进序列号）；`print-engine.test.ts` 真实执行 `executePrint(test, …)` 断言命令一次、日志零次、序列号回写零次
- [x] D5 打印日志（JSONL、查看/清理入口）；`PrintHistoryDialog.tsx` + `registerLogIpc.ts`，CSV 表头回归覆盖 `print_printlog.html` 保存项目，已有 `ui-v49.cjs` 历史对话框断言
- [x] D6 打印数量 × 单签拷贝、序列号与数据集推进顺序；`app/src/shared/print/plan.ts` 统一生成逻辑/物理标签数与序列号推进数，`app/scripts/print-engine.test.ts` 覆盖 D-46/D-47。
- [x] D7 TSPL / ZPL / CPCL 指令输出与快照；保留 `app/fixtures/protocol/*.prn`，新增 `app/fixtures/protocol/protocol-snapshots.json` 与 `test:print` SHA-256/关键指令回归。
- [x] D8 拼版/多标签（行列、间距、顺序、起点、偏移）；共享 `app/src/shared/print/layout.ts` 的 `pageCells` 与 `resolvePrintPlanPageScene`，`app/scripts/print-engine.test.ts` 覆盖列式/右下起点/偏移并集。

### round-39 D 打印机首选项逐条收口

- [x] D-43：新建标签前保留已保存打印机，并明确打印机分辨率对条码密度/标签尺寸的影响；`NewLabelDialog.tsx`、`printerPreferences.ts`、`print-engine.test.ts`、`ui-v84.cjs` 4/4。
- [x] D-44：模板保存并回读目标 Windows 打印机，打印对话框与打印机属性页继续显示同一绑定；`NewLabelDialog.tsx`、`PrintDialog.tsx`、`PrinterSettings.tsx`、`ui-v84.cjs` 4/4。

- [x] D-31/D-32/D-33：打印机设置的自定义命令页提供三类命令入口并明确参考对应打印机开发手册；`PrinterSettings.tsx`、`ui-v82.cjs` 9/9（D-31～D-33）、依据 `print_printer_config.html`。
- [x] D-11 速度/浓度调整后仍不理想的特别说明；`PrinterSettings.tsx`、`ui-v64.cjs` 12/12、证据 `D6-printer-preferences.png`
- [x] D-13/D-14 热敏与热转印选项及 ZPL 输出；`PrinterSettings.tsx`、`ui-v64.cjs`、`app/scripts/print-engine.test.ts`
- [x] D-16 标签类型（连续纸/间隔定位/标记定位）：`PrinterSettings.tsx`、`ui-v64.cjs` sensing options/guidance、`app/scripts/print-engine.test.ts` 感测命令回归、证据 `D6-printer-preferences.png`
- [x] D-21 配置优先级：`PrinterSettings.tsx`/`printerPreferences.ts` 保存默认值并由下一个新建模板采用；`ui-v64.cjs` priority guidance + default preference applies to next template；证据 `D6-printer-preferences.png`
- [x] D-34/D-35/D-37/D-38/D-39：安装打印机对话框提供安装/移除、集成品牌列表、ZPL/TSPL/CPCL 未收录型号提示、203/300/600 dpi 和分辨率不匹配改选规则；`PrintersInstallDialog.tsx`、`ui-v82.cjs` 9/9、证据 `D13-printer-install.png`，依据 `print_printer_labelshop.html`。
- [ ] D-36：指令集总表仍只实现 TSPL/ZPL/CPCL 三套，LabelShop 帮助还列出更多方言；等价替代与边界见矩阵及 `app/docs/labelshop-compatibility-audit.md`。

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

## round-70 E 章节升级检查（E-11/E-12，已完成）

- [x] E-11 升级 → 启动时自动检查更新程序并给出更新提示（帮助 `install_upgrade.html`）：新增主进程 `app/src/main/updater.ts`（版本比较、清单解析、清单地址推导、结果三态），IPC `update:check`（`app/src/shared/ipcContract.ts` / `app/src/preload/index.ts` / `app/src/main/ipc/registerServiceIpc.ts`），渲染侧 `app/src/renderer/src/features/shell/useUpdateStartup.ts` 启动静默检查、**只在有新版本时弹提示**，失败一律静默不打扰。清单地址 = 「系统选项 → 云服务器地址」+ `/api/version`（可用 `MAXLABEL_UPDATE_URL` 覆盖）。证据：`app/scripts/update-check.test.ts`（`npm run test:update`，10/10）+ `app/scripts/ui-v97.cjs`（16/16，含「模拟新版本自动弹提示」「模拟失败静默不弹窗」）。
- [x] E-12 升级 → 帮助菜单「查找更新版本」：`app/src/renderer/src/dialogs/MoreDialogs.tsx` 的 `UpdateDialog` 由写死提示改为**真实结果展示**（有新版本=版本号+更新说明+「立即更新」按钮；已最新=当前版本；取不到清单=失败原因 + 官网下载指引）；`App.tsx` 的 `handleCheckUpdate` 与启动检查共用 `window.maxlabel.checkForUpdate`。证据：`app/scripts/ui-v97.cjs` 16/16（命令 `MAXLABEL_UI_SCRIPT=ui-v97.cjs npm run test:ui`）。

### round-70 新发现缺口

- [x] E-03/E-04/E-05 安装向导「接受软件许可协议」页（round-70 已收口）：新增 `app/build/license_zh_CN.txt`（中文最终用户许可协议，UTF-8 BOM），electron-builder 的多语言许可页分支自动启用；证据 `app/scripts/installer-license.test.cjs` 6/6（`npm run test:installer`）——用 electron-builder 自身的 `getLicenseFiles`/`computeLicensePage` 验证生成的 NSIS 脚本含 `MUI_PAGE_LICENSE` 并按语言绑定。
- [ ] E-13/E-14/E-15：卸载向导逐屏（启动卸载 → 确认卸载 → 删除程序文件与快捷方式 → 保留用户文件 → 完成）未逐屏核对，目前只有 NSIS 配置层面的证据。来源：`install_uninstall.html`。

---

## P1-E 其他（对应 matrix 章节 E）

- [ ] E1 选项/配置对话框（`config_general.html`）各项
- [ ] E2 帮助菜单（联机帮助 CHM、在线教程、关于、建议与反馈）
- [ ] E3 云模板/共享模板/授权激活界面
- [ ] E4 安装/升级/注册相关界面（非阻塞）——E-11/E-12 升级检查已于 round-70 收口；余 E-03/E-04/E-05 许可协议页、E-13/E-14/E-15 卸载逐屏

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

## round-64 A 章节收尾（查看菜单 / 最近文件）

- [x] A-49 查看菜单项与顺序照抄 `menu_view.html`（工具栏/格式栏/对齐栏/状态栏/显示启始页/显示打印窗体/打印历史记录/显示对象信息），并移除复刻版自造的「显示图层窗体(L)」；证据 `app/scripts/ui-v91.cjs` 4/4、`parity/reference/maxlabel/A9-view-menu.png`。
- [x] A-50 查看菜单的适应宽度/适应高度/撑满窗口/放大/缩小与标签旋转四项走同一套回调并实际生效；证据 `app/scripts/ui-v91.cjs` 9/9、`parity/reference/maxlabel/A9-view-menu.png`。
- [x] A-269 起始页最近文件：写入真实 RecentFile 后列表出现标题且点击可打开；证据 `app/scripts/ui-v91.cjs` 2/2、`parity/reference/maxlabel/A9-start-recent.png`。
- [ ] A-44 退出确认流程仍无法用 CDP 断言：确认框是原生 `dialog.showMessageBox`，且 contextBridge 的 `window.maxlabel` 不可重定义（实测 `Cannot redefine property: maxlabel`）。**待办**：把 `dialog:confirmClose` 的按钮/默认按钮/取消映射抽成可单测的纯函数，在 `app/scripts/` 下加 node 回归。来源：`menu_file.html`。
- [ ] A-271 起始页右区运营图文仍为自制等价素材（原版为服务端下发位图，本地无法取证）；已在矩阵证据列注明等价替代。

## round-73 A 章节 · 入门指引簇（getstart_*.html / label_main_page / label_page_label）

- [x] A-187/A-188/A-190~A-196 入门章节结构与定位：`GetStartedDialog` 按 `getstart_main.html` 重构为七主题（标签打印的概念 / 了解条码打印机 / 新建标签 / 添加对象与数据 / 可变数据打印的概念 / 打印标签 / 版本与激活），概念文案逐句取自帮助；证据 `app/scripts/ui-v100.cjs` 27/27、`parity/reference/maxlabel/A-getstart-topic-*.png`
- [x] A-189/A-193/A-194/A-195 标签打印概念（按行列布局、自动排列、宽高行列间隔、内容可变而布局一致）；证据同上
- [x] A-197 电子表格/数据库导入入口：`数据库(D) → 设置数据库(D)...` 打开对话框含导入入口；证据 `ui-v100.cjs`
- [x] A-198 序列号做法与高级选项（数据源页七类 + 序列号起始/步长）；证据 `ui-v100.cjs`
- [x] A-203 两类打印机由驱动识别并显示正确标签格式；证据 `ui-v100.cjs`
- [x] A-205/A-206 十三步流程第 1、2 步（新建 → 标签格式选择对话框含打印机与格式下拉）；证据 `ui-v100.cjs`
- [x] A-199/A-200 可变颜色对象范围与变色粒度（复用 DIFF-27 收口证据 `color-change.test.ts` + `ui-v92.cjs`）
- [x] A-212~A-217 标签格式与模板章节主题、标签概述术语；证据 `ui-v100.cjs`
- [ ] A-201 **未实现（新缺口）**：帮助要求「根据打印机自动判断是否支持可变颜色打印（彩色打印）」，复刻版无打印机彩色能力探测，仅按对象类型与图片单色性收敛。来源：`getstart_color.html`。已在矩阵标 `部分` 写明差异。
- [ ] A-202/A-204 **边界（新缺口）**：原版列 ZPL/TSPL/TPCL/EPL/PGL/PPLE/EZPL/APLZ/BPLA/CPCL 等十几种指令集，复刻版按 `labelshop-compatibility-audit.md` 只实现 TSPL/ZPL/CPCL 三套。已在矩阵标 `部分` 写明差异。
- [ ] A-207/A-208 **边界（新缺口）**：第 11 步「模板默认保存在云上，只有注册并登录才可以保存」——复刻版无云端账号，模板只能存本地文件。已在矩阵标 `部分` 写明差异。
- [ ] A-209~A-211 **边界（新缺口）**：三个版本/激活/演示模式为单一版本策略下的已记录边界（对应 E-09/E-10）。已在矩阵标 `部分` 写明差异。
- [x] B-90~B-105 对象属性 → 数据源/脚本页（round-74 已收口 12 条）：子串工具栏补「复制/粘贴」六项齐备、ASCII 1–31 非打印字符插入条、截断/字符数限制字段按帮助措辞、日期/时间/数据库/键盘输入属性默认值、脚本页新增「脚本语言（默认 VB Script）/脚本范围（私有·公共·预定义）/语法检查/出错处理」并接入 `runScriptSource` 的语言判定；证据 `app/scripts/ui-v101.cjs` 28/28、`print-engine.test.ts` 109 组、`app/src/dialogs/DataSourceEditor.tsx`、`app/src/shared/domain/datasource.ts`。
- [x] ~~待核 B 簇（B-09/B-42/B-47/B-106/B-107/B-140）~~ —— round-76 收口为 已实现；证据 `app/scripts/ui-v102.cjs` 25/26。
- [ ] **待查（round-76 新发现，B-141）**：条码「对齐」写回未生效 —— 在 `ObjectPropsDialog` 把 `barcodeAlign` 从 `center` 改成 `left` 后，关闭并重开属性页读回仍是 `center`；`ui-v102.cjs` 的该条断言稳定失败（其余 25 条通过）。模型 `BarcodeObj.barcodeAlign` 与 `document.ts` 的规范化分支都已加，怀疑 `onPatch`→`applyDocument` 的属性对话框快照链路或 select 的 change 未触发 React onChange，需下一轮定位。来源：`app/scripts/ui-v102.cjs`、`app/src/renderer/src/dialogs/ObjectPropsDialog.tsx`。
- [ ] 待核剩余 12 条：A-227~A-230（标签格式设置_标签 4 条）、A-246（工具菜单 RFID）、B-13/B-17/B-18/B-27（对象操作/修改数据/成组/尺寸命令）、B-112~B-114（barcode_summary 码制汇总）、B-140 已收口。下一轮建议成簇推进 B-112~B-114（barcode_summary）+ B-13/B-17/B-18/B-27（label_object_select/change/align）。
- [ ] **B-47 TIFF 已记录边界**：帮助要求支持 TIFF，但 Electron/Chromium 运行时无 TIFF 解码器（实测 `nativeImage.createFromBuffer` 对合法 TIFF 返回空图）；现按边界处理，不下发假入口。若后续需要支持，须引入自带解码器的依赖或在主进程实现 baseline TIFF 解码。来源：`parity/reference/`（无）、实测脚本。

## round-75 环境修复：UI 回归 runner 连错实例（不是代码回归）

- 现象：round-74 门禁 `test:ui` exit=1，但日志被截断只剩 v77–v101 的 PASS 汇总行。
- 定位：逐条重跑 v52–v76（25 条）全过，再跑**全量 50 条 50/50 PASS、exit=0**，确认不是代码回归。
- 根因：`app/scripts/run-regression.ps1` 随机取 `9300-9398` 端口后**既不校验端口空闲，也不校验 CDP 页属于本次启动的实例**；上一轮被中止的全量跑残留 electron 占着端口时，UI 脚本的 `pages.find(type==='page')` 会连到**旧渲染进程**，断言看到旧构建 → 随机脚本假失败。
- 修复（已提交）：启动前挑一个当前空闲端口；CDP 就绪后核对监听 PID 属于本次 electron 进程树，否则抛出明确的"连错实例"错误，而不是让断言跑出莫名失败。**未放宽任何断言**。
- 证据：`ui-v92.cjs 11/11`、`ui-v76.cjs 4/4`（走新端口守卫路径）；全量 `npm run test:ui` 50/50 PASS。
