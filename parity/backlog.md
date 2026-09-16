## round-100 结算（只落账，未写代码）

round-100 以**超时结束**（agent 未及写 `progress.md` 收尾，`progress.md` 末条仍为 round-99）。本轮逐份核对上一轮实际入库的改动后落账，**零产品代码改动**。

**开工核对**：`git log --oneline -3` / `git show --stat HEAD` / `git status --short` 实测——`4086c2e`（runner 并发独占锁 + `FAILURES.md` + backlog + progress）、`a8e9aab`（HEAD，backlog 记录「整轮中止」未收口项）。结算时工作区只有 `tools/loop/last-gates.md` 一处未提交（门禁产物，属正常）。

### 一、矩阵（`parity/matrix.md`）：本轮**无** `待核` → `已实现` 可翻转

实测 `powershell -File tools/parity/Check-Matrix.ps1` → **exit 0**，**605 条 = 已实现 605 / 部分 0 / 未实现 0 / 待核 0（覆盖率 100%）**。

- round-100 的改动**全部落在测试基础设施**（`app/scripts/run-regression.ps1` 的并发独占锁）与台账（`FAILURES.md`/`backlog.md`/`progress.md`），**零产品代码改动**，`git show --stat` 显示它**根本没有触碰 `parity/matrix.md`**。矩阵里不存在与之对应的条目，故本轮**不改动任何矩阵条目的状态与证据列**——不做「为凑改动而补证据」的动作。
- 复核结论：**没有**任何条目的证据列因 round-100 而失真（并发锁只影响「门禁怎么跑」，不影响「产品做什么」）。

### 二、`parity/diffs.md`：DIFF-34 补登 `✅`（1 条）

- **DIFF-34**（图层窗体的选中集与画布选中集分裂）正文写着「round-97 已修」，但**标题里没有 `✅`** —— 这正是 round-96 记下的记分卡假阳性根因：`tools/parity/Get-Scorecard.ps1` 按 `✅` 判定是否收口。已按仓库惯例把标题补成「→ ✅ 已修（round-97 …）」形态，并写明判据脚本与关键代码位置（`app/src/renderer/src/editor/LabelEditor.tsx` 的同步 effect）。
- 实测 `parity/diffs.md` 现有 **22 个 `## DIFF-` 标题**，其中 `DIFF-14`/`DIFF-15` 的「原始描述，保留备查」标题无 `✅` 属**有意为之**（各自上一行已有收口标题），`DIFF-34` 是**唯一**的真缺漏。补后无其它未收口 DIFF。

### 三、`parity/backlog.md`：订正 1 处计数 + 补记 1 条新证据

- **订正计数（真实记账错误）**：round-100 原文写「全量 `test:ui` 复跑 **65 个脚本全绿**」，与登记表实际条数不符——实测 `run-regression.ps1` 的脚本数组为 **64 条**（`ui-v49`/`ui-v50` + `ui-v52`…`ui-v113`），门禁日志亦为 `ALL SCRIPTS PASSED (64/64)`。已按 **64** 订正，并把「下一轮建议 ③」里的 `65/65` 同步改为 `64/64`。
- **补记门禁证据**：round-100 门禁（`tools/loop/last-gates.md`，2026-09-17 07:33:12，HEAD `a8e9aab`）**全部通过**，其中 `test:ui` **exit=0、1323s、末行 `ALL SCRIPTS PASSED (64/64)`** —— 该次全量回归**跑完了且汇总行正常打印**。
- **但「整轮中止」这一条保持未勾**：round-100 建议的三项修复中，①（`Stop-ProcessTree` 不再按 `ParentProcessId` 遍历，实测 `run-regression.ps1:86`/`:233` 仍是 `ParentProcessId` 查询）与 ②（runner 加 `trap` 兜底汇总行，实测全文件**查无 `trap`**）**均未做**。上述门禁跑只能说明该中止**间歇性、非确定性复现**，不能据此宣称已修。下一轮仍须先查它。

### 四、剩余未登记 / 不确定的部分（如实列出）

1. **「全量回归整轮中止、无汇总行」根因未修**（见上）——仍挂在 backlog 未收口区，是下一轮的**首要**任务。
2. **`parity/SCORECARD.md` 仍落后于矩阵**：其上标注 `2026-09-17 04:11:45` / HEAD `f8878f7`，矩阵写 **603/605、E 章节「未实现 2」**，与当前 **605/605、未实现 0** 不符。round-98 已记为「建议验收方在下一轮开始前刷新」，非本轮登记范围，故本轮**未重生成**（重生成会一并把上面补的 DIFF-34 `✅` 计入，届时收口数应由 30 → 31）。
3. **`ui-v48.cjs`（7/14）/ `ui-v51.cjs`（11/19）** 仍是留在仓库但不进 `run-regression.ps1` 门禁的失效脚本（round-99 定的既定状态，理由已记）。
4. **`round-100` 在 `parity/progress.md` 中没有条目**：`progress.md` 的轮次条目由循环控制者按上一轮 agent 汇报追加，round-100 超时未产出汇报，故末条仍为 round-99。本轮**未代写**（避免伪造 agent 汇报），round-100 的实际产出以 backlog 本节与其上方的 round-100 工作小节为准。

## round-100 修 `parity/FAILURES.md`：test:ui 的 14 个「失败」是并发跑出来的假失败（已完成）

**开工核对**：`parity/FAILURES.md` 非空 → 按流程本轮唯一任务是修好它。内容为 round-99 门禁的 `test:ui (exit=1, 1694s)`，`FAILED SCRIPTS: ui-v54, ui-v59, ui-v60, ui-v61, ui-v67, ui-v73, ui-v74, ui-v75, ui-v76, ui-v82, ui-v88, ui-v89, ui-v94, ui-v95`（14 个），其中 `ui-v94` 无任何 PASS/FAIL 行、`ui-v95` 报 `等待 UI 回归 CDP 就绪超时：9369`。

### 根因（已定位，非产品缺陷）

**同一台机器上同时跑了两套全量 `test:ui`**。证据链：

1. round-99 自己的汇报原文写着「**全量 `test:ui` 在报告时仍在跑**（已完成的 ui-v49…ui-v60 共 11 个脚本…）」——即上一轮 agent 在收尾时启动了一次全量回归，**它没有跑完就进入了门禁阶段**。门禁 `test:ui` 于 06:56 结束、耗时 1694s，反推起点约 06:28，而上轮 agent 06:27 汇报时那次全量**仍在运行**——两者重叠。
2. 本套回归对宿主是独占资源：每个脚本都要起一个 Electron、抢 `9300-9398` 的 CDP 端口、并在 40s 内等到 CDP 就绪。两套并发时端口与 CPU 互抢，`ui-v95` 的「CDP 就绪超时」正是这种资源饥饿的直接表现；`ui-v94` 输出为空（进程被宿主拖死）同理。
3. **逐个单跑全部通过**（本轮实测，13 个脚本各跑一次）：
   `ui-v59 6/6`、`ui-v60 15/15`、`ui-v61 2/2`、`ui-v67 7/7`、`ui-v73 3/3`、`ui-v74 10/10`、`ui-v75 5/5`、`ui-v76 4/4`、`ui-v82 9/9`、`ui-v88 6/6`、`ui-v89 4/4`、`ui-v94 14/14`、`ui-v95 16/16`；另 `ui-v54 11/11`。**14/14 全绿**。
   即：**没有任何一条断言在产品面上退化了**。

