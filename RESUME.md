# 重启后从这里继续（RESUME）

> 更新于 2026-09-18 16:20（v1.0.2 发布收尾）。上一版写于 09-16，内容已过时（当时矩阵 86%）。

## 一、当前状态

| 项 | 值 |
| --- | --- |
| 分支 | `main`（合并提交 `14338b4` = Codex 阶段、`3061f6e` = Claude 阶段） |
| 版本 | `app/package.json` = **1.0.2**；安装包 `app/release/MaxLabel-Setup-1.0.2.exe`（129.25 MB，未签名内部测试包） |
| 标签 | `v1.0.0`(a2b50ad)、`v1.0.1`(0ff5d66) 本地已有；`v1.0.2` 视本轮提交结果 |
| 矩阵 | `parity/matrix.md` 605 条 → **已实现 605 / 部分 0 / 未实现 0 / 待核 0（100%）**，A272 / B141 / C101 / D75 / E16 |
| 未收口差异 | **0 条**（`parity/diffs.md` DIFF-1…36，最新 DIFF-36 = 启始页菜单栏 12 项） |
| 门禁 | typecheck / architecture / editor / geometry / history / print / render(54) / workspace / barcode / color / label-formats / installer / evidence / Check-Matrix 全绿；全量 UI `ui-v48 … ui-v118` 共 **69 个脚本** |
| 循环 | **已停机**：`tools/loop/HALT` 存在（原因：round-63 Codex 额度耗尽）。驱动器现支持 `-Agent codex\|claude`（Claude CLI 在 `D:\claudeCode\claude.exe`） |
| 远端 | `main`、`codex/parity-loop`、`claude/parity-loop` 已推送；**v1.0.1 / v1.0.2 及之后提交的推送视本机代理可用性**（曾出现 `github.com:443` 超时 / `curl 55`） |

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

1. **《软件功能需求清单》交叉比对的待澄清项**（281 条，产物在 `parity/_需求清单.xlsx`、`_需求清单.json`、`_需求比对-未命中.txt`、`_需求比对-命中率低.txt`）：
   - 清单里的「×」**不等于**「原版不支持」（例如「数据源/常量」「数据库/数据预览」也标了 ×），需要清单作者确认语义后再决定是否补做；
   - 已在 v1.0.2 补齐其中确实缺的 3 项（标签纸颜色、无效图片策略、单色真像素判定）；
   - 待真机取证：Data Matrix「反白」、汉信码「加密」、标签品牌随打印机联动（本机三台打印机都不是标签打印机，见 `parity/reference/labelshop/PROBE-round104.md`）。
2. **E 区边界 5 条**（台账已写理由）：硬件锁激活、专业版演示模式、三版本分层字段、起始页服务端运营图文、内置驱动不支持预览。
3. **真机取证深化**：`tools/parity/Probe-LabelShopCombos.ps1`（本轮新增）已能读原版对话框内下拉；原版对 `mouse_event` 注入不响应，继续取证请用 `btn:`（BM_CLICK）、`postclick:docview|x,y`、`_fgkeys.ps1`。

## 四、循环工装现状（都在仓库里）

| 工装 | 作用 |
| --- | --- |
| `tools/loop/Start-Loop.ps1` | 监管器：批次接力、HALT/STOP、连续空转停机、`-Agent codex\|claude` |
| `tools/loop/Run-ParityLoop.ps1` | 驱动器：每轮新会话 + 独立门禁 + 额度哨兵 + 卡死判定（20 分钟双静默）+ 3 连败回滚 |
| `tools/parity/Report-Progress.ps1` | 进度快照（写 `parity/PROGRESS-LATEST.md`） |
| `tools/parity/Check-Matrix.ps1` | 矩阵完整性校验 |
| `tools/parity/ACCEPTANCE.md` | 合并前验收清单 |
| `tools/parity/MaxLabelCtl.ps1` + `maxlabel-cdp.cjs` | 复刻版 CDP 驱动 |
| `tools/parity/LabelShopCtl.ps1` | 真机驱动（`start/run/shot/list/close`，步骤 `keys:/click:/clickdlg:/btn:/postclick:/listctl:/shotdlg:`） |
| `tools/parity/Probe-LabelShopCombos.ps1` | 真机对话框下拉读取（CB_GETCOUNT/CB_GETLBTEXT/CB_SETCURSEL + WM_COMMAND） |

## 五、本机环境易踩的坑（血泪清单）

- `test:ui` 跑 `out/` 构建产物：改 renderer 源码后**先 `npm run build`**，否则断言看到旧构建。
- 改 `.ps1`（含用编辑器工具改）会**抹掉 UTF-8 BOM**，Windows PowerShell 5.1 随即按 GBK 解析中文注释报 `Unexpected token '}'`；改完确认首字节是 `EF BB BF`。
- `npm run dist` / `build-windows.cjs` 前先 `Get-Process MaxLabel | Stop-Process`，否则 `release\win-unpacked` 被占用报 `EBUSY: rmdir`。
- 打包命令的"未检测到代码签名证书"走 stderr，PowerShell 会把它当命令失败（exit 1），但产物正常生成。
- 长命令用后台作业（工具单次命令 10 分钟上限）；`pwsh` 不在 PATH，脚本用 `powershell.exe` 跑。
- 并发跑两套回归会抢 CDP 端口与 CPU，制造假失败（运行器有独占锁 `%TEMP%\maxlabel-ui-regression.lock`）。
