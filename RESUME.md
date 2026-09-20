# 重启后从这里继续（RESUME）

> 更新于 2026-09-21 02:20（round-111：TCP/IP 四段 IP 控件 + 打印机链路收口）。上一版写于 09-21 01:00（round-110）。

## 一、当前状态

| 项 | 值 |
| --- | --- |
| 分支 | `main`（与 `origin/main` 同步：`418fa59`） |
| 版本 | `app/package.json` = **1.0.9**；安装包 `app/release/MaxLabel-Setup-1.0.9.exe` |
| 标签 | `v1.0.0` … `v1.0.9` 本地与远端都有 |
| 矩阵 | `parity/matrix.md` 605 条 → **已实现 605 / 部分 0 / 未实现 0 / 待核 0（100%）**，A272 / B141 / C101 / D75 / E16 |
| 未收口差异 | **0 条**（`parity/diffs.md` DIFF-1…44） |
| 打印机链路 | **用户三点反馈已全部收口**：见 `parity/打印机链路-复刻对照.md`（安装逻辑 DIFF-37/43、删不掉 DIFF-37、卷筒展示 DIFF-37/38/41/42/44） |
| 门禁 | typecheck / architecture / editor / geometry / history / printer / print / render(54) / workspace / barcode / color / label-formats / installer / evidence / Check-Matrix 全绿；全量 UI `ui-v48 … ui-v121` 共 **72 个脚本** |
| 循环 | **已停机**：`tools/loop/HALT` 存在。驱动器支持 `-Agent codex\|claude`（Claude CLI 在 `D:\claudeCode\claude.exe`） |
| 真机 | 佳博 GP-1324D（`USB001`）；**没有打印队列** → 复刻版 USB 发送返回「请先安装官方驱动」；真机另残留测试用 `TSC TSPL-N (203 dpi)`（需鼠标选中后移除） |
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

1. **《软件功能需求清单》待验证队列**（`parity/需求清单-待验证队列.md`，194 条：×149 / 不能实现 25 / 未见 19 / 待定 1）。
   用户口径已确认「× = 待验证 / 不确定」，队列里每条都留了「取证结论」列与分类取证方法；
   下一轮起按分类逐条真机取证，结论写「原版有 / 原版无 / 原版有但受限」三态。
   建议顺序：标签格式 13 条 → 打印机属性 6 条 → 系统选项 6 条 → 对象属性 56 条 → 数据源 55 条 → 数据库 19 条 → 对象编辑 15 条 → 打印和预览 15 条 → 其它 8 条 → 授权 1 条。
2. **打印机链路的两处待用户配合项**（其余已收口，见 `parity/打印机链路-复刻对照.md`）：
   - 装上佳博 GP-1324D 的官方 Windows 驱动（建出打印队列）后，实测复刻版 USB 端口的 raw 发送；
   - 真机上残留的测试用 `TSC TSPL-N (203 dpi)` 需要用户用鼠标选中后移除（工装改不了原版当前行）。
3. **E 区边界 5 条**（台账已写理由）：硬件锁激活、专业版演示模式、三版本分层字段、起始页服务端运营图文、内置驱动不支持预览。

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
| `tools/parity/Dump-LabelShopUia.ps1` | 按标题 dump 窗口的 UIA 控件树 |

## 五、本机环境易踩的坑（血泪清单）

- `test:ui` 跑 `out/` 构建产物：改 renderer 源码后**先 `npm run build`**，否则断言看到旧构建。
- 改 `.ps1`（含用编辑器工具改）会**抹掉 UTF-8 BOM**，Windows PowerShell 5.1 随即按 GBK 解析中文注释报 `Unexpected token '}'`；改完确认首字节是 `EF BB BF`。
- `npm run dist` / `build-windows.cjs` 前先 `Get-Process MaxLabel | Stop-Process`，否则 `release\win-unpacked` 被占用报 `EBUSY: rmdir`。
- 打包命令的"未检测到代码签名证书"走 stderr，PowerShell 会把它当命令失败（exit 1），但产物正常生成。
- 长命令用后台作业（工具单次命令 10 分钟上限）；`pwsh` 不在 PATH，脚本用 `powershell.exe` 跑。
- 并发跑两套回归会抢 CDP 端口与 CPU，制造假失败（运行器有独占锁 `%TEMP%\maxlabel-ui-regression.lock`）。