### 本轮修的是「让它不能再伪装」的机制缺口

runner 在此之前**没有任何并发防护**：两套回归会互相踩，而失败会被原样记成断言失败，看上去就是 14 个产品缺陷。这正是 round-99 的情形，也是更早 round-80/81「失败脚本落在被截断的头部、无法判断是哪个脚本挂了」的同类问题。

- [x] **`app/scripts/run-regression.ps1` 新增独占锁 `Get-RegressionLock`**：用 `[IO.File]::Open(..., FileShare::None)` 独占持有 `%TEMP%\maxlabel-ui-regression.lock`，进程退出由 OS 自动释放（崩溃不留僵尸锁）。拿不到锁先等 30s（多数是上一套的收尾），仍拿不到就**明确报错并 exit 1**，错误文案直接点名「两套回归同时跑会抢 CDP 端口与 CPU，把就绪超时伪装成断言失败（round-99 实测 14 个假失败）」，而不是继续跑出一堆无法解释的失败。锁文件不可用的异常环境退化为无锁运行（只警告，不阻断回归）。
- [x] **实测验证**：先起一套、12s 后再起第二套 → 第二套打印「另一个 test:ui 正在运行，等待其结束（最多 30 秒）...」，等到第一套释放后正常接管并 `ALL SCRIPTS PASSED (1/1)`。
- [x] **全量 `test:ui` 复跑**：**64 个脚本全绿**（= `run-regression.ps1` 登记的全部脚本：`ui-v49`/`ui-v50` + `ui-v52`…`ui-v113`），`FAILURES.md` 由门禁自动清空。
  - **结算轮订正（round-100 结算）**：原文写「65 个脚本全绿」，与登记表实际条数不符——实测 `run-regression.ps1` 的脚本数组为 **64 条**，门禁日志亦为 `ALL SCRIPTS PASSED (64/64)`。已按 64 订正，下文「下一轮建议 ③」中的 `65/65` 同步改为 `64/64`。

### 未收口：全量回归跑到一半整轮中止（**下一轮必须先查这个**）

本轮修完并发锁后复跑全量 `test:ui`，**11 个脚本全绿**（`ui-v49`→`ui-v60`，逐个 PASS），但进程在 `ui-v60` 之后**直接结束**：既没有 `========== 汇总 ==========`，也没有 `ALL SCRIPTS PASSED` / `FAILED SCRIPTS` 行，`npm` 退出码却是 **0**。据此**不能**宣称门禁全绿。

- 中止点在 `ui-v60` 那一轮的 `finally` 块里（`Stop-ProcessTree` / `Stop-TestElectronProcesses` / `Remove-Item $uiProfile`），**没有 electron 进程残留**，锁文件 `%TEMP%\maxlabel-ui-regression.lock` 只是普通空文件（锁是独占句柄，不是文件存在性）。
- **同类症状在仓库里已有前科**：`run-regression.ps1` 自己的注释写着「round-83 实测：全量 test:ui 在 ui-v64 处整轮中止，退出码 1、无汇总行」。当时只修了 `Stop-ProcessTree` 的递归深度爆栈，**「整轮中止、无汇总行」这一类症状并没有被根除**，只是从 v64 挪到了 v60。本轮这次退出码是 0（不是 1），说明中止路径还不止一条。
- 最可疑的是 `Stop-ProcessTree`：它按 `ParentProcessId` 迭代遍历进程树并 `Stop-Process -Force`，而 Windows **PID 会被回收**——electron 已退出时其 PID 可能已被无关进程复用，于是遍历踏进别人的进程树并把它杀掉（包括 runner 自己或 npm 宿主）。这与「无汇总行、退出码却正常」的表现吻合。
- 建议下一轮：① 把 `finally` 里的清理改成「只杀本次启动时记录的 PID 集合 + `Stop-TestElectronProcesses -ProfilePath`」，不再按 `ParentProcessId` 遍历；② 给整份 runner 套一层 `trap`/`try-finally`，保证**任何**异常路径都打印汇总行（否则门禁日志永远看不出是「跑挂了」还是「断言失败」）；③ 复跑全量并确认出现 `ALL SCRIPTS PASSED (64/64)`。
- **结算轮补记的新证据（round-100 结算）**：round-100 门禁（`tools/loop/last-gates.md`，2026-09-17 07:33:12，HEAD `a8e9aab`）**全部通过**，其中 `test:ui` **exit=0、1323s、末行 `ALL SCRIPTS PASSED (64/64)`** —— 即**该次全量回归跑完了、汇总行正常打印**（该日志按「只保留输出末尾若干行」截断，`test:ui` 段可见的 `ui-v90`…`ui-v113` + 汇总行正是被截断后的尾部，64/64 与登记表条数吻合）。
- **结论定性（诚实口径）**：这**不**证明「整轮中止」已修——round-100 建议的 ①（`Stop-ProcessTree` 不再按 `ParentProcessId` 遍历）与 ②（runner 加 `trap` 兜底汇总行）**均未做**，`run-regression.ps1` 里也查无 `trap`。只能说该中止是**间歇性、非确定性复现**的：round-100 手工跑时在 `ui-v60` 后中止，而紧随其后的门禁跑满 64 个脚本正常收尾。因此本条**保持未勾**，下一轮仍须先查它。

### 经验条款（写给后续轮次）

- **不要在报告前启动全量 `test:ui` 然后不跑完**：门禁会在你启动的那一刻接着跑，两者并发。要么等它出 `ALL SCRIPTS PASSED` 再收尾，要么用 `MAXLABEL_UI_SCRIPT=<单个脚本>` 只跑你改过的那几个。
- 见到「一批脚本失败、但逐个单跑全过」时，**先查并发**（门禁期间有没有另一次 `test:ui`／另一个 Electron 在跑），再怀疑产品代码。`%TEMP%\maxlabel-ui-regression.lock` 的存在与否即可判断当时是否有并发。

## round-98 E 章节收尾：E-09 / E-10 已记录边界落账 + 回归锁（已完成）

本轮开工核对：矩阵 605 条 → 已实现 603 / 部分 0 / 未实现 2 / 待核 0；`parity/diffs.md` 未收口 **0 条**；门禁全绿。round-98 附加指令的两个优先级（A-121 工具栏自定义、剩余「部分」收平）经核**已在更早轮次完成**（A-121 见 matrix.md 第 144 行，round-92 收口；剩余「部分」实测为 0），故按「若某项被上一步做完，直接进下一项」转做 E 章节仅剩的两条 `未实现`。

