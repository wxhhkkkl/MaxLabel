# round-141 进度 —— 修 round-140 的两条门禁红（`FAILURES.md` 非空时的唯一任务）

> 开工核对：`parity/FAILURES.md` **非空**（round-140 门禁 `test:ui` 红了两条：`ui-v107.cjs`、`ui-v121.cjs`）
> → 按流程第 1 条，本轮**唯一任务**是修好它，修完再谈新功能。**本轮没做任何新功能**。

## 一、`ui-v121.cjs`（11/12 → **14/14**）：环境变化造成的假红，产品无罪

| 步骤 | 结果 |
| --- | --- |
| 单跑复现 | ✅ 复现，失败项与门禁一致 |
| 抓到失败时的真实输出 | ✅ 临时 debug 打出：`USB001 (Gprinter GP-1324D)` / `→ 成功：已通过打印队列 Gprinter GP-1324D (USB) 发送 18 字节（RAW）` |
| 定性 | **环境变化**：本机给 Gprinter GP-1324D 装上了 `Generic / Text Only` 驱动，`USB001` 上出现了打印队列（round-139 门禁 13:33 还是 12/12，round-140 门禁 14:19 就红了）。原断言要求输出必须是「没有找到 Windows 打印队列」—— 它把**环境前提**当成了恒定值；队列一出现，打印后台就走了另一条同样正确的分支 |
| 产品侧 | **不改**（`commandTransport.ts` 的两条分支都是有意的、注释写明的行为） |
| 断言侧 | 改为**按环境取期望**：用 `listPrinters()` 的 `port` 列（DIFF-91 增补的真实 `Win32_Printer.PortName`，与打印后台查同一列）判断该 USB 端口有无队列 → 要求对应输出。**12 → 14 条，覆盖了两条分支**（原来只覆盖「无队列」一种），强度不降 |

## 二、`ui-v107.cjs`：单跑 3 次全绿，**不可复现**，不猜着改

```
MAXLABEL_UI_SCRIPT='ui-v107.cjs' npm run test:ui   →  28/28 PASS   （连跑 3 次，三次全绿）
```
- round-140 的产品 diff（`67c160d`… 实为 `67c160f`）只碰 `App.tsx` / `PrinterSettings.tsx` / `Modal.tsx` / 两个 IPC 文件；
  ui-v107 覆盖的是 B-02 拖拽创建 / B-05 所见即所得 / B-44/B-45 RFID —— **无交集**。
- 时间线上唯一可疑的是**资源争用**（验收方刚用独立实例跑过真实打印；门禁时段本机正在装打印机驱动）。
- **处置：不改它的断言**（没有证据就改，等于瞎猜）。改为补**取证能力**（见三）。

## 三、顺手补掉「失败断言原文查不到」这个取证盲区（门禁日志截断的真问题）

round-140 的 ui-v107 只在末行 `FAILED SCRIPTS:` 露了个名，**失败的是哪条断言、实际值多少，全被截掉了** ——
这正是验收方 round-205 提过的请求（"门禁对 test:ui 保留全量日志 / 失败脚本单独落盘"）。本轮做掉：

1. `app/scripts/run-regression.ps1` 新增 `Write-FailureLog`：失败脚本的**完整输出**写到
   `tools/loop/logs/fail-<脚本>-<时间戳>.log`（该目录在 `.gitignore` 里，不进仓库）；runner 异常路径还会附
   `electron stderr` 末 60 行（CDP 超时/启动崩了这类真凶通常就在那里）。写日志本身 try/catch 吞异常 —— 取证失败不能反过来把回归跑挂。
2. **顺带修掉中文乱码**：PowerShell 5.1 用 `[Console]::OutputEncoding`（本机 = GBK 936）解码**外部命令**输出，
   node 的 UTF-8 于是被解成「鎺㈤拡」—— round-140 门禁日志里满屏如此，失败日志存下来也没法读。
   现在只在跑脚本那一小段切 UTF-8，拿回正确的 `$out` 后**立刻还原**（还原后本进程自己的中文仍按原编码输出，门禁日志不受影响）。
3. `app/scripts/runner-safety.test.cjs` 新增 **6 条**静态断言钉住上面两条（**18 → 24** checks）。

