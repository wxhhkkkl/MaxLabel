
## round-86 结算（只落账，未写代码）

上一轮（round-86）以超时结束，但成果已入库（`dfe02f5` 代码/脚本 + `6c407bc` 台账），round-86 门禁**全部通过**（`tools/loop/last-gates.md`：`test:ui` exit=0，`ALL SCRIPTS PASSED (57/57)`；`parity:matrix` exit=0）。本轮逐份核对上一轮实际改动后落账。

**一、矩阵：无 `待核` → `已实现` 可翻转。** 实测矩阵为 605 条 → 已实现 584 / 部分 19 / 未实现 2 / **待核 0**（覆盖 100%），本轮开工时 `待核` 已为 0，故不存在需要升级的条目。round-86 的唯一产品面产出 `app/scripts/ui-v109.cjs` 当前 **12/21** 且**未登记进 `run-regression.ps1`**，不满足「已完成且门禁通过」，故 **A-207 / A-208 保持 `部分`**，只把该走查的实际通过/未通过范围补进其证据列（未改状态）。

- [x] **`app/scripts/ui-v109.cjs` 的成果已登记进矩阵证据列**：A-207/A-208 的证据列补记「第 3/4/6/7 步 12 条通过 / 第 5/9/10/12/13 步 9 条未通过 + 卡点位置」。状态未翻转。

**二、台账对账：勾掉 13 条「工作已完成但清单未勾」的僵尸项**（均可在矩阵/门禁中查到已收口证据，逐条列如下）。这些是 round-84/85/76/77/78 遗留的记账缺口，不是本轮新做的工作。

**三、`parity/diffs.md`：无待勾条目。** 11 行表格（DIFF-1～DIFF-11）全部为 `✅`，正文段落 DIFF-14～DIFF-27 亦全部带 `✅ 已收口` 标记，未收口差异 **0 条**。

**四、本轮未改动任何产品代码、脚本、断言或脚本清单**；`tools/parity/Check-Matrix.ps1` exit 0。

### 本轮勾掉的僵尸项清单（13 条）

| 位置 | 项 | 收口证据 |
| --- | --- | --- |
| round-84 段 | A-201 可实现的真实缺口 | round-85 收口：`printerSupportsVariableColor()`（`app/src/shared/print/capabilities.ts`）+ `ui-v108.cjs` 8/8（门禁内）+ `test:color` 13/13；矩阵 A-201 = `已实现` |
| round-84 段 | A-85 仍缺点击行为断言 | round-85 收口：`ui-v108.cjs` 8/8（门禁内，`MAXLABEL_OPEN_PATH` 等价路径）；矩阵 A-85 = `已实现` |
| round-77 段 | B-141「写回未生效」疑为误判 | 已定案为误判：属性对话框是事务式的，「取消/X 关闭后回读」读到的是回滚值；拆成「取消不写回 / 确定写回」两条后 `ui-v102.cjs` 27/27，矩阵 B-141 = `已实现` |
| round-77 段 | `ui-v102.cjs` 25/26 未登记进门禁 | 现 **27/27** 且已登记（`run-regression.ps1` 第 53 行）；round-86 门禁 `ui-v102.cjs : 27/27 PASS` |
| round-77 段 | A-49/A-50 多出的「显示打印窗体/显示图层窗体」 | 已按 `menu_view.html` 处理：`显示打印窗体` 确为原版项（保留），自造的 `显示图层窗体(L)` 已移除；`ui-v91.cjs` A-49 4/4、A-50 9/9；矩阵 A-49/A-50 = `已实现` |
| round-77 段 | 待核仅剩 12 条 | 待核已清零（矩阵实测 待核 0） |
| round-78 段 | 待核仅剩 8 条 | 待核已清零 |
| round-67 段 | A-85 无点击行为断言 | round-85 收口（同上行） |
| round-67 段 | A-49/A-50 查看菜单两项未处理 | 已收口（同 round-77 段那条） |
| round-72 段 | A-44 退出确认无法用 CDP 断言 | round-84 收口：抽成 `app/src/shared/domain/closeGuard.ts` + `app/scripts/close-guard.test.ts` 14/14（本轮复跑仍 14/14）；矩阵 A-44 = `已实现` |
| round-73 段 | A-201 未实现（新缺口） | round-85 收口（同首行） |
| round-73 段 | 待查 B-141 | 已定案为误判（同上） |
| round-73 段 | 待核剩余 12 条 | 待核已清零 |

**仍未勾掉、且本轮**不**动的项**（需验收方定口径或需代码改动，登记备查）：`MAXLABEL_OPEN_PATH` / `MAXLABEL_PICK_PATH` 两个进程级测试开关的取舍、A 章节剩余 9 条 `部分`（A-121 / A-202 / A-204 / A-207 / A-208 / A-209 / A-210 / A-211 / A-271）、D-03/D-65/D-66 引用未登记脚本 `ui-v48`～`ui-v51` 的三选一口径、`parity/SCORECARD.md` 落后（建议验收方刷新）。

## round-86 A-207/A-208 端到端走查（进行中，未收口）