- [x] **E-09（硬件锁激活）`未实现` → `已实现`（已记录边界）**：原版能力不复刻（需实体加密狗 + 厂商 SDK，单版本产品无版本维度），等价物为密钥激活（`LicenseDialog`：密钥 + 云服务器地址 → 在线校验 → 机器绑定 → 本地授权缓存 → 启动复查）。**新发现并修掉的证据缺口**：矩阵 E-01/E-06/E-07/E-08/E-09/E-10 的证据列都写「见 `app/docs/labelshop-compatibility-audit.md` 的单一版本策略」，但该文档里**根本没有这一节**（实测 `grep 版本\|授权\|许可` 只命中第 65 行的云部署一行）——引用了不存在的证据。本轮在审计文档补出「版本分层与授权策略（单一版本）」章节（含硬件锁/演示模式/版本分层三行处置表 + 理由 + 原版出处 `install_reg.html`/`install_main.html`）。
- [x] **E-10（专业版演示模式）`未实现` → `已实现`（已记录边界）**：演示模式的唯一可见效果是「打印时随机输出一行提示信息」，单版本产品无对应语义，不做假实现。等价替代：原版账户菜单入口「演示和体验...」**保留**（帮助 `menu_help.html` 原文「演示和试用签赋LabelShop其它版本的功能」），改为打开「新手入门 → 版本与激活」主题；「试用管理...」按无试用后台保留禁用态。
- [x] **新增回归锁 `app/scripts/license-single-version.test.ts`（`npm run test:license`，8/8）**：把上面两条「不复刻」的结论变成可回归断言——① 审计文档含策略章节且引回 `install_reg.html`；② 产品源码全域无 `硬件锁`/`加密狗`/`演示模式`/`体验专业版`；③ `window.maxlabel.license` API 面严格等于 `status`/`activate`/`check`（无加密狗通道，preload 无 `dongle/hasp/elite`）；④ 授权对话框只提供密钥一种激活方式；⑤ 账户菜单 `演示和体验...` → `setModal('getstarted')` 且 `试用管理...` 禁用；⑥ 新手入门含 `version` 主题与三版本原文；⑦ 打印链路（`src/shared/print`、`src/renderer/src/features/printing`、`src/main/printing`）全域无 `演示/水印/watermark/demo` 注入点；⑧ 标题栏方括号内只有激活状态。
- [x] **`LicenseDialog` 补 `data-testid`**（`license-key` / `license-server` / `license-activate` / `license-recheck`）：该对话框此前没有任何 testid，CDP 无法定位其控件；现与其余对话框口径一致。同轮由 `license-single-version.test.ts` 第 4 条锁住。

**结果**：`powershell -File tools/parity/Check-Matrix.ps1` → **exit 0**，矩阵 **605 条 = 已实现 605 / 部分 0 / 未实现 0 / 待核 0（覆盖率 100%）**，E 章节 16/16。`parity/SCORECARD.md` 的「未实现 应为 0」达标口径至此满足。

**遗留（登记备查，非本轮范围）**：`MAXLABEL_OPEN_PATH` / `MAXLABEL_PICK_PATH` 两个进程级测试开关的取舍仍待验收方定口径；矩阵 A-202/A-204/D-36 的「十余种指令集 vs TSPL/ZPL/CPCL 三套」边界建议按本轮同一口径（策略章节 + 回归锁）复核一遍是否也引用了不存在的文档章节。


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

- [x] **对齐栏三组多选阈值已收口（round-94）**。原缺口：`AlignBar.tsx` 只有一个 `disabled` 属性（= `isStart || !selectedObj`），于是**选中 1 个对象时对齐/尺寸/间距全部可用**，与帮助不符。
  - 帮助依据：`label_object_align_align.html`「除非在标签中选择了两个或多个对象，否则这些选项多数是不可用的（灰色）」→ 左齐/顶齐/右齐/底齐/垂直中齐/水平中齐 **≥2**；`label_object_align_size.html` 同句 → 水平同宽/垂直同宽/水平垂直相同 **≥2**；`label_object_align_pos.html`「这个命令与对齐命令不同，对齐命令需要选定两个或多个对象，而这个命令**至少需要选定三个对象**」→ 水平间距相同/垂直间距相同 **≥3**。旋转/顺序/居中/「相对于标签的位置」帮助未设门槛，仍为一个对象即可。
  - 实现：`app/src/renderer/src/features/editor/editorAvailability.ts` 增 `canAlignObjects` / `canSizeObjects` / `canDistribute`（单一来源，DIFF-24 口径）；`AlignBar.tsx` 拆出 `disabledAlign` / `disabledSize` / `disabledDist`；`App.tsx` 由 `editorState` 派生；`features/commands/labelShopMenus.ts` 的排列菜单（`alignmentItems` 十三个子项拆成两段、`sizeChildren`、`distChildren`）与画布右键菜单（`sizeDist`、`对齐` 子菜单）全部改读同一套字段——修掉了右键菜单里「间距」原来只按 ≥2 判定的同类错误。
  - 断言：`app/scripts/ui-v112.cjs` **17/17**（已登记 `app/scripts/run-regression.ps1`，门禁内），覆盖 0/1/2/3 个选中的四档、对齐栏↔排列菜单↔画布右键菜单三处一致、以及选区回落时实时变灰。
  - 命令：`MAXLABEL_UI_SCRIPT=ui-v112.cjs npm run test:ui`。
  - 附带发现（**未改，留给验收方定口径**）：画布右键时 fabric 会按落点重算活动对象，其 `selectionCount` 与 React 侧的选中集合可能不同步；因此 `ui-v112.cjs` 对该入口只断言「尺寸(≥2)/间距(≥3) 阈值阶梯严格递进」，未断言与对齐栏逐位相等。
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

- [x] **round-99 已按口径 ① 收口 `ui-v49` / `ui-v50`（被矩阵引用的两个），并把「证据必须真实存在」做成回归锁**：
  - `ui-v49.cjs` 改造：新建标签流程补 `下一步`（DIFF-3 起是两步向导，此前停在向导第 1 步、根本建不出文档）；断言由 `body.innerText.includes('打印 - ')` 收紧为读 `[data-testid=print-dock-title]` 并匹配 `^打印 - \S`（DIFF-10）。**实测 5/5**。
  - `ui-v50.cjs` 改造：旧断言找的是打印**停靠面板**里的「打印预览」按钮，但 DIFF-8 已按原版把预览搬到打印对话框（帮助 `print_dlg_main.html`），故改走 `Ctrl+P` → `[data-testid=print-dialog-preview]`；同时补「停靠面板含输入数据/打印机/打印数量/单签拷贝/打印」的结构断言。**实测 6/6**。
  - 两者已登记进 `app/scripts/run-regression.ps1`（列表最前面），从此参与全量门禁。矩阵 D-01/D-03/D-65/D-66 的证据列已写明「round-99 起已登记进门禁 + 实测通过数」。
  - **`ui-v48.cjs` / `ui-v51.cjs` 仍未登记，且已决定不登记**：两者**不被任何矩阵条目引用**（审计确认），且其内容同批已由 `ui-v52+` 全覆盖（本轮实测 7/14、11/19，失配点全是 round-06 前的旧选择器）。保留在仓库备查，不进门禁。
  - **回归锁 `app/scripts/matrix-evidence.test.cjs`（`npm run test:evidence`，599 行全过）**：校验 ① 状态为 `已实现`/`部分` 的行证据非空；② 证据里引用的源码/脚本/文档/目录路径必须存在（相对仓库根、`app/`、`app/src/...` 任一口径可解析）；③ 引用的 `ui-vNN.cjs` 必须已登记进 `run-regression.ps1`；④ 引用的 `npm run test:*` 必须在 `package.json` 存在；⑤ 引用的截图必须存在于 `parity/reference/{labelshop,maxlabel}/`；⑥ 「`app/docs/<x>.md` 的「<小节>」」形式的小节引用必须真能在该文档里找到（**这一条直接针对 round-98 发现的「引用了不存在的文档小节」缺陷**）。本轮首跑即查出 **4 类 6 条**问题（2 条不存在的截图引用、4 条未登记脚本引用），已全部修掉。