**实测验证**（跑完即删的临时探针，已确认删除）：`MAXLABEL_UI_SCRIPT='_tmp-fail-probe.cjs' npm run test:ui`
→ 落盘 `tools/loop/logs/fail-_tmp-fail-probe-20260923-142636.log`，内容是**可读**的
`FAIL 探针断言（这条原文必须出现在失败日志里） => false` + `1/2 PASS`。

## 四、命令与结果（全部本轮实跑）

```
MAXLABEL_UI_SCRIPT='ui-v121.cjs' npm run test:ui   -> 14/14 PASS   exit=0（改后）
MAXLABEL_UI_SCRIPT='ui-v107.cjs' npm run test:ui   -> 28/28 PASS   ×3
MAXLABEL_UI_SCRIPT='_tmp-fail-probe.cjs' npm run test:ui -> 1/2（故意红）→ 失败日志落盘已验证，探针已删
npm run typecheck         -> 通过
npm run test:architecture -> 8 architecture checks + 24 runner safety checks passed（原 18）
npm run test:editor       -> 通过
npm run test:geometry     -> 通过
npm run test:history      -> 通过
npm run test:print        -> 通过
npm run test:render       -> 66 checks passed
npm run test:workspace    -> 通过
npm run build             -> ✓ built
powershell -File tools/parity/Check-Matrix.ps1 -> 校验通过（609 条，100%）
```
**未跑全量 `test:ui`**（79 脚本约 40–50 分钟，超本轮预算）：本轮改了 `app/scripts/`（runner + 两个脚本），
按策略由验收方驱动器跑全量。已单跑本轮**动过的**两个脚本（ui-v121 / ui-v107），且 runner 的改动由
`runner-safety.test.cjs` 的静态断言 + 探针实测覆盖。

## 五、给下一轮

- **TOP #2 文本页对齐**仍是最该做的（依据 `parity/P1-对象属性对照表.md` + dump `probe-r201-textprops-text-tree.txt`）。
- `tools/loop/logs/fail-*.log` 是本地工件（gitignore），**不要提交**；排查完可随手删。
- 如果全量门禁再出现 `ui-v107` 红，**直接看新落盘的 `fail-ui-v107-*.log`** —— 里面有失败断言原文，不用再猜。

---

# round-140 进度 —— TOP 待办 #4「两条打印小改」（DIFF-91 / A1 + A3）

> 开工核对：`parity/FAILURES.md` **为空** → 无阻塞修复；按 `tools/loop/round-focus.md` 的 TOP 待办取活。
> TOP #1（补登 DIFF-87~90）经查**上一轮已完成**（`parity/diffs.md:2195/2206/2217/2228`），故本轮从 #4 起做。

## 一、两条改动都是「数据现成、没接上」

| # | 真机 | 复刻版（改前） | 改法 |
| --- | --- | --- | --- |
| **A1** | `名称: Microsoft Print to PDF` / `位置: PORTPROMPT:`（`probe-63-30-print-dialog.png`） | `打印机` / `Windows 打印机驱动端口`（**占位词**） | 取真实数据，见下 |
| **A3** | `Gprinter GPL-N (203 dpi) 属性` = **`<设备名> 属性`**（`probe-15-cloudbox-port.png`） | `PrinterSettings.tsx` 写死 `title="打印机设置"` | 同上 |

**关键发现（A1 的根因不在 `PrintDialog.tsx`）**：该对话框只吃 props，占位词是**调用方** `App.tsx` 传进来的。
而 `printerPositionOf()` 的驱动端口分支**写死了**回退串 —— 原因是 **Electron 的 `getPrintersAsync()` 根本不提供端口**
（`PrinterInfo` 只有 name/displayName/description/options，实测 `electron.d.ts:11262`），所以那里没数据可用。
同理它也拿不到「哪台是默认打印机」，所以「名称」的兜底只能是字面量 `'打印机'`。

## 二、改动（**新增真实数据源，不编造**）

1. `src/main/printing/commandTransport.ts` 新增 `listWindowsPrinterFacts()` —— 一次 `Win32_Printer` 查询取回
   `Name`→`PortName` 表与 `Default` 打印机名（真机「位置」列的数据就是这个）。