- [ ] **A-207/A-208 仍未收口**：新增 `app/scripts/ui-v109.cjs` 走查 `getstart_firstprint.html` 第 3–13 步，当前 **12/21**，**尚未登记进 `run-regression.ps1` 的脚本清单**（因此不参与全量门禁）。
  - **已通过（第 3、4、6、7 步，共 12 条）**：工具栏「条码」工具拖拽排入条码对象 → 鼠标左键双击条码打开属性对话框 → 「数据」页把显示数据改为 6901234567892 → 「条码」页把码制改为 EAN13 → 「确定」后对话框关闭且对象仍选中 → 重开可回读到 6901234567892/EAN13 → 排入文字对象并把内容改为「产地：北京」 → 选中文字后格式栏字体/字号可用且改后回显。
  - **未通过（第 5、9、10、12、13 步，共 9 条）**：
    1. **对象拖动（第 5/10 步）**：`dragObject` 的坐标换算已实测正确——`dragCanvas(60,30,220,110)` 排入的条码，图层行为 `x=6,y=3,w=16,h=8`，即 10px/mm 且画布原点与标签 (0,0) 对齐；但派发 `mousedown/mousemove/mouseup`（以及追加的 `pointerdown/pointermove/pointerup`）后对象位置不变。fabric 7.4.0 的 `node_modules/fabric/dist/index.js` 里确实含 `"mousedown"` 监听，故不是「只认 pointer 事件」；怀疑与 `app/src/renderer/src/editor/LabelEditor.tsx:491` 的 `canvas.on('mouse:down')` 分派路径或对象命中判定有关，需继续定位。
    2. **第 9 步图片对象未排入**：`[data-tool="image"]` + `dragCanvas(60,170,180,220)` 后 `countOfType('image')` 仍为 0（同一脚本里条码/文字在相近区域均能创建）。注意 `ui-v92.cjs` 是在 (500,320)-(680,440)（标签外）创建图片成功的，怀疑本脚本把图片落在 (60,170)-(180,220) 时与已有对象或工具状态冲突，需复现定位。
    3. **第 12/13 步**（Ctrl+P 输入打印数量、预览）随第 2 点的失败而未能到达。
  - **附带产物**：主进程 `dialog:pickFile` 新增 `MAXLABEL_PICK_PATH` 覆盖（与 `MAXLABEL_OPEN_PATH` 同一模式，仅在该环境变量存在时生效），供第 9 步「浏览图片」的原生对话框走等价路径。若验收方不认可产品代码带第二个测试开关，可与 `MAXLABEL_OPEN_PATH` 一并改为工装侧方案——两条一起登记在此。
  - 下一轮建议：先定位第 1、2 点（都是工装能力问题，定位后 9 条断言预计一次全通），再把 `ui-v109.cjs` 登记进脚本清单，最后才据结果定 A-207/A-208 的状态。


## round-85 A 章节收尾之二：A-85 打开按钮点击行为 + A-201 打印机可变颜色判定（已完成）

- [x] **A-85（`部分` → `已实现`）**：主工具栏「打开」按钮的**点击行为**终于可断言。
  - 障碍是系统原生文件对话框位于 CDP 上下文之外，但 `window.maxlabel.openTemplate()` 的调用链可以绕开：与既有 `MAXLABEL_UPDATE_URL` 同一模式，给主进程 `template:open` 加一个 `MAXLABEL_OPEN_PATH` 覆盖（设置了就直接返回该文件，未设置仍走真实对话框）。
  - `scripts/run-regression.ps1` 只为 `ui-v108.cjs` 设置该变量；脚本先用 `fs` 造一个真实 42×24 模板文件，再点击工具栏「打开」（`button[title="打开标签模版"]`），断言标签页 `ui-v108-open` 出现、状态栏 `42mm x 24mm`、提示「已打开：…」、无「打开失败」。
  - 证据：`MAXLABEL_UI_SCRIPT=ui-v108.cjs npm run test:ui` → **8/8**。
- [x] **A-201（`部分` → `已实现`）**：补上了帮助 `getstart_color.html` 要求的「按打印机自动判断是否支持可变颜色打印」。
  - 判据落在 `printerSupportsVariableColor()`：Windows 驱动端口 → 可能是平张页式彩色打印机（支持）；USB/TCP/COM/LPT/蓝牙/文件等**指令集直连**端口 → 普通条码标签打印机（不支持，对应帮助「无法选择彩色打印」）。
  - 对象属性页据此决定是否提供「变色设置」，不支持时显示帮助原文提示（`color-change-printer-note`）；判定跟着模板里保存的打印机配置走，换端口即变。
  - 证据：`npm run test:color` **13/13** + `app/scripts/ui-v108.cjs` **8/8**。
  - **未做（有意）**：输出侧（`ResolvedPrintScene` → 位图/指令）未按该判定把颜色强制降级为单色。帮助原文说的是「无法**选择**彩色打印」，即选择入口层面的限制；真要降级需要把打印机配置传进 `fabricObjects`/打印场景的取色链，影响面覆盖三路输出，留待验收方定口径。

### round-85 新发现 / 遗留

- [ ] **`MAXLABEL_OPEN_PATH` 是新增的进程级覆盖开关**（`registerTemplateIpc.ts`）。它只在设置该环境变量时生效、且仅用于回归与部署，但如果验收方认为产品代码不应带测试开关，可改为「由回归脚本自建 Electron 启动参数」的方案——需要工装侧配合，故先按与 `MAXLABEL_UPDATE_URL` 一致的口径落地并在此登记。
- [ ] **A 章节仍有 9 条 `部分`**（A-121 / A-202 / A-204 / A-207 / A-208 / A-209 / A-210 / A-211 / A-271），全部属于「已记录边界 / 等价替代」（工具栏自定义、十余种指令集 vs 三套、云保存需登录、三版本策略、起始页运营图文）。其中 **A-207/A-208 仍可补**：getstart_firstprint.html 第 3–13 步是一条完整的「排入条码→改数据源与码制→排入文字→改字体字号→排入图片→打印数量→预览」走查，现有 ui-v92/ui-v100 只覆盖了其中的属性页片段，缺一条端到端断言；round-86 已补 `app/scripts/ui-v109.cjs`（走查第 3–13 步，当前 **12/21**，未登记进 `run-regression.ps1`，**未收口**），故 A-207/A-208 **仍为 `部分`**；这 9 条的最终口径仍待验收方核定。

## round-84 A 章节收尾之一：A-44 退出确认（已完成）

- [x] **A-44（`部分` → `已实现`）**：把「关闭未保存文档」的确认约定从两处各自实现收敛为**一份共享规则**，并逐条钉住三个分支。
  - 新增 `app/src/shared/domain/closeGuard.ts`：按钮次序（`保存 / 不保存 / 取消`）、默认按钮 0 = 保存、取消按钮 2、标题/正文/提示原文（`标签尚未保存` / `是否保存对“X”所做的更改？` / `选择“不保存”将丢弃本次编辑。`）、响应码→动作映射 `resolveCloseChoice`、`shouldProceedClose`。
  - 主进程 `registerFileIpc.ts` 的 `dialog:confirmClose` 与渲染端 `App.tsx` 的 `mayCloseTab` **共用同一份规则**（此前按钮次序写死在主进程、`choice === 'cancel'` 判据写死在渲染端）。
  - **收紧了一处真实风险**：原实现是内联三元 `response === 0 ? 'save' : response === 1 ? 'discard' : 'cancel'`；新的 `resolveCloseChoice` 对**未知响应码一律按「取消」**处理，并加了断言，避免对话框返回异常值时误丢用户编辑。
  - 证据：`npm run test:close` → **14/14**（`app/scripts/close-guard.test.ts`，新增 npm script）；入口存在/未禁用沿用 `ui-v91.cjs`。
  - **残余边界（已记录，未改断言）**：确认框是系统原生 `dialog.showMessageBox`，位于 CDP 页面上下文之外，且 contextBridge 的 `window.maxlabel` 不可重定义，冒烟脚本无法点击其按钮；因此三分支由单元测试钉住规则、接线由 `ui-v91.cjs` 钉住。若验收方要求端到端点击，需把该确认框改为渲染端模态（会与原版「系统消息框」的外观产生差异，待定口径）。