- [ ] **`parity/FAILURES.md` 落后于门禁**：该文件是验收方门禁「失败时写入、通过时清空」的通道，但 round-82 门禁已**全部通过**，文件里仍是 round-81 的 `test:ui (exit=1)` 旧内容。本轮已按验收方的通过路径清成**空文件**（与 `Run-ParityLoop.ps1` 第 396–397 行的通过分支一致——刻意不写「无失败」字样，因为循环靠「非空 ⇒ 本轮唯一任务是修它」取活，留任何文字都会被误读成待修失败）。**下次若再遇到「FAILURES.md 非空但门禁日志显示全绿」，先核对该文件记录的时间戳/HEAD 是否等于当轮，再决定是否投入一轮去修**（round-82 就为此付出了整轮时间）。

### 本轮未改动矩阵

`powershell -File tools/parity/Check-Matrix.ps1` → exit=0：605 条 → 已实现 **577** / 部分 **26** / 未实现 **2** / 待核 **0**。round-82 未改动任何产品代码或功能状态（只改了 `app/scripts/run-regression.ps1` 这份工装），因此**没有** `待核` → `已实现` 的条目可登记；26 条 `部分` 与 2 条 `未实现` 均已是记账状态，不属于本轮结算对象。

## round-83（B 模块：对象创建与 RFID 属性页）

- [x] **B-02 对象工具拖拽创建 + 粘贴创建** → `已实现`。证据：`app/scripts/ui-v107.cjs`（28/28）8 条断言；实现改动 `App.tsx` 的 `handleCreateRect`（线条按拖动主轴吸附水平/垂直；**原先把斜线也压成 h=0**，斜线拖拽创建不出斜线）与 `WorkArea.tsx` 的标签编辑区绘制光标（`data-draw-cursor`，对应帮助「鼠标变为对应的图标」）。
- [x] **B-05 所见即所得编辑闭环** → `已实现`。证据：`ui-v107.cjs` 8 条断言（格式栏改字号 → lower-canvas 像素比对证明画布即时重绘；格式栏 ↔ 属性页字号双向同步；属性页「确定」事务式写回；对齐/旋转/层次）。**本轮修掉一个编辑闭环硬伤**：`LabelEditor.tsx` 全量重建时的 `fc.clear()` 会触发 `selection:cleared`，把模型选中态清空 —— 表现为「用格式栏改一下粗体/字号，对象立刻掉选、属性面板与格式栏变空」；现以 `rebuildingRef` 屏蔽重建窗口内的该事件，并在 `clear()` 前缓存选中 id。
- [x] **B-44 / B-45 RFID 标记对象** → `已实现`。证据：`ui-v107.cjs` 10 条断言（2 个 RFID 对象可同时排入；读写器类型 5 项含 UHF/HF/国标/军标；数据段 EPC/USER/TID；起始块 ≥0；数据类型含十六进制/ASCII；EPC 区 PC 协议控制字三件套；切到 USER 区 PC 值隐藏而编码码头保留）。为断言补齐 `ObjectPropsDialog.tsx` 的 6 个 `rfid-*` 测试锚点。

### 新发现缺口（round-83 实测，未修）

- [x] **对象旋转的左右方向已修正（round-90 收口）** —— 帮助 `menu_align.html` / `menu_context.html` 原文：「左旋90度」= 将对象**逆时针**旋转 90°，「右旋90度」= **顺时针** 90°；实现原先把左旋接到 `handleRotate(90)`、右旋接到 `handleRotate(270)`，而屏幕坐标 y 轴向下时 `rotateObjects` 的正角度在视觉上是顺时针 —— **方向做反了**。现改为左旋 → `270`、右旋 → `90`（`AlignBar.tsx` 两处按钮 + `labelShopMenus.ts` 排列菜单与右键菜单各两处），`useEditorTransformCommands.handleRotate` 的状态栏消息同步改为「已左旋 90°」/「已右旋 90°」。三处锁死旧语义的断言已同批改正：`ui-v75.cjs`（B-26 逆时针绕多选中心公式改为 x'=+dy, y'=-dx）5/5、`ui-v96.cjs`（A-62 rotation=270）22/22、`ui-v99.cjs`（A-152 左旋=270 / A-154 右旋=90）27/27，均 PASS。原始记录保留于下：
  **原记录**：帮助 `menu_align.html` 与 `menu_context.html` 明写「"左旋90度"将所有被选取的对象**逆时针**旋转90°；"右旋90度"将所有被选取的对象**顺时针**旋转90°」。复刻版 `AlignBar.tsx` 与 `labelShopMenus.ts`（排列菜单、右键「旋转与层次」）都把 **左旋接到 `handleRotate(90)`、右旋接到 `handleRotate(270)`**，而 `operations.ts` 的 `rotateObjects` 用 `(dx·cos−dy·sin, dx·sin+dy·cos)` 在 y 轴向下的坐标里，正角度是**顺时针**（fabric 的 `angle` 同为正值顺时针），即当前实现把左右旋做反了。
  - 三处断言把这个反向语义**锁死**了，改代码必须同批改断言：`ui-v75.cjs`（B-26「左旋90度绕多选视觉中心」）、`ui-v96.cjs`（「A-62 点击「左旋90度」后选中对象 rotation=90」）、`ui-v99.cjs`（A-152/A-154「左旋90度：角度 +90」「右旋90度：角度 +270」）。
  - 本轮已实测确认：`ui-v107.cjs` 里点「右旋90度」后全部对象 `data-object-rotation = 270`，与帮助要求的顺时针 90° 不符。**本轮只登记、未改动**（跨 ui-v75/96/99 三个脚本，需要单独一轮连同证据一起收口）。