2. `src/main/ipc/registerPrintIpc.ts` 的 `printers:list` 增补 `port` 与 `isDefault`（取不到就不加这个字段，不填假值）。
   `src/shared/ipcContract.ts` 的返回类型同步。
3. `src/renderer/src/App.tsx` 新增 `printPrinterInfo`：
   - 模板选了系统打印机（驱动端口）→ 取该机**真实名与端口**；
   - 模板没指定 → 回退**系统默认打印机**（与真机该状态下显示默认打印机一致）；
   - LabelShop 内置打印机（自带 tcp/com/lpt 端口配置）→ **仍沿用配置里的端口描述，不被覆盖**（否则会把内置打印机的端口带偏）。
4. `src/renderer/src/dialogs/PrinterSettings.tsx` 标题改 `` `${设备名} 属性` ``。
5. `src/renderer/src/dialogs/Modal.tsx` 给标题加 `data-testid="modal-title"`（便于断言精确到标题，不再靠 `textContent` 前缀匹配）。

## 三、命令与结果（全部本轮实跑）

```
MAXLABEL_UI_SCRIPT=ui-v142.cjs npm run test:ui   ->  6/6 PASS   （本轮新增）
MAXLABEL_UI_SCRIPT=ui-v123.cjs npm run test:ui   -> 17/17 PASS  （读「名称/位置」+「打印到文件」回退）
MAXLABEL_UI_SCRIPT=ui-v63.cjs  npm run test:ui   -> 12/12 PASS
MAXLABEL_UI_SCRIPT=ui-v108.cjs npm run test:ui   ->  8/8 PASS
MAXLABEL_UI_SCRIPT=ui-v120.cjs npm run test:ui   -> 16/16 PASS
npm run typecheck         -> exit 0
npm run test:architecture -> 8 checks + 18 runner safety passed
npm run test:editor       -> 42 checks passed
npm run test:geometry     -> 1 check passed
npm run test:history      -> 9 checks passed
npm run test:print        -> 110 断言组通过
npm run test:render       -> 66 checks passed
npm run test:workspace    -> PASS
npm run build             -> ✓ built
powershell -File tools/parity/Check-Matrix.ps1 -> 校验通过（609 条，100%）
```

**新脚本 `app/scripts/ui-v142.cjs` 的判定口径是值级、可证伪的**（不是"标题里有『属性』就算过"）：
把 UI 上读到的名称/端口，与**同一时刻** `window.maxlabel.listPrinters()` 的真实返回**逐字比对**，
并要求名称与端口**出自同一台打印机**（防止"张三的名 + 李四的端口"拼出来也算过）。
本机实测 = `Microsoft Print to PDF` / `PORTPROMPT:`，与真机实拍一致。
**未实跑**：全量 `test:ui`（本轮改了 `renderer/`，按策略由验收方驱动器跑全量）；已单跑上面 5 个最相关的脚本。

## 四、提醒（给下一轮）

- **A2/A4 不是缺口**（验收方 round-220 已确认）——不要动。
- **下一个该做的是 TOP #2 文本页对齐**（三个单选 + `水平对齐(&A):` + `行宽度(&W):` + `字符模板(&T):` 复选+只读输入），
  依据 `parity/P1-对象属性对照表.md` + dump `probe-r201-textprops-text-tree.txt`。
- **字体页那轮会撞断言迁移**：`ui-v78.cjs:89` / `ui-v125.cjs:163` 的 `字体宽度缩放倍数` 会红（DIFF-90 已预告，属预期内）。
## round-140  (2026-09-23 14:19:45)

- codex: exit=0，用时 422s
- 门禁: 失败: test:ui ❌
- HEAD: c044899eb9fd9b7d0a86312a2b9b96a44448da39 → 7b7c3fe3e047e0d6ad1fdf84387c3e124f2852ad；有进展: True；连续失败: 1；连续零进展: 0

### codex 汇报

本轮完成。汇报如下：

## 完成的条目

**TOP 待办 #4「两条打印小改」→ DIFF-91（A1 + A3），已收口并提交。**

