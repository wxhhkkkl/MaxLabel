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