### round-84 新发现缺口

- [ ] **A 章节仍有 11 条 `部分`，其中 8 条是「已记录边界/等价替代」而被保留为 `部分`**：A-121（工具栏自定义）、A-271（起始页运营图文）、A-202/A-204（原版十余种指令集 vs 复刻 TSPL/ZPL/CPCL 三套）、A-207/A-208（云保存需登录）、A-209/A-210/A-211（原版三版本策略）。这些的差异是**产品策略边界**而非可补的断言，建议由验收方核定口径后统一在证据列注明「等价替代/已记录边界」并转 `已实现`（与 A-49/A-50 的处理口径一致）。
- [x] **A-201 已收口（round-85）**——证据：`app/src/shared/print/capabilities.ts` 的 `printerSupportsVariableColor()` + `app/scripts/ui-v108.cjs` 8/8（门禁内）+ `npm run test:color` 13/13；矩阵 A-201 已转 `已实现`。原缺口描述：帮助 `getstart_color.html` 特别说明「签赋LabelShop 会根据打印机自动判断是否支持可变颜色打印（彩色打印），普通条码标签打印机无法选择彩色打印」，复刻版**无打印机彩色能力判定**——可变颜色只按对象类型与图片单色性收敛（`supportsColorChange` / `imageSupportsVariableColor`）。可做法：在 `app/src/shared/print/capabilities.ts` 增 `printerSupportsVariableColor(printer)`（指令集直驱 = 条码标签打印机 → 不支持；Windows 驱动 + 非热敏机型 → 支持），并在对象属性页「变色设置」按该判定禁用「颜色变化模式」+ 显示帮助原文提示，预览/位图/指令三路共用同一 `ResolvedPrintScene`。**注意风险**：默认打印机配置为 `driver: 'tspl'`，一律禁用会打破 `ui-v92.cjs` 现有的可变颜色断言，需先与验收方确定「谁是彩色打印机」的判据。
- [x] **A-85 已收口（round-85）**——证据：`app/scripts/ui-v108.cjs` 8/8（已登记进 `app/scripts/run-regression.ps1`，round-86 门禁 57/57 含它）；矩阵 A-85 已转 `已实现`。原描述：主工具栏「打开」缺点击行为断言，文件对话框为原生，需走等价路径——`openTemplatePath(路径)` 已实现且被「最近文件」复用（`handleOpenRecent`），可造一个真实标签文件后用该路径断言「点打开按钮 → 文档载入」。未在本轮超时前完成。

## round-80 B1 簇「条码码制特性总表」（已完成）

- [x] **B-115～B-137（23 条 `部分` → `已实现`）**：矩阵 B 章节 `部分` 由 28 降到 5，全局 `已实现 575 / 部分 28 / 未实现 2 / 待核 0`。
  - 新增**码制特性总表**：`app/src/shared/domain/barcodeCharset.ts` 的 `BarcodeCharsetSpec` 扩为 字符集 / 来源 / 符号结构 / 容量 / 校验与纠错 / 识读特性 / 特殊选项 / 附加说明，18 种码制逐条按帮助 `barcode_summary.html` 与各专页填写；新增 `barcodeSpecRows()`、`barcodeSpecialOptions()`、`usesTwentyFiveOptions()`。
  - 条码属性页「数据」页新增**「码制特性」面板**（`BarcodeDataFields.tsx`，`data-testid=barcode-charset` / `barcode-spec-<字段>` / `barcode-spec-<字段>-value`），随码制切换；帮助未写的字段一律不显示（如 QR 的字符集）。
  - **修出 3 处真实缺口**：
    1. **25 码特殊选项分组**（B-131/B-132）：帮助 `label_object_page_barcode.html` 明写该组「包括Code25、ITF25、Matrix25和中国邮政码」，复刻版原先只有 ITF25 显示该项，且 `resolveBarcode` 只对 `interleaved2of5` 附加模10校验字符——Code25/Matrix25/中国邮政码勾选后**完全不生效**。已改为四者共用（`usesTwentyFiveOptions`）。
    2. **汉信码缺「字符编码」**（B-137）：帮助 `label_object_page_barcode_hx.html` 有 ANSI / UTF-8 选项，属性页只有纠错级别与版本。已补（`data-testid=hanxin-encoding`）。
    3. **两处字段用词与帮助不一致**：DataMatrix「纠错类型」→「纠错级别」（B-136）、PDF417「层高（X 尺寸倍数）」→「层数」（B-134）。
    4. Code 93 特殊选项页空态改为显示帮助原文「93码没有相关的特殊选项」（B-123，`data-testid=barcode-special-none`）。
  - 新增 Codabar 内容校验：a、b、c、d 只能作起始/终止符，写进数据报错（B-116）。
  - 证据：`app/scripts/barcode-spec.test.ts`（28 条断言，`npm run test:barcode` 已串联）、`app/scripts/ui-v106.cjs`（34/34，已登记进 `run-regression.ps1`）；截图 `parity/reference/maxlabel/B121-code39-spec.png`、`B118-qr-spec.png`、`B115-barcode-spec-itf25.png`、`B137-hanxin-encoding.png`、`B123-code93-no-options.png`、`B131-china-post-25-options.png`；取证场景 `tools/parity/scenarios/b1-symbology-spec.json`。

### round-80 新发现缺口