| # | 原缺口 | 现状 |
|---|---|---|
| A1 | 打印对话框「打印机 **名称/位置**」显示占位词 `打印机` / `Windows 打印机驱动端口` | 现与真机一致显示真实设备名与端口（本机实测 `Microsoft Print to PDF` / `PORTPROMPT:`，与真机实拍 `probe-63-30-print-dialog.png` 逐字相同） |
| A3 | 打印机属性窗口标题写死 `打印机设置` | 改成真机口径 `` `${设备名} 属性` ``（`probe-15-cloudbox-port.png`） |

**先说一条核对结果**：TOP #1（补登 DIFF-87~90）经查**上一轮已完成**（`diffs.md:2195/2206/2217/2228`），所以我没有重复做，直接从 #4 取活。

**根因不是「忘了接」，是「没数据可用」**——这点值得记一笔：`PrintDialog.tsx` 只吃 props，占位词是调用方 `App.tsx` 传进去的；而 `printerPositionOf()` 的驱动端口分支之所以写死回退串，是因为 **Electron 的 `getPrintersAsync()` 根本不返回端口**（`electron.d.ts:11262` 的 `PrinterInfo` 只有 name/displayName/description/options），也拿不到「哪台是默认打印机」。

## 改动的主要文件

- `src/main/printing/commandTransport.ts` — 新增 `listWindowsPrinterFacts()`（一次 `Win32_Printer` 查询取 `Name`→`PortName` 表与 `Default` 打印机名）
- `src/main/ipc/registerPrintIpc.ts` — `printers:list` 增补 `port` / `isDefault`；`src/shared/ipcContract.ts` 类型同步
- `src/renderer/src/App.tsx` — 新增 `printPrinterInfo`：模板已选系统打印机→取真实名与端口；未指定→回退**系统默认打印机**；LabelShop 内置打印机→**仍沿用配置端口，不被覆盖**
- `src/renderer/src/dialogs/PrinterSettings.tsx` — 标题改 `<设备名> 属性`
- `src/renderer/src/dialogs/Modal.tsx` — 标题加 `data-testid="modal-title"`
- 新增 `app/scripts/ui-v142.cjs`（已注册进 `run-regression.ps1`）

## 跑了哪些命令、结果如何

```
MAXLABEL_UI_SCRIPT=ui-v142.cjs  ->  6/6 PASS   （本轮新增）
MAXLABEL_UI_SCRIPT=ui-v123.cjs  -> 17/17 PASS  （读「名称/位置」+「打印到文件」回退）
MAXLABEL_UI_SCRIPT=ui-v63.cjs   -> 12/12 PASS
MAXLABEL_UI_SCRIPT=ui-v108.cjs  ->  8/8 PASS
MAXLABEL_UI_SCRIPT=ui-v120.cjs  -> 16/16 PASS
typecheck / architecture / editor / geometry / history / print / render / workspace / build -> 全 exit 0
Check-Matrix.ps1 -> 校验通过（609 条，100%）
```

新脚本的判定口径是**值级、可证伪**的：把 UI 读到的名称/端口与同一时刻 `listPrinters()` 的真实返回**逐字比对**，并要求两者**出自同一台打印机**（防止「张三的名 + 李四的端口」拼出来也算过），同时断言不再是那两个占位词。

## 剩余风险与下一步建议

1. **全量 `test:ui` 我未跑**（本轮改了 `renderer/`，按策略由你的驱动器跑全量）。已单跑 5 个最相关的脚本全绿；静态核对过没有任何脚本断言被改掉的标题文字（`ui-v80`/`ui-v82` 里出现的「打印机设置」是断言**名**，不是 DOM 文本查询）。
2. **A2/A4 不是缺口**，本轮未动。
3. **下一轮建议做 TOP #2 文本页对齐**（三个单选 + `水平对齐(&A):` + `行宽度(&W):` + `字符模板(&T):` 复选+只读输入），依据齐备。提醒：**字体页那轮**会让 `ui-v78.cjs:89` / `ui-v125.cjs:163` 的 `字体宽度缩放倍数` 断言变红——DIFF-90 已预告，属预期内迁移，不是产品回归。
4. 我**没动** `parity/reference/**` 与 `tools/parity/LabelShopCtl.ps1`。

用时偏紧（45 分钟硬超时），所以我在完成 #4 后**没有硬开文本页**——那是个会牵动多个断言的中等改动，半途而废会让红条数读不准，不如留一整轮做透。

---