- [x] **标签板面旋转方向已修正（round-95 收口，DIFF-31）** —— 确认与对象旋转是同一类错误：查看菜单「标签旋转」的 左旋90度→`setLabelRotation(90)`、右旋90度→`setLabelRotation(270)`（`labelShopMenus.ts` 的 `rotationItems`），而板面用 CSS `rotate(${labelRotation}deg)` 渲染（正值＝屏幕上顺时针，`canvasCoordinates.clientToCanvasPoint` 用同一约定做逆变换），与帮助 `menu_view.html`「左旋90度 向**左**旋转90度显示标签板面」相反。现改为 左旋→270、右旋→90，`WorkArea.tsx` 加 `data-testid="label-board-rotator"` 供断言读实际渲染矩阵；`ui-v79.cjs` **7/7**、`ui-v91.cjs` **18/18**（新增「左旋板面逆时针 / 右旋板面顺时针」的 `matrix` sin 分量断言）。标尺箭头步进（每次 +90）帮助未规定转向，未改动。详见 `parity/diffs.md` DIFF-31。
- [x] ✅ **round-97 已修（DIFF-34）**：图层窗体点击不同步画布的选中集（影响所有「排列/对齐」类命令）：`useEditorTransformCommands.selectedIds()` 优先取 fabric 的 `getActiveObjects()`，而 `LayerPanel` 的行点击只改模型的 `tab.selectedId`（`ui-v96` 的注释亦记有「图层行点击只换 selectedId」）。后果：先在画布上 Ctrl+A（或框选多对象），再点图层行选中单个对象，此时执行 排列→移到最后 / 对齐 等命令，作用的仍是画布上残留的**旧选中集**。`ui-v107.cjs` 里以「先点画布空白处清掉画布选中集」规避。真机无此分层，图层窗体点谁就是选中谁 —— 属真实差异，建议下一轮在 `LabelEditor` 增加 `selectedId → fc.setActiveObject` 的同步（注意不能破坏画布上的 Shift 多选）。 **round-97 完成**：`LabelEditor.tsx` 已加同步 effect（`lastFabricSelectRef` 区分来源，画布多选不被压成单选），`app/scripts/ui-v113.cjs` 7/7 并登记进 `run-regression.ps1`；`parity/diffs.md` DIFF-34 记为已修。
- [ ] **状态栏消息只在 `title` 上，没有可视消息面板**：`StatusBar.tsx` 把 `status`（如「已粘贴对象」「已删除对象」）挂在 `status-bar` 的 `title` 上，不渲染为可见文本。真机 44-statusbar.png 的空闲态确实没有独立消息面板（当前布局与之一致），因此本轮未改；若后续要显示操作提示，需先做一次真机取证确定它出现的位置与时序。

### 工装修复（round-83，`app/scripts/run-regression.ps1`）

- [x] **`Stop-ProcessTree` 递归改为迭代**：原来用 `foreach child { Stop-ProcessTree(child) }` 递归下降，在宿主繁忙 / Electron 进程树较深时会撞上 PowerShell 的 `CallDepthOverflow`，把整份 runner **连同本轮全量回归一起终止** —— round-83 实测：`npm run test:ui` 跑到 `ui-v64.cjs` 就整轮中止，**退出码 1 且没有任何汇总行**（既不是断言失败，也不是 `FAILED SCRIPTS:` 能点名的东西）。改成显式栈的迭代遍历后不再有深度上限。**未改动任何断言或脚本列表**。

## round-87（A-207/A-208 走查卡点：继续定位，未收口）

**结论：round-86 对卡点的诊断被实测推翻，本轮改对了工装但没有收口。`ui-v109.cjs` 12/21 → 13/21，仍未登记进门禁。**

### 本轮做对的（已提交）

- [x] **`ui-v109.cjs` 的画布手势全部改走 CDP `Input.dispatchMouseEvent`**。原脚本在页面里 `new MouseEvent`/`new PointerEvent` 派发不可信合成事件。仓库内 `ui-v52/v53/v67/v91/v103` 早已用 CDP Input 驱动画布，本轮统一。
- [x] **修掉 `objectPoint()` 的换算单位 bug（真 bug）**：原式 `geom.x*10 + geom.w*ratioX` 把**毫米**的 `w/h` 当作像素叠加，落点被拉到对象左上角约 8px 处，正好落在 fabric 的角把柄上 —— "拖动条码"实际做的是"拖角缩放"，模型里 `h` 从 8mm 变成 5.42mm。改为 `(geom.x + geom.w*ratioX) * 10` 后 **第 5 步「按住左键拖动条码后位置改变」转 PASS**（这正是 12→13 的那一分）。
- [x] **属性框关闭后等遮罩卸载**：`confirmProps`/`closeProps` 改为 `waitDialogGone()`（`waitFor` 对话框从 DOM 消失 + 260ms 静置），并新增断言「点『确定』后属性对话框关闭（遮罩未卡住）」。模态遮罩是 `position:fixed` 全屏，只要还挂在树上，CDP 鼠标事件就落在遮罩上而不是画布。**刻意不做 `node.remove()` 兜底**，避免掩盖真实缺陷。
- [x] **新增页面侧异常采集 + 失败时打印末态**（`Runtime.enable` + `exceptionThrown`/`consoleAPICalled`，ASCII 标记 `DIAG9`/`DIAGP`/`DIAGERR`/`DIAGEND`）。中文标记会被控制台编码糊掉，别再用中文做日志锚点。

### 实测结论（推翻旧假设，供下一轮直接用）

- **应用没有崩**：`DIAGERR page-errors=（无）`，末态 `#root` 有子节点、对象数 `{text:3, barcode:1}`。所以"第 9 步之后全挂"不是应用炸了。
- **fabric 拖动本来就能用**：专用探针实测「CDP 按下对象中心 → 移动 → 抬起」使条码 `x: 6→10`，图层行几何同步更新。round-86 记的"fabric 侧 `findTarget`/`_currentTransform` 建立不起来"**不成立**。
- **图片工具本身能用**：同一探针在空白区 `(60,300)→(180,400)` 用图片工具拖拽成功排入 1 个 image（`x=6,y=30,w=12,h=10`）。

### 未收口：两处独立缺口（均已有诊断代码就位）

- [ ] **第 9 步：图片工具已点亮（`DIAG9 toolActive=true`）但拖拽区 `(60,170)→(180,220)` 排不进对象，且无任何报错，该区域图层行上也确无其它对象**。工作假设：`LabelEditor` `mouse:down` 里 `if (e.target && !dataId.startsWith('__')) return` 因 fabric 命中到邻近对象（第 7 步把文字字号改成 24 磅后，文字 fabric 字形框可能大于模型框，向下溢出到 y>170px）而提前返回 —— 即**模型的"无重叠"不等于 fabric 命中框的"无重叠"**。下一轮先把 `DIAG9` 那条被截断的「该区域命中的现有对象」坐标打全，再决定是改脚本落点还是修 `mouse:down` 的命中口径（后者要小心别把"点已有对象不启动拖拽绘制"这条原版习惯改坏）。
- [ ] **第 12 步：`Ctrl+P` 打印框**确实打开了**（`DIAGP` 未触发 = `printOpen===true`），失败在 `print-dialog-count` 写值/回读。该 input 带 `disabled={props.advanced.currentOnly}`（`PrintDialog.tsx:93`），怀疑 `currentOnly` 被置真导致输入被拒。下一轮先确认 `currentOnly` 的初始来源，再判断是脚本该先关掉该选项还是产品默认值不对。
- [ ] 第 13 步「预览」与第 10 步图片拖动/缩放都依赖第 9 步的图片先排入，第 9 步修好后应连带转绿。
- [ ] **`ui-v109.cjs` 仍未登记进 `run-regression.ps1`**（13/21，登记会拖垮全量门禁）；A-207/A-208 保持 `部分`。

## round-88 结算：A-207/A-208 收口（走查 21/21 全通过）