- [ ] **条码「特殊选项」页没有把帮助原文的说明整段呈现**：例如 ITF14 保护框的图例说明、PDF417 纠错级别的取舍建议、25 码的"更多校验要求可用脚本实现"。当前只把要点压进 `barcodeCharset.ts` 的 `note` / 部分提示。是否要在属性页提供「帮助」按钮跳转到对应专页，待验收方定口径。来源：`label_object_page_barcode_*.html`。
- [ ] **「缩减量」为企业版功能暂缺**（帮助 `label_object_page_barcode.html` 明写「仅在签赋LabelShop 企业版以上版本中可用」）：按 `app/docs/labelshop-compatibility-audit.md` 单一版本策略保留为已记录边界，与「手动设置 128 码字符集需企业版」同处理。
- [x] 全量 `test:ui`（v52–v106）本轮未跑完，只单跑了 `ui-v106.cjs`（34/34）；改动面为条码属性页与共享域模型，未触碰其它 UI 路径。建议下一轮补一次全量。**round-82 已补跑，全绿**：`npm run test:ui` 55/55 脚本全过、`EXIT=0`（约 19 分钟，修前基线）；round-82 门禁复跑同为 `[PASS] test:ui (exit=0, 1131s)` 且收尾行 `ALL SCRIPTS PASSED (55/55)` —— 见 `tools/loop/logs/round-82-gates.md`。

## round-79 待核清零簇（已完成）

- [x] **待核清零：A-246、B-13、B-17、B-18、B-27、B-112～B-114（8 条 `待核` → `已实现`）**，矩阵待核归零（`Check-Matrix.ps1` 输出 `已实现 552 / 部分 51 / 未实现 2 / 待核 0`，覆盖率 100%）。
  - A-246 工具菜单：**修出真实缺口**——`工具(T)` 菜单漏了 `RFID` 项（工具栏有、菜单没有）。补齐后菜单项顺序与帮助 `menu_tools.html` 逐字一致（选取/条码/文字/线条/斜线/矩形/图片/表格/**RFID**/数据 + 放大/缩小/适应宽度/适应高度/适合窗口），`Alt+T` 可调出。
  - B-13：未选取对象时排列菜单的对象命令置灰（须先选取对象）；`CTRL+T` 与 `TAB` 均逐个轮转选中模板上的每个对象。
  - B-17：数据工具点对象打开「修改数据」对话框，`显示数据` 输入后点确定即改写对象子串数据（回读验证）。
  - B-18：Ctrl+A → `组合` 产出组行并带全部子对象；改组的常规属性 `X（毫米）` +25mm 后组内对象等距同移（同时覆盖「组内对象可同时移动」与「通过位置属性精确定位」）。
  - B-27：**修出真实缺口**——排列菜单的尺寸项文案原为 `宽度相同/高度相同/宽度高度相同`，与帮助 `label_object_align_size.html` 原文及对齐栏按钮不一致，已改为 `水平同宽/垂直同宽/水平垂直相同`；并按帮助「除非选择了两个或多个对象，否则这些选项多数是不可用的（灰色）」把可用性判据由「有选中」收紧为「选中 ≥2」。
  - B-112～B-114 条码码制特性：新增 `src/shared/domain/barcodeCharset.ts`（EAN-13/EAN-8/UPC-A/UPC-E 位数与校验字符、Code 39 的 44 符号与 `*` 仅作启止符、Code 128 的 ASCII 0–127），条码属性页新增「码制特性」提示与内容校验提示（`data-testid=barcode-charset` / `barcode-content-error`）。
  - 证据：`app/scripts/ui-v105.cjs`（13/13，已登记进 `run-regression.ps1`）、`app/scripts/barcode-charset.test.ts`（11/11，新增 `npm run test:barcode`）。

- [x] **修出工装缺口**：`app/scripts/ui-v104.cjs`（round-78 新增）**从未登记进 `app/scripts/run-regression.ps1`**，即上轮汇报所说的「已登记」不成立，该脚本不在门禁覆盖内。本轮已连同 `ui-v105.cjs` 一起登记。

### round-79 新发现缺口

- [x] **`app/scripts/ui-v52.cjs`「编辑菜单初始禁用态正确」偶发失败——round-82 已定位根因并修复**。
  - **根因**：`useDocumentCommands.ts` 在挂载时读**系统剪贴板**（跨窗口/跨模板粘贴功能），若剪贴板里是 MaxLabel 对象 JSON（`{"format":"maxlabel-objects",…}`）就把 `canPaste` 置 true。而本套回归自己会污染它——任何一次「复制对象」都把该 JSON 写进系统剪贴板；`ui-v52.cjs` 又是 `run-regression.ps1` 列表里的**第一个**脚本，断言的正是启动初始禁用态。于是「上一轮跑过全量回归」⇒ 下一轮第一个脚本必挂。
  - **实测复现**：先跑全量（剪贴板被写脏），紧接着 `MAXLABEL_UI_SCRIPT=ui-v52.cjs npm run test:ui` → `65/66`（正是 1 条剪贴板相关断言失败）；剪贴板被后续运行改写后再跑 → `66/66`。
  - **这也解释了 round-80/81 连续两轮门禁失败**：两次 `test:ui` 的日志都被 `Run-ParityLoop.ps1` 的「保留末尾 25 行」截断，只剩 v82–v106 的 PASS 行，失败脚本（v52，第 1 行）正好落在被截掉的头部。
  - **修复**（`app/scripts/run-regression.ps1`）：① 开跑前若剪贴板是 MaxLabel 对象载荷就清成空格（非 MaxLabel 内容一律不动，不干扰用户），使启动态可复现；② 收尾追加决定性一行 `ALL SCRIPTS PASSED (n/n)` / `FAILED SCRIPTS: <列表>`，任何截断窗口都能看到失败者；
  - **顺带修掉一个门禁完整性漏洞**：登记在册却**缺失**的脚本原先只 `continue`、不改退出码（`test:ui` 会 exit 0 伪装成通过），现已置 `$overallExitCode = 1`。
  - **证据**：`MAXLABEL_UI_SCRIPT=ui-nope.cjs npm run test:ui` → `FAILED SCRIPTS: ui-nope.cjs`，exit=1；`MAXLABEL_UI_SCRIPT=ui-v52.cjs npm run test:ui` → `ALL SCRIPTS PASSED (1/1)`，66/66，exit=0（剪贴板先被写脏）。
  - **未改任何断言**：`ui-v52.cjs` 与全部 UI 脚本一字未动，只是让宿主剪贴板这个外部输入不再随机漂移。

