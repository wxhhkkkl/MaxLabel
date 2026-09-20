# 重启后从这里继续（RESUME）

> 更新于 2026-09-20 23:40（round-109：打印机下拉合并排序）。上一版写于 09-20 22:30（round-108）。

## 一、当前状态

| 项 | 值 |
| --- | --- |
| 分支 | `main`（与 `origin/main` 同步：`086b3c5`） |
| 版本 | `app/package.json` = **1.0.7**；安装包 `app/release/MaxLabel-Setup-1.0.7.exe` |
| 标签 | `v1.0.0` … `v1.0.7` 本地与远端都有 |
| 矩阵 | `parity/matrix.md` 605 条 → **已实现 605 / 部分 0 / 未实现 0 / 待核 0（100%）**，A272 / B141 / C101 / D75 / E16 |
| 未收口差异 | **0 条**（`parity/diffs.md` DIFF-1…42，最新 DIFF-42 = 打印机下拉合并排序） |
| 门禁 | typecheck / architecture / editor / geometry / history / printer / print / render(54) / workspace / barcode / color / label-formats / installer / evidence / Check-Matrix 全绿；全量 UI `ui-v48 … ui-v121` 共 **72 个脚本** |
| 循环 | **已停机**：`tools/loop/HALT` 存在。驱动器支持 `-Agent codex\|claude`（Claude CLI 在 `D:\claudeCode\claude.exe`） |
| 真机 | 佳博 GP-1324D（端口 `USB001`，PnP `USBPRINT\GPRINTER_GP-1324D\…&USB001`）；**真机上另残留一台测试用 LabelShop 打印机 `TSC TSPL-N (203 dpi)`**（工装无法单独卸载，用户可用鼠标在安装对话框里选中后移除） |
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

1. **打印机链路收尾**（详细取证见 `parity/reference/labelshop/PROBE-round107.md` §4）：
   - 属性「端口」页 **蜂打打云盒**的参数区（真机 = 云盒下拉 + 设置按钮；本机扫不到云盒）；
   - 标准 TCP/IP 的 `SysIPAddress32` 四段 IP 控件（复刻版用「主机名/IP + 端口号」，功能等价）；
   - 卷筒格式在**打印预览**（打印对话框 → 预览）里的纸张呈现；
   - 真机同时安装多台 LabelShop 打印机时的下拉排列顺序（原版按内部焦点行安装，外部改选中态无效）；
   - 用户如需验证「Windows 驱动 + 打印队列」路径，需要在 Windows 里装上佳博 GP-1324D 的驱动（现在只有 PnP/USBPRINT 设备）。
2. **《软件功能需求清单》待验证队列**（`parity/需求清单-待验证队列.md`，194 条：×149 / 不能实现 25 / 未见 19 / 待定 1）：用户已确认「× = 待验证/不确定」，待其与清单作者对齐后按队列逐条取证（真机对话框工装已齐）。
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