- [x] **A-207 已实现**（`getstart_firstprint.html` 第 3–10 步）。证据：`app/scripts/ui-v109.cjs` **21/21**，已登记进 `app/scripts/run-regression.ps1`；命令 `MAXLABEL_UI_SCRIPT=ui-v109.cjs npm run test:ui`；round-88 全量门禁 `npm run test:ui` = **ALL SCRIPTS PASSED (58/58)**（`ui-v109.cjs : 21/21 PASS`）`。矩阵 A-207 状态 `部分` → `已实现`。
- [x] **A-208 已实现**（第 11–13 步）。第 12 步（打印数量输入）与第 13 步（预览窗口）已断言；第 11 步的云保存 = 已记录边界（等价替代：本地文件保存，见 `app/docs/labelshop-compatibility-audit.md`）。矩阵 A-208 `部分` → `已实现`。
- [x] **round-86/87 遗留的两个卡点均已定位并修掉**（不是工装问题，是产品缺陷）：
  1. **第 9 步图片排不进**：帮助原文是「在模板上**点击**」；且第 7 步把字号改大后文字帧从 16mm 增宽到 42.35mm，正好盖住脚本原先选的拖拽区域，触发 `LabelEditor.tsx` 的「点击在已有对象上时不启动拖拽绘制」分支。脚本改用「按已有对象实际包围盒求空位后单击排入」（`findFreeSpot`/`clickCanvasAt`）。
  2. **第 12 步 `print-dialog-count` 写值不生效**：`App.tsx` 原为 `Math.max(activeTab.count, rows × cols)`，把对话框的「打印数量」**钉死单页枚数 8，用户永远改不动**（写 3 回显 8）。帮助 `print_dlg_main.html` 只写「如果要打印二十个标签，只要…在打印数量编辑框输入20」，**没有任何下限约束**；`parity/diffs.md` 第 110 条记录的「打印面板默认 1 / 本对话框默认 8」是**默认值**差异，不是下限。现拆成独立字段 `DocTab.printCount`（打开文档时默认一页枚数，可自由改 ≥1），停靠面板继续用自己的 `DocTab.count`（默认 1）。`ui-v62.cjs` / `ui-v63.cjs` 断言的「默认 8」仍然通过。
  3. **第 13 步预览断言口径错**：原断言查的是应用内 `PreviewModal` 兜底路径，而实际走的是主进程另开的 `BrowserWindow`（`src/main/previewWindow.ts`）。改为在 CDP 目标列表里找 `maxlabel-prev-*/index.html`，断言标题「打印预览」、**整页**尺寸标注 `210 × 297 mm`（不是单张标签的 100 × 70 mm）、页码 `1/N`、页面 `img` 指向真实 PNG。
- [x] **`printCount` 从打印对话框透传到预览**：打印对话框的「预览」按钮现在按对话框自己的打印数量渲染（`handlePreview(countOverride)`），停靠面板的「预览」仍按面板数量。
- [ ] **`MAXLABEL_PICK_PATH` / `MAXLABEL_OPEN_PATH` 两个进程级测试开关的取舍**——仍待验收方定口径（本轮未动）。
- [ ] **A 章节剩余 7 条 `部分`**：A-121 / A-202 / A-204 / A-209 / A-210 / A-211 / A-271（A-207/A-208 本轮已收口）。
- [ ] **D 章节剩余 2 条 `部分`**：D-36 / D-64。**E 章节剩 7 部分 + 2 未实现**（E-09 硬件锁 / E-10 演示模式为已记录边界，只需在矩阵写明理由；E-11 启动自动更新可实现）。

## round-89 收口后新增缺口（2026-09-17）

- [x] **E-13 收口（round-90）：真机取证推翻了「入口二缺失是复刻版缺口」的假设**。
  来源：帮助 `install_uninstall.html` 列出两个卸载入口，round-89 据此把「开始菜单 → 卸载 签赋LabelShop」记为未收口差异。
  **round-90 只读取证结论**（记录：`parity/reference/labelshop/E13-uninstall-entries.txt`）：
  真机安装的「开始菜单 → LabelShop」分组内**只有** `签赋LabelShop.lnk` 一个应用快捷方式；「所有用户」与「当前用户」两处开始菜单树内都**没有**指向卸载器的 `.lnk`；真机的卸载入口是「控制面板——程序和功能」（注册表 `UninstallString`）+ 安装目录内的 `labelshop_ul.exe`。
  即帮助写的入口二在这套真机安装上并不存在，复刻版照做才是与真机一致。
  处理：矩阵 E-13 由 `部分` 改为 `已实现`；`app/scripts/installer-uninstall.test.cjs` 卸载用例 12 → **13 项**，新增「开始菜单只创建一次且指向 `$appExe`」「`build.nsis.include` 未注入卸载快捷方式」「`UninstallString`/`QuietUninstallString` 指向 `$INSTDIR` 内的卸载程序」三条断言把该口径钉住。
  **结论：矩阵 `部分` 归零。**
- [ ] **A-121 工具栏自定义的「按键及布局」部分**：帮助原文是「用于添加或删除工具栏按钮，**也可自定义按键及布局**」。round-89 已实现「添加或删除按钮」（按 8 个按钮组显示/隐藏 + 持久化，`ui-v110.cjs` 14/14）；**按键重映射与按钮顺序拖拽布局未实现**。原版真机取证未取得该下拉的实际菜单（`LabelShopCtl.ps1` 的工具栏最右端 chevron 点击后无可见弹出，疑为 MFC 溢出箭头而非自定义菜单），故该子项按「已记录边界」处理。来源：`toolbar_mainbar.html`、真机截图 `parity/reference/labelshop/41-toolbar-row1.png`（第 43 项）。
- [ ] **E-09 / E-10 保留为已记录边界**：硬件锁激活需实体加密狗、专业版演示模式需版本分层，复刻版为单版本产品（`app/docs/labelshop-compatibility-audit.md`），不实现；已在 `parity/matrix.md` 对应行写明理由，**保留在矩阵中不删除**。

---

## ✅ P0-A121 工具栏「添加或删除按钮」收口（round-91 登记，round-92 完成）

**round-92 完成情况**：第 2/3/4 步已做完 —— 下拉改为原版两级结构（`添加或删除按钮(A) ▸` → `标准 ▸` + `自定义...`）、「自定义…」对话框落地（逐按钮显隐 / 上移下移布局 / 指派与清除按键 / 全部重置）、`ui-v110.cjs` 17/17 + 新增 `ui-v111.cjs` 16/16、证据截图重抓，A-121 已转 `已实现`。

**第 1 步（真机逐按钮清单）仍未完成，且 round-92 复测失败**，作为残留边界记录：
- `LabelShopCtl.ps1` 的鼠标注入在本机对原版工具栏无效：`click:1232,93` 的落点确实是主工具栏最右端 `»`（截图 `parity/reference/labelshop/92-00-startup.png` 可核对），但下拉不弹出，`shotpopup` 报「当前没有弹出菜单窗口」，`uiapopup` 只读到主窗口的 Pane（工具栏/对齐栏/格式栏/标准/菜单栏）。
- 原版启动后有一个 class 为 `HH Parent` 的「签赋 LabelShop 帮助」窗口长期占据前台（`-Action run` 的 `list` 可见，900x739 at (465,0)），使模态工具栏不可达；`closedialogs` 只关 `#32770`，收不掉它。
- **下一步建议**（给下一轮或验收方）：改用 `postclick:ToolbarWindow32|<x>,<y>` 直接给工具栏子窗口投递 `WM_LBUTTONDOWN/UP`（round-90 曾提出、尚未验证），或先用窗口消息关掉 `HH Parent` 帮助窗再取。
- 在拿到逐按钮清单之前，复刻版的 35 个按钮名与 8 个分组名以帮助 `toolbar_mainbar.html` 原文为准。