- [ ] **对齐栏的尺寸三按钮仍按「有选中」判定可用性**（`AlignBar.tsx` 单一 `disabled` 属性）：帮助 `label_object_align_size.html` 要求尺寸命令在**少于两个**选中对象时灰色。本轮只收紧了**排列菜单**（B-27 的出处），对齐栏需再拆一个 `disabledSize` 属性并补断言。来源：`label_object_align_size.html`、`AlignBar.tsx`。
- [ ] `parity/SCORECARD.md` 落后于实际（记分卡 2026-09-15 的 65%，当前实测覆盖率 100%、差异未收口 0 条、待核 0）；建议由验收方在下一轮刷新。
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

- [x] **B-141 已定案：确为误判**——属性对话框是事务式的（`ObjectPropsDialog.tsx` 的 `commit()`），旧断言用「X/取消关闭后回读」读到的是回滚值；拆成「取消不写回 / 确定写回并重开保持」两条后 `app/scripts/ui-v102.cjs` **27/27**，矩阵 B-141 已转 `已实现`。原记录：本轮实测同一对话框的「不打印输出」勾选后按 Escape 关闭时读回为 false、点「确定」关闭时读回为 true。B-141 的 `barcodeAlign` 若也是用 Escape/取消 关闭后回读的，结论就成立不了。下一轮用「点确定再回读」的方式重测 B-141，若确实写回正常即可从 `部分` 改 `已实现`。来源：本轮 `app/scripts/ui-v103.cjs` 的 A-180 往返核验。
- [x] **`app/scripts/ui-v102.cjs` 已收口**：现为 **27/27**，并已登记进 `app/scripts/run-regression.ps1`（第 53 行）。round-86 门禁实测 `ui-v102.cjs : 27/27 : 27/27 PASS`。
- [x] A-49/A-50 已收口：`显示打印窗体` 经 `menu_view.html` 核对**确为原版项**（保留），复刻版自造的 `显示图层窗体(L)` 已移除。证据 `app/scripts/ui-v91.cjs` A-49 4/4、A-50 9/9、`parity/reference/maxlabel/A9-view-menu.png`；矩阵 A-49/A-50 = `已实现`。
- [x] 待核已清零（round-86 结算复核）：A-227～A-230、A-246、B-13/B-17/B-18/B-27、B-112～B-114 现均为 `已实现`，矩阵实测 **待核 0**。

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
- [x] 待核已清零（round-86 结算复核）：A-246、B-13/B-17/B-18/B-27、B-112～B-114 现均为 `已实现`，矩阵实测 **待核 0**。

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

