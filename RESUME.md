# 重启后从这里继续（RESUME）

> 更新于 2026-09-21 13:30（round-58：需求清单「对象属性」56/56 全部取证完成；DIFF-61 条码码制专属字段对齐；待出 v1.0.15）。上一版写于 09-21 11:00（round-57）。

## 一、当前状态

| 项 | 值 |
| --- | --- |
| 分支 | `main`（v1.0.14 已推送；v1.0.15 本轮提交后推送） |
| 版本 | `app/package.json` = **1.0.15**；安装包 `app/release/MaxLabel-Setup-1.0.15.exe` |
| 标签 | `v1.0.0` … `v1.0.15` |
| 矩阵 | `parity/matrix.md` 605 条 → **已实现 605 / 部分 0 / 未实现 0 / 待核 0（100%）**，A272 / B141 / C101 / D75 / E16 |
| 未收口差异 | **3 条**（`parity/diffs.md`：DIFF-57 缩减量字段、DIFF-60 观察项、DIFF-61 剩余汉信码版本列表） |
| 需求清单 | **已填 119/194**：标签格式 13 + 打印机属性 6 + 系统选项 6 + 对象编辑 15 + 打印和预览 15 + 其它 8 + **对象属性 56**；余 **75 条**（数据源 55 / 数据库 19 / 授权 1）见 `parity/需求清单-待验证队列.md` |
| 门禁 | typecheck / architecture / editor / geometry / history / printer / print / render(54) / workspace / barcode / color / label-formats / installer / evidence / Check-Matrix 全绿；全量 UI `ui-v48 … ui-v126` 共 **77 个脚本** |
| 循环 | **已停机**：`tools/loop/HALT` 存在。驱动器支持 `-Agent codex\|claude`（Claude CLI 在 `D:\claudeCode\claude.exe`） |
| 真机 | 佳博 GP-1324D（`USB001`，无打印队列 → USB 发送提示装官方驱动）；另残留测试用 `TSC TSPL-N (203 dpi)`（需鼠标选中后移除） |
| 远端 | `main`、`codex/parity-loop`、`claude/parity-loop` 已推送；v1.0.2/v1.0.3 及之后的推送视本机代理可用性（`github.com:443` 直连超时、本机 127.0.0.1:1080 代理未监听） |

## 二、重启后要做的事

### 1) 只验证、不跑循环（先做这个）

```powershell
cd D:\workspace\maxlabel\app
npm run build            # 必须先 build：test:ui 跑的是 out/ 构建产物，不是源码
npm run typecheck
npm run test:print
npm run test:render
npm run test:ui          # 69 个脚本，约 30-40 分钟
npm run test:evidence
cd ..
powershell -File tools\parity\Check-Matrix.ps1
powershell -File tools\parity\Report-Progress.ps1      # 一键进度快照
```

### 2) 恢复循环（Claude 或 Codex）

```powershell
Remove-Item D:\workspace\maxlabel\tools\loop\HALT
cd D:\workspace\maxlabel
# Claude Code 续跑：
& tools\loop\Start-Loop.ps1 -BatchRounds 12 -MaxTotalRounds 80 -Agent claude
# 或 Codex（额度恢复后）：
& tools\loop\Start-Loop.ps1 -BatchRounds 12 -MaxTotalRounds 80 -Agent codex
```

### 3) 推送

```powershell
cd D:\workspace\maxlabel
git push origin main
git push origin v1.0.2      # 若已打标签
```

## 三、剩余工作（按优先级）

1. **需求清单待验证队列**（`parity/需求清单-待验证队列.md`）：已填 **119/194**（标签格式 13 + 打印机属性 6 + 系统选项 6 + 对象编辑 15 + 打印和预览 15 + 其它 8 + 对象属性 56）；余 **75 条**：
   数据源 55 / 数据库 19 / 授权 1。下一轮顺序：**数据源 55 → 数据库 19 → 授权 1**。
   取证口径：每条写「原版有 / 原版无 / 原版有但受限」，附可复现步骤；`×` = 待验证/不确定，不等于原版不支持。
   **真机读值链路**（`parity/reference/labelshop/PROBE-round114.md` + round-57/58 补）：
   `工具菜单 %t{DOWN n}{ENTER}` 选工具 → `postdrag:docview|x,y|x,y` 拖出对象 → `Alt+Enter` 开属性 →
   `keydlg:^{TAB}` 翻页 → `Probe-LabelShopCombos.ps1`（某页**全部下拉的选项**）/
   `Read-LabelShopDialogValues.ps1`（输入框的值）/ `Probe-LabelShopPropertyPages.ps1`（逐页导出）/
   `Probe-LabelShopSymbologyBatch.ps1`（把 20 个码制逐个切过去读）。