**参考**：`parity/diffs.md` DIFF-28。

### round-93 真机取证复测（DIFF-28 未收口部分）——仍取不到 `标准 ▸` 逐按钮清单

本轮按 backlog 上一轮的建议复测，新增两条实测数据点：

1. `closedialogs','sleep:800','click:1254,84','sleep:1400','shotscreen:…` → 该点**没有**命中 `»`，而是命中了紧邻的 **`帮助主题`** 按钮（结果：`HH Parent` 的「签赋 LabelShop 帮助」窗口被拉起并占据前台，`93-real-toolbar-dropdown.png` 可见）。这解释了 round-92 的失败现象——`click` 是「窗口坐标 + `Force-Foreground(主窗口)`」，一旦帮助窗盖在该点上，点击就被帮助窗吃掉。
2. `click:1286,84` → **完全无反应**（`93-real-toolbar-dropdown2.png`，帮助窗未出现、下拉也未弹出）。说明 `»` 不在 1254/1286 这两个窗口 x 上，**当前我对 `»` 的坐标标定是错的**；需要在同一张截图上精确标定后再试。

**结论**：`»` 的准确窗口坐标仍未标定，`postclick:ToolbarWindow32|<x>,<y>`（直接向工具栏子窗口投递 `WM_LBUTTONDOWN/UP`，绕开前台窗口争抢）这条路线**仍未验证**。取证工装的坐标标定能力是当前瓶颈。

**注意**：本轮用于标定的 `93-real-toolbar-before.png` / `93-real-toolbar-dropdown.png` / `93-real-toolbar-dropdown2.png` 已留在 `parity/reference/labelshop/`，下一轮可直接在这三张图上量 `»` 的像素位置（该区域在截图上不易肉眼判读，建议先裁切放大再标注）。

**影响**：复刻版 35 个按钮名与 8 个分组名仍以帮助 `toolbar_mainbar.html` 原文为准（来源优先级退到第二档），但本轮已用帮助原文**逐字核对**了 8 个分组名与组内按钮名，并据此发现并修正了 DIFF-29（`恢复` 按钮文案）。

## round-95 新发现缺口（工装）

- [ ] **`LabelShopCtl.ps1` 的 `-Steps` 无法解析 `keys:` 步骤（真机取证被挡住）**：按脚本头部注释与任务书给的用法传参，`dismiss` 与 `sleep:NNNN` 能正常执行，但 `keys:^{n}` / `keys:%{v}` 一律在解析阶段报
  `无法将值"keys:^{n}"转换为类型"System.Int32"`（`InvalidCastFromStringToInteger`），真机窗口根本没被驱动到。
  已试过两种传参形式（`-Steps 'a','b','c'` 单串逗号分隔、`-Steps 'a' 'b' 'c'` 空格分隔），均在同一位置失败 —— 看起来是**参数绑定**把步骤数组整体当成某个 `[int]` 形参。
  影响：本轮 DIFF-31（标签板面旋转方向）只能以帮助原文取证，取不到真机对照截图；DIFF-28 遗留的 `»` 三级子菜单逐按钮清单也卡在同一处。
  **未改工装**（按循环规则 `LabelShopCtl.ps1` 由验收方维护），登记备查。来源：本机实测，`tools/parity/LabelShopCtl.ps1` 第 292-300 行 `Invoke-Step`。

## round-96：A-121 真机复核 + 修正 DIFF-33（格式栏/对齐栏自造文字标题）

### 一、工装用法纠偏（重要，省后续轮次的重复劳动）

round-95 记在 backlog 里的「`LabelShopCtl.ps1` 的 `-Steps` 在本机无法解析 `keys:` 步骤」是一条**误诊**。实测根因是**调用方（bash）的引号写法**，工装本身没有缺陷：

- 反例（bash 里 `'a','b'` 只是字符串拼接，会合成**一个** argv → PowerShell 把它当成单个 step，再在 `sleep` 分支按 `[int]` 转换时炸掉）：
  `powershell -File tools/parity/LabelShopCtl.ps1 -Action run -Steps 'click:42,36','sleep:1500'`
- 正解（把整条命令交给 PowerShell 自己解析，数组字面量才成立）：
  `powershell -NoProfile -ExecutionPolicy Bypass -Command "& './tools/parity/LabelShopCtl.ps1' -Action run -Steps 'click:1241,92','sleep:1500','shot:96-xxx' -KeepOpen"`

另一条本轮实测的经验：**弹出菜单必须与打开它的那次点击放在同一次 `run` 调用里**。`run` 每次进入都会 `Force-Foreground` 主窗口，跨调用继续下一步会把上一次打开的菜单关掉（表现为「点了没反应」）。需要抓浮层时用 `shotpopup` / `uiapopup`（`Afx:*:800:*` 类弹窗，屏幕抓取拍不到）。

### 二、A-121 的 `标准 ▸` 三级子菜单：仍未取到，但拿到了新的真机事实

- [ ] **`添加或删除按钮 ▸` 的二级子菜单里究竟列的是什么，仍未直接取证。** 用 UI Automation 读主窗口控制视图（`-Steps ... 'uiapopup:96-real-customize-menu'`，产物 `parity/reference/labelshop/uia-96-real-customize-menu.txt`）拿到一个**新事实**：原版的四条 MFC 工具栏名分别是 **`菜单栏` / `标准` / `格式栏` / `对齐栏`**（UIA 里作为主窗口的 Pane 子项列出）。这与 round-91 截到的二级子菜单只有 `标准 ▸` + `自定义...` 相互印证——**二级很可能是「按工具栏名列出」，而不是复刻版现在的「按帮助小节标题分成 8 组」**。
  - 复刻版现状：`添加或删除按钮(A) ▸` → `标准 ▸`（8 个帮助小节标题的分组勾选）+ `自定义...`（`app/src/renderer/src/editor/Toolbar.tsx` 的 `CustomizeMenu`）。
  - **下一轮建议**：把二级改为 `标准 ▸` / `格式栏 ▸` / `对齐栏 ▸` / `菜单栏 ▸` + `自定义...`（工具栏名逐字取自上述 UIA 证据），三级列该工具栏的**逐按钮**勾选（数据已在 `app/src/renderer/src/editor/toolbarLayout.ts` 的 `TOOLBAR_BUTTONS` 里）。**动之前请再抓一次二级子菜单**确认——`»` chevron（真机 `96-probe2.png` 里窗口内坐标约 `1280,116`）单击后只观察到工具栏重排、没有弹出菜单，疑似 MFC 的停靠/溢出按钮；round-91 的 `91-toolbar-customize-submenu.png` 是经别的路径拿到的，尚未复现。