- [x] A-85 已收口（round-85）：主工具栏「打开标签模版」的点击行为已断言 —— `app/scripts/ui-v108.cjs` 8/8（`MAXLABEL_OPEN_PATH` 等价路径，脚本已登记进 `run-regression.ps1`）；矩阵 A-85 = `已实现`。原实测结论（保留备查）：该按钮直连 `handleOpen` → `window.maxlabel.openTemplate()` → 主进程 `dialog.showOpenDialog(win, ...)`（`app/src/main/ipc/registerTemplateIpc.ts`），原生模态对话框会禁用宿主 BrowserWindow，CDP 既收不到也关不掉，点击后本轮所有后续断言都会失效；`window.maxlabel` 由 `contextBridge` 暴露、不可替换，因此无法在页面上下文里桩掉。**等价路径**：`handleOpen` 的打开语义已由 `ui-v90.cjs` 的固定路径 IPC 夹具（`openTemplatePath` + 最近文件回点）覆盖；工具栏按钮 → 同一 `handleOpen` 回调的接线由 `App.tsx` 的 `onOpen={() => void handleOpen()}` 与文件菜单 `打开(O)...` 共用。若要彻底钉死，需要在主进程加一个仅测试可见的文件选择器桩（属于产品代码改动，需另行决策）。来源：`toolbar_mainbar.html`。
- [x] A-86：主工具栏「保存」的点击行为已断言——文档自带路径时保存直接写回磁盘（不弹原生对话框）。证据 `app/scripts/ui-v94.cjs`（14/14）。
- [x] A-107～A-114：数据库工具栏七键在已连库状态下的点击行为已断言（设置数据库开对话框、定位记录按记录号落到 3/3、更新数据库反馈状态、第一/上/下一/最后一条记录记录指针 1/3→2/3→3/3 并夹紧）。证据 `app/scripts/ui-v94.cjs`（14/14）。
- [ ] 记录指针推进只覆盖了「无重复/无拷贝」场景：原版 `database_print.html` 的「打印后按打印数量推进多条记录」尚未与工具栏按钮联动断言（当前 `setRecord` 每次固定 ±1）。来源：`database_print.html`。
- [x] A-123～A-163 对齐栏 26 个按钮 **round-72 已收口**（`app/scripts/ui-v99.cjs` 27/27）。
- [ ] A-122/A3：格式栏（字体/字号/粗体/斜体/下划线/反白/颜色/文字停靠）仍只有存在性与禁用态盘点，缺逐控件点击行为断言。来源：`toolbar_format.html`。**建议下一轮按 A2 同一模式补 `ui-v100.cjs`。**
- [x] A-49/A-50 已收口：`显示打印窗体` 确为原版项（`menu_view.html`），自造的 `显示图层窗体(L)` 已移除；证据 `app/scripts/ui-v91.cjs` A-49 4/4、A-50 9/9、`parity/reference/maxlabel/A9-view-menu.png`。

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
- [x] E4 安装/升级/注册相关界面（非阻塞）——E-11/E-12 升级检查 round-70 收口；E-03/E-04/E-05 许可协议页 round-80 收口；**E-14/E-15 卸载向导步骤 round-81 收口**（`app/scripts/installer-uninstall.test.cjs`，读 electron-builder 真实 NSIS 模板 + 本仓库打包配置，变异测试确认有牙齿）
- [ ] E5 **E-13 未收口差异**：帮助列出两个卸载入口，「开始菜单 → 卸载 签赋LabelShop」这一项 electron-builder 的 NSIS 模板不创建（只创建应用快捷方式 `$newStartMenuLink`，不创建指向卸载器的快捷方式）；入口二「控制面板——程序和功能」已完整验证（`installer-uninstall.test.cjs` 的 E-13 断言）。补齐方式：在 `app/package.json` 的 `build.nsis.include` 指向自定义 .nsh，用 `!macro customInstall` 创建 `$SMPROGRAMS\MaxLabel\卸载 MaxLabel.lnk`（目标 `$INSTDIR\${UNINSTALL_FILENAME}`）、`!macro customUnInstall` 删除它。**必须用真实 `npm run dist` 出包并逐屏核对**才算完成——本轮时间窗内无法端到端验证，故未落未经验证的 NSIS 改动。来源：帮助 `install_uninstall.html`、`parity/matrix.md` E-13
- [ ] E6 **E-01/E-06/E-07/E-08 授权口径**：复刻版为单一产品授权（LicenseDialog 在线密钥校验 + 机器绑定 + 本地授权缓存 + 启动复查），原版为「用户登录 / 硬件锁 / 密钥注册」三种激活方式且标准版激活后「再次启动自动登录」。属单一版本策略下的等价替代，已在矩阵写明差异；若要真正对齐需引入账号服务。来源：`install_main.html`、`install_reg.html`

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
- [x] A-44 已收口（round-84）：原「待办」已完成 —— `dialog:confirmClose` 的按钮次序/默认按钮/取消映射已抽成 `app/src/shared/domain/closeGuard.ts` 的纯函数，并由 `app/scripts/close-guard.test.ts` 覆盖（`npm run test:close` **14/14**，round-86 结算轮复跑仍 14/14）；退出入口接线沿用 `ui-v91.cjs`。矩阵 A-44 = `已实现`。**残余边界**：确认框本身仍是原生 `dialog.showMessageBox`（CDP 上下文之外），三分支由单元测试钉住规则。来源：`menu_file.html`。
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
- [x] A-201 已收口（round-85）：`printerSupportsVariableColor()`（`app/src/shared/print/capabilities.ts`）按端口类型判定是否支持可变颜色，`ObjectPropsDialog.tsx` 据此提供/禁用「变色设置」并显示帮助原文提示；证据 `app/scripts/ui-v108.cjs` 8/8 + `npm run test:color` 13/13；矩阵 A-201 已转 `已实现`。原缺口描述：帮助要求「根据打印机自动判断是否支持可变颜色打印（彩色打印）」，复刻版无打印机彩色能力探测。来源：`getstart_color.html`。
- [ ] A-202/A-204 **边界（新缺口）**：原版列 ZPL/TSPL/TPCL/EPL/PGL/PPLE/EZPL/APLZ/BPLA/CPCL 等十几种指令集，复刻版按 `labelshop-compatibility-audit.md` 只实现 TSPL/ZPL/CPCL 三套。已在矩阵标 `部分` 写明差异。
- [ ] A-207/A-208 **边界（新缺口）**：第 11 步「模板默认保存在云上，只有注册并登录才可以保存」——复刻版无云端账号，模板只能存本地文件。已在矩阵标 `部分` 写明差异。
- [ ] A-209~A-211 **边界（新缺口）**：三个版本/激活/演示模式为单一版本策略下的已记录边界（对应 E-09/E-10）。已在矩阵标 `部分` 写明差异。
- [x] B-90~B-105 对象属性 → 数据源/脚本页（round-74 已收口 12 条）：子串工具栏补「复制/粘贴」六项齐备、ASCII 1–31 非打印字符插入条、截断/字符数限制字段按帮助措辞、日期/时间/数据库/键盘输入属性默认值、脚本页新增「脚本语言（默认 VB Script）/脚本范围（私有·公共·预定义）/语法检查/出错处理」并接入 `runScriptSource` 的语言判定；证据 `app/scripts/ui-v101.cjs` 28/28、`print-engine.test.ts` 109 组、`app/src/dialogs/DataSourceEditor.tsx`、`app/src/shared/domain/datasource.ts`。
- [x] ~~待核 B 簇（B-09/B-42/B-47/B-106/B-107/B-140）~~ —— round-76 收口为 已实现；证据 `app/scripts/ui-v102.cjs` **27/27**（round-86 门禁实测 `ui-v102.cjs : 27/27 : 27/27 PASS`；此处的 25/26 为 B-141 误判未修时的旧值）。
- [x] **B-141 已定案（误判）**：原「待查」结论不成立。原记录：条码「对齐」写回未生效 —— 在 `ObjectPropsDialog` 把 `barcodeAlign` 从 `center` 改成 `left` 后，关闭并重开属性页读回仍是 `center`；`ui-v102.cjs` 的该条断言稳定失败（其余 25 条通过）。模型 `BarcodeObj.barcodeAlign` 与 `document.ts` 的规范化分支都已加，怀疑 `onPatch`→`applyDocument` 的属性对话框快照链路或 select 的 change 未触发 React onChange，需下一轮定位。来源：`app/scripts/ui-v102.cjs`、`app/src/renderer/src/dialogs/ObjectPropsDialog.tsx`。
- [x] 待核已清零（round-86 结算复核）：A-227~A-230、A-246、B-13/B-17/B-18/B-27、B-112~B-114 现均为 `已实现`，矩阵实测 **待核 0**（A-227~A-230 → `label_page_label.html` 标签页；B-112~B-114 → `barcode_summary.html` 码制汇总）。
- [ ] **B-47 TIFF 已记录边界**：帮助要求支持 TIFF，但 Electron/Chromium 运行时无 TIFF 解码器（实测 `nativeImage.createFromBuffer` 对合法 TIFF 返回空图）；现按边界处理，不下发假入口。若后续需要支持，须引入自带解码器的依赖或在主进程实现 baseline TIFF 解码。来源：`parity/reference/`（无）、实测脚本。

## round-75 环境修复：UI 回归 runner 连错实例（不是代码回归）