2. **未收口差异 3 条**：DIFF-57（条码页缺「缩减量」）、DIFF-60（观察项：真机 EAN/UPC 无「附加条码」、25 码族无独立校验字符，复刻版按帮助保留）、
   DIFF-61 剩余（汉信码「版本」真机 85 项、复刻版只有 4 项）。
3. **对象编辑取证剩下的三处真机确认**（详见 `parity/reference/labelshop/PROBE-round114.md`）：
   ① CTRL+拖动到底是复制还是移动；② 原版拖动有没有「对齐参考线」吸附；③ 点空心矩形**内部**算不算选中。
4. **打印机链路的两处待用户配合项**：装佳博官方驱动后验证 USB「有队列」发送；移除真机上残留的 `TSC TSPL-N (203 dpi)`。
5. **E 区边界 5 条**（台账已写理由）：硬件锁激活、专业版演示模式、三版本分层字段、起始页服务端运营图文、内置驱动不支持预览。

## 四、循环工装现状（都在仓库里）

| 工装 | 作用 |
| --- | --- |
| `tools/loop/Start-Loop.ps1` | 监管器：批次接力、HALT/STOP、连续空转停机、`-Agent codex\|claude` |
| `tools/loop/Run-ParityLoop.ps1` | 驱动器：每轮新会话 + 独立门禁 + 额度哨兵 + 卡死判定（20 分钟双静默）+ 3 连败回滚 |
| `tools/parity/Report-Progress.ps1` | 进度快照（写 `parity/PROGRESS-LATEST.md`） |
| `tools/parity/Check-Matrix.ps1` | 矩阵完整性校验 |
| `tools/parity/ACCEPTANCE.md` | 合并前验收清单 |
| `tools/parity/MaxLabelCtl.ps1` + `maxlabel-cdp.cjs` | 复刻版 CDP 驱动 |
| `tools/parity/LabelShopCtl.ps1` | 真机驱动（`start/run/shot/list/close`，步骤 `keys:/click:/clickdlg:/btn:/listctl:/shotdlg:`） |
| `tools/parity/Probe-LabelShopCombos.ps1` | 真机对话框下拉读取（CB_GETCOUNT/CB_GETLBTEXT/CB_SETCURSEL + WM_COMMAND） |
| `tools/parity/Read-LabelShopListView.ps1` | 真机 `SysListView32` 全部行读取（跨进程 LVITEMW + LVM_GETITEMTEXTW），可 `-SelectRow` |
| `tools/parity/Invoke-LabelShopButton.ps1` | 用 PostMessage(BM_CLICK) 点按钮（点「安装」这类会弹模态的按钮时不会被阻塞） |
| `tools/parity/Dump-LabelShopUia.ps1` | 按标题 dump 窗口的 UIA 控件树（含 ValuePattern 值） |
| `tools/parity/Read-LabelShopDialogValues.ps1` | **新（round-114）**：跨进程读对话框**输入控件的值**（Edit 走 `WM_GETTEXT`，ComboBox 读 CB_GETCURSEL/CB_GETLBTEXT），并按几何给输入框配上左侧/上方的标签文字——真机属性页的水平/垂直/宽高就靠它读回来 |
| `tools/parity/Invoke-LabelShopSteps.ps1` | **新（round-114）**：从文本文件读步骤驱动真机（命令行里的 `^` 会被吃掉，步骤写成文件才稳） |

## 五、本机环境易踩的坑（血泪清单）

- `test:ui` 跑 `out/` 构建产物：改 renderer 源码后**先 `npm run build`**，否则断言看到旧构建。
- 改 `.ps1`（含用编辑器工具改）会**抹掉 UTF-8 BOM**，Windows PowerShell 5.1 随即按 GBK 解析中文注释报 `Unexpected token '}'`；改完确认首字节是 `EF BB BF`。
- 用 PowerShell 改**无 BOM 的 UTF-8 文件**（如 `app/package.json`）时，`Get-Content -Raw` 会按 GBK 解码 → 中文变乱码 + 写入控制字符，`npm` 直接报 `EJSONPARSE Bad control character`。必须用 `[IO.File]::ReadAllText($p, [Text.UTF8Encoding]::new($false))` 读、`[IO.File]::WriteAllText` 写；改版本号后先用 `node -e "require('./package.json')"` 验证能解析。
- `npm run dist` / `build-windows.cjs` 前先 `Get-Process MaxLabel | Stop-Process`，否则 `release\win-unpacked` 被占用报 `EBUSY: rmdir`。
- 打包命令的"未检测到代码签名证书"走 stderr，PowerShell 会把它当命令失败（exit 1），但产物正常生成。
- 长命令用后台作业（工具单次命令 10 分钟上限）；`pwsh` 不在 PATH，脚本用 `powershell.exe` 跑。
- 并发跑两套回归会抢 CDP 端口与 CPU，制造假失败（运行器有独占锁 `%TEMP%\maxlabel-ui-regression.lock`）。