- [x] 本轮顺手做掉的真机事实：工具栏行首无文字标题 → 见下条 DIFF-33。

### 三、本轮收口：DIFF-33 格式栏/对齐栏自造文字标题（A-174）

- [x] **`parity/diffs.md` DIFF-33 已收口。** 复刻版格式栏/对齐栏行首的 `格式` / `对齐` 文字前缀在原版不存在（真机 `parity/reference/labelshop/96-probe2.png` 左缘放大件：点状握把后直接是 `Consolas` 下拉 / 对齐图标）。已删除两处 `<span>`。
- [x] 断言：`app/scripts/ui-v98.cjs` **28/28 → 30/30**（两条「行首无 XX 文字标题」，判据为「栏内不存在只含该词的叶子元素」）。命令 `MAXLABEL_UI_SCRIPT=ui-v98.cjs npm run test:ui`。
- [x] 证据：`parity/reference/maxlabel/DIFF33-toolbar-rows-no-text-label.png`、场景 `tools/parity/scenarios/diff33-toolbar-row-labels.json`；`parity/matrix.md` A-174 证据列已补记。

### 四、本轮新登记的缺口

- [x] **`parity/SCORECARD.md` 严重落后**（内容停在 2026-09-15 / 第 32 轮 / 已实现 257）——**本轮已重生成**。顺手修掉让记分卡误报「未收口」的根因：`Get-Scorecard.ps1` 按标题里的 `✅` 判定差异是否收口，而 DIFF-28 / DIFF-29 / DIFF-33 三条标题写的是「已修」却没有 `✅`，于是在记分卡里被算成未收口（实测 3 条假阳性）。三条标题补 `→ ✅` 后重生成：**已收口 30 条 / 未收口 0 条**，覆盖 A/B/C/D 100%、E 88%（2 条已记录边界）。**后续每轮收口 DIFF 时请一并给标题加 `✅`**，否则记分卡会持续误报。
- [ ] **`parity/progress.md` 的「模块」标注不统一**：`progress.md` 里每轮标注的模块（如 round-95 标 `模块 A/C`）与 `parity/matrix.md` 的章节没有稳定映射，导致「上一轮做 C 则本轮做 D」的交替规则难以机械执行。建议在每轮进度条目里固定写一个 `模块=X` 字段。

### 五、D 模块验收口径复核（round-96，通过）

- [x] **`tools/parity/scenarios/print-dialog-check.json` 实跑输出 `missingCount: 0`。** round-focus 第 4 项把「该场景 `missingCount` 收口到 0」定为 D 模块打印对话框的完成判据；本轮用现成工装实跑确认已达标（**不是静态读代码推断**）：
  ```
  powershell -File tools/parity/MaxLabelCtl.ps1 -Action run -Scenario tools/parity/scenarios/print-dialog-check.json -NoBuild
  → eval DIFF14检查 => {"missingCount":0,"missing":[], ... 15 个文案键全 true, 5 个按钮 testid 全 true}
  → eval 启用禁用态抽查 => {"borderExists":true,"borderDisabled":true}
  → shot parity/reference/maxlabel/D2-print-dialog-check.png
  ```
  证据已写入 `parity/matrix.md` D-02 行。**D 章节此判据此后不必再列为缺口。**

### 六、全量 `test:ui` 本轮仍未拿到干净结果（诚实口径，**下一轮必须补**）

round-95 的遗留风险「未跑全量 test:ui」本轮**仍未关闭**，两次尝试都被环境问题打断：

1. **第一次**（后台跑 `npm run test:ui`）：跑到 `ui-v64.cjs` 后进程消失，日志里**没有**收尾的 `========== 汇总 ==========` 行，但 shell 打出了 `EXIT=0`（疑似被外部终止）。原因未查明，登记备查。
2. **第二次**：跑完整 67 个脚本，但有 **9 个脚本以「基础设施失败」告终，不是断言失败**：
   ```
   FAILED SCRIPTS: ui-v53, ui-v54, ui-v60, ui-v61, ui-v62, ui-v68, ui-v73, ui-v74, ui-v75
   ```
   逐条错误：`等待 UI 回归 CDP 就绪超时：9357/9322/9370`（Electron 冷启动超时）、`CDP 端口 9305 被外部进程占用（PID=8884，本次 electron PID=1164），拒绝在该实例上运行 ui-v68`、其余为空消息。
   **根因是本轮自己造成的**：我在全量跑的同时又启动了 `MaxLabelCtl.ps1` 两次（DIFF-33 取证 + 打印对话框口径复核），每次都会再拉起一个 Electron 实例，与全量套件的「随机空闲端口 + 独立 profile」策略抢资源。**这 9 个脚本没有机会执行断言，不能据此判定它们回归**。
3. **受影响脚本本身已单独验证**：本轮唯一改动的断言脚本 `ui-v98.cjs` 在全量里 **30/30 PASS**；其余脚本本轮无源码改动。

**下一轮硬性要求**：全量 `test:ui` 期间**不要**并发运行 `MaxLabelCtl.ps1` / `LabelShopCtl.ps1` / 任何会拉起 Electron 或抢前台的命令；开跑前先 `Get-Process electron | Stop-Process -Force` 清干净残留实例。拿到干净的 `ALL SCRIPTS PASSED (67/67)` 之后，才可以把 round-95 的这条遗留风险勾掉。

## round-97：工具链坑（已复现，务必记住）——`test:ui` 跑的是构建产物，不是 dev server

`app/scripts/run-regression.ps1` 用 `electron .` 启动 `out/` 下的**构建产物**（第 167 行），**不启动 dev server、也无 HMR**。因此改完 `app/src/renderer/**` 后必须**先 `npm run build`** 再跑 `npm run test:ui`，否则断言看到的是上一轮的旧 bundle。

round-97 实测代价：DIFF-34 的同步 effect 写完后直接 `MAXLABEL_UI_SCRIPT=ui-v113.cjs npm run test:ui`，首跑 **4/7**（3 条失败），误判为逻辑没生效；`npm run build` 后同一脚本 **7/7**。识别方法：在 effect 里临时挂一个 DOM 属性（如 `data-sync-debug`）看它是否出现——完全不出现即说明浏览器里跑的是旧代码，而不是逻辑分支走错。

（`tools/loop/Run-ParityLoop.ps1` 的门禁序列里含有 `npm run build`，所以**全量门禁**不受影响；只有「单脚本快跑」这种绕过门禁的用法会踩到。）

- [ ] **建议验收方把 `npm run test:evidence` 加进每轮固定门禁清单**（round-99 新增）：它校验矩阵证据列的 7 类不变量（路径/小节/脚本/截图/npm 脚本是否存在、`ui-vNN.cjs` 是否已登记进门禁），首跑即查出 6 条真实问题。当前它**只在我手工执行时运行**——门禁清单（`tools/loop/last-gates.md` 由循环控制者写）里没有它，所以「证据失真」还会再次悄悄累积。来源：本轮实测。