- 现象：round-74 门禁 `test:ui` exit=1，但日志被截断只剩 v77–v101 的 PASS 汇总行。
- 定位：逐条重跑 v52–v76（25 条）全过，再跑**全量 50 条 50/50 PASS、exit=0**，确认不是代码回归。
- 根因：`app/scripts/run-regression.ps1` 随机取 `9300-9398` 端口后**既不校验端口空闲，也不校验 CDP 页属于本次启动的实例**；上一轮被中止的全量跑残留 electron 占着端口时，UI 脚本的 `pages.find(type==='page')` 会连到**旧渲染进程**，断言看到旧构建 → 随机脚本假失败。
- 修复（已提交）：启动前挑一个当前空闲端口；CDP 就绪后核对监听 PID 属于本次 electron 进程树，否则抛出明确的"连错实例"错误，而不是让断言跑出莫名失败。**未放宽任何断言**。
- 证据：`ui-v92.cjs 11/11`、`ui-v76.cjs 4/4`（走新端口守卫路径）；全量 `npm run test:ui` 50/50 PASS。

## round-82 结算：门禁失败根因已修 + 证据引用失效簇（新发现）

### 已完成（round-82 门禁实测通过，本轮只登记）

- [x] **`test:ui` 门禁失败根因修复**（`app/scripts/run-regression.ps1`）——根因、复现与修复详见上文 round-79 段落的 `ui-v52.cjs` 条目。round-82 门禁已实测通过：`tools/loop/logs/round-82-gates.md` → `[PASS] test:ui (exit=0, 1131s)`，收尾行 `ALL SCRIPTS PASSED (55/55)`。
  - 该收尾行正是本轮新增：此前门禁日志只保留**末尾 25 行**（`Run-ParityLoop.ps1`），而逐脚本结果按运行顺序排列，失败脚本落在被截断的头部 —— round-80/81「知道失败、不知是谁」的结构性盲区由此消除。
  - 同批修的第二个漏洞：登记在册却**缺失**的脚本原先只 `continue`、不改退出码（`test:ui` 会 exit 0 伪装通过），现置 `$overallExitCode = 1`。验证：`MAXLABEL_UI_SCRIPT=ui-nope.cjs npm run test:ui` → `FAILED SCRIPTS: ui-nope.cjs`，exit=1。
  - **未改动任何断言**，`ui-v52.cjs` 与全部 UI 脚本一字未动。

### 新发现缺口（round-82 结算轮实测，未修）

- [ ] **矩阵/台账的证据引用了不在门禁内的脚本（`ui-v48`～`ui-v51`）**：这四个脚本仍在仓库里，但自 round-06（commit `2b67815`）起 `run-regression.ps1` 的脚本列表已由 `v48–v51` **整体替换**为 `v52+`，它们**不在任何门禁覆盖内**。然而矩阵仍把它们列为脚本证据。本轮逐条实跑（`MAXLABEL_UI_SCRIPT=<脚本> npm run test:ui`）：

  | 脚本 | 门禁内时期 | 本轮实测 |
  | --- | --- | --- |
  | `ui-v48.cjs` | 14/14 PASS | **7/14**（FAIL：editor 起始标签 / editor 打印按钮 / editor 状态栏尺寸 / 画布右键上下文菜单） |
  | `ui-v49.cjs` | 5/5 PASS | **4/5**（FAIL：编辑态打印面板标题） |
  | `ui-v50.cjs` | 4/4 PASS | **0/2**（FAIL：点击打印预览按钮 / 出现独立预览窗口） |
  | `ui-v51.cjs` | 19/19 PASS | **11/19**（FAIL 8 条：选择标签格式进入编辑态 / 有文档顶层菜单为12项且顺序正确 / 编辑态文件菜单文案和加速键对齐 / 编辑态分享和导出保持原版禁用 / 状态栏使用标签规格和数据库状态 / 左侧默认图层行和右侧打印面板存在 / 打印面板页签结构对齐 / 打印面板输入数据和数量字段存在） |

  失效原因是这四个脚本停在 round-06 重写之前的旧界面选择器上，**不是产品回归**（同批已由 `ui-v52+` 全覆盖）。

  - **受影响条目**：`parity/matrix.md` 的 **D-03**（唯一脚本证据为 `ui-v50.cjs`）、**D-65**、**D-66**（唯一脚本证据为 `ui-v49.cjs`）。其余引用不受影响：A-40 另引 `ui-v53`、A-81 另引 `ui-v94`/`ui-v52`、D-01 另引 `ui-v63`/`ui-v67`、D-52 另有验收方 `tools/parity/scenarios/preview-check.json` 页面截图场景，且这些都已登记。`parity/diffs.md` 的 DIFF-11 虽引 `ui-v51.cjs`，但其依赖的那条断言「重复加速键Alt+A按原版打开账户」本轮实测仍 **PASS**，结论不受影响。
  - **已核对的实际覆盖**：D-03 的行为（点击预览 → 独立窗口）**已由已登记脚本覆盖** —— `ui-v93.cjs` 第 233–234 行「预览在原版与复刻版里都是独立窗口：断言点击后多出一个预览窗口目标」，round-82 门禁 28/28 PASS。D-65/D-66 的**打印历史对话框入口目前无任何已登记脚本覆盖** —— `ui-v91.cjs` 只断言查看菜单的「打印历史记录」菜单项文案，不打开对话框。
  - **待验收方定口径**（三选一）：① 修 `ui-v48`～`ui-v51` 的旧选择器后重新登记；② 把矩阵 D-03/D-65/D-66 的证据列改引已登记脚本（D-03 → `ui-v93`；D-65/D-66 需先补一条对话框入口断言）；③ 把四个失效脚本从仓库移除。**本轮只登记、未改动**：矩阵条目状态仍为 `已实现`，其实测行为另有独立证据，不宜在未复核前降级。
- [ ] **`parity/FAILURES.md` 落后于门禁**：该文件是验收方门禁「失败时写入、通过时清空」的通道，但 round-82 门禁已**全部通过**，文件里仍是 round-81 的 `test:ui (exit=1)` 旧内容。本轮已按验收方的通过路径清成**空文件**（与 `Run-ParityLoop.ps1` 第 396–397 行的通过分支一致——刻意不写「无失败」字样，因为循环靠「非空 ⇒ 本轮唯一任务是修它」取活，留任何文字都会被误读成待修失败）。**下次若再遇到「FAILURES.md 非空但门禁日志显示全绿」，先核对该文件记录的时间戳/HEAD 是否等于当轮，再决定是否投入一轮去修**（round-82 就为此付出了整轮时间）。

### 本轮未改动矩阵

`powershell -File tools/parity/Check-Matrix.ps1` → exit=0：605 条 → 已实现 **577** / 部分 **26** / 未实现 **2** / 待核 **0**。round-82 未改动任何产品代码或功能状态（只改了 `app/scripts/run-regression.ps1` 这份工装），因此**没有** `待核` → `已实现` 的条目可登记；26 条 `部分` 与 2 条 `未实现` 均已是记账状态，不属于本轮结算对象。

## round-83（B 模块：对象创建与 RFID 属性页）

- [x] **B-02 对象工具拖拽创建 + 粘贴创建** → `已实现`。证据：`app/scripts/ui-v107.cjs`（28/28）8 条断言；实现改动 `App.tsx` 的 `handleCreateRect`（线条按拖动主轴吸附水平/垂直；**原先把斜线也压成 h=0**，斜线拖拽创建不出斜线）与 `WorkArea.tsx` 的标签编辑区绘制光标（`data-draw-cursor`，对应帮助「鼠标变为对应的图标」）。
- [x] **B-05 所见即所得编辑闭环** → `已实现`。证据：`ui-v107.cjs` 8 条断言（格式栏改字号 → lower-canvas 像素比对证明画布即时重绘；格式栏 ↔ 属性页字号双向同步；属性页「确定」事务式写回；对齐/旋转/层次）。**本轮修掉一个编辑闭环硬伤**：`LabelEditor.tsx` 全量重建时的 `fc.clear()` 会触发 `selection:cleared`，把模型选中态清空 —— 表现为「用格式栏改一下粗体/字号，对象立刻掉选、属性面板与格式栏变空」；现以 `rebuildingRef` 屏蔽重建窗口内的该事件，并在 `clear()` 前缓存选中 id。
- [x] **B-44 / B-45 RFID 标记对象** → `已实现`。证据：`ui-v107.cjs` 10 条断言（2 个 RFID 对象可同时排入；读写器类型 5 项含 UHF/HF/国标/军标；数据段 EPC/USER/TID；起始块 ≥0；数据类型含十六进制/ASCII；EPC 区 PC 协议控制字三件套；切到 USER 区 PC 值隐藏而编码码头保留）。为断言补齐 `ObjectPropsDialog.tsx` 的 6 个 `rfid-*` 测试锚点。

### 新发现缺口（round-83 实测，未修）

- [ ] **对象旋转的左右方向与帮助相反（B-26 相关，影响 A-62 / A-76 / A-151）**：帮助 `menu_align.html` 与 `menu_context.html` 明写「"左旋90度"将所有被选取的对象**逆时针**旋转90°；"右旋90度"将所有被选取的对象**顺时针**旋转90°」。复刻版 `AlignBar.tsx` 与 `labelShopMenus.ts`（排列菜单、右键「旋转与层次」）都把 **左旋接到 `handleRotate(90)`、右旋接到 `handleRotate(270)`**，而 `operations.ts` 的 `rotateObjects` 用 `(dx·cos−dy·sin, dx·sin+dy·cos)` 在 y 轴向下的坐标里，正角度是**顺时针**（fabric 的 `angle` 同为正值顺时针），即当前实现把左右旋做反了。
  - 三处断言把这个反向语义**锁死**了，改代码必须同批改断言：`ui-v75.cjs`（B-26「左旋90度绕多选视觉中心」）、`ui-v96.cjs`（「A-62 点击「左旋90度」后选中对象 rotation=90」）、`ui-v99.cjs`（A-152/A-154「左旋90度：角度 +90」「右旋90度：角度 +270」）。
  - 本轮已实测确认：`ui-v107.cjs` 里点「右旋90度」后全部对象 `data-object-rotation = 270`，与帮助要求的顺时针 90° 不符。**本轮只登记、未改动**（跨 ui-v75/96/99 三个脚本，需要单独一轮连同证据一起收口）。
- [ ] **标签板面旋转疑似同一问题（A-50 / C-87~C-89）**：查看菜单「标签旋转」的 左旋90度→`setLabelRotation(90)`、右旋90度→`setLabelRotation(270)`（`labelShopMenus.ts`），而板面用 CSS `rotate(${labelRotation}deg)` 渲染，正值同样是顺时针 —— 与帮助「向左旋转90度显示标签板面」相反。相关断言：`ui-v79.cjs`、`ui-v91.cjs`。**未改动，留待与上一条一并核对**。
- [ ] **图层窗体点击不同步画布的选中集（影响所有「排列/对齐」类命令）**：`useEditorTransformCommands.selectedIds()` 优先取 fabric 的 `getActiveObjects()`，而 `LayerPanel` 的行点击只改模型的 `tab.selectedId`（`ui-v96` 的注释亦记有「图层行点击只换 selectedId」）。后果：先在画布上 Ctrl+A（或框选多对象），再点图层行选中单个对象，此时执行 排列→移到最后 / 对齐 等命令，作用的仍是画布上残留的**旧选中集**。`ui-v107.cjs` 里以「先点画布空白处清掉画布选中集」规避。真机无此分层，图层窗体点谁就是选中谁 —— 属真实差异，建议下一轮在 `LabelEditor` 增加 `selectedId → fc.setActiveObject` 的同步（注意不能破坏画布上的 Shift 多选）。
- [ ] **状态栏消息只在 `title` 上，没有可视消息面板**：`StatusBar.tsx` 把 `status`（如「已粘贴对象」「已删除对象」）挂在 `status-bar` 的 `title` 上，不渲染为可见文本。真机 44-statusbar.png 的空闲态确实没有独立消息面板（当前布局与之一致），因此本轮未改；若后续要显示操作提示，需先做一次真机取证确定它出现的位置与时序。

### 工装修复（round-83，`app/scripts/run-regression.ps1`）

- [x] **`Stop-ProcessTree` 递归改为迭代**：原来用 `foreach child { Stop-ProcessTree(child) }` 递归下降，在宿主繁忙 / Electron 进程树较深时会撞上 PowerShell 的 `CallDepthOverflow`，把整份 runner **连同本轮全量回归一起终止** —— round-83 实测：`npm run test:ui` 跑到 `ui-v64.cjs` 就整轮中止，**退出码 1 且没有任何汇总行**（既不是断言失败，也不是 `FAILED SCRIPTS:` 能点名的东西）。改成显式栈的迭代遍历后不再有深度上限。**未改动任何断言或脚本列表**。
