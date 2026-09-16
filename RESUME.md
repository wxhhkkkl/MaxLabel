# 重启后从这里继续（RESUME）

> 写于 2026-09-16 10:10，因用户重启电脑 + Codex 额度耗尽（恢复时间 **2026-09-19 16:08**）而暂停。

## 一、当前状态（重启不会丢任何东西）

| 项 | 值 |
| --- | --- |
| 分支 | `main`（已合并 `codex/parity-loop`，合并提交 `14338b4`） |
| 最新提交 | `eacd518`（合并记录）；工作区仅剩未跟踪的 `tools/loop/HALT` |
| 矩阵 | 605 条 → 已实现 **373** / 部分 149 / 未实现 3 / 待核 80（覆盖 **86%**） |
| 章节 | A 80% · B 82% · **C 100%** · **D 100%** · E 81% |
| 未收口差异 | **1 条**：DIFF-27（对象可变颜色的模式与索引表默认值） |
| 门禁 | main 上实测全绿：typecheck / architecture / editor / geometry / history / print(104 断言组) / render(46) / workspace / build / **UI v52–v90 全 PASS** |
| 远端 | 本地 `main` 领先 `origin/main` **267** 个提交（尚未 push） |

## 二、重启后要做的事

### 1) 只验证、不跑循环（推荐先做）

```powershell
cd D:\workspace\maxlabel\app
npm run typecheck
npm run test:print
npm run test:ui            # 39 个脚本，约 10 分钟
cd ..
powershell -File tools\parity\Check-Matrix.ps1
powershell -File tools\parity\Report-Progress.ps1     # 一键进度快照
```

### 2) 恢复 Codex 循环（额度恢复后，即 9-19 16:08 之后）

```powershell
Remove-Item D:\workspace\maxlabel\tools\loop\HALT
cd D:\workspace\maxlabel
& tools\loop\Start-Loop.ps1 -BatchRounds 12 -MaxTotalRounds 80
```

注意：现在在 `main` 上，循环会**直接提交到 main**。若想另起分支：
```powershell
git checkout -b codex/parity-loop-2
```

### 3) 可选：把成果推到远端

```powershell
cd D:\workspace\maxlabel
git push origin main
```

## 三、剩余工作（额度恢复后按此顺序）

1. **DIFF-27 颜色可变打印**（唯一未收口差异，要求已写全）：
   - `mode` 扩展为 `fixed | random | indexByContent | indexVar | valueVar | index | rgb`
   - 索引表默认注入 **10 个预定义颜色（索引 0–9）**，保留公共/私有两类
   - 颜色值解析同时支持 `,` 与 `|`
   - 按对象类型限制变色粒度（直线/矩形/图片仅整体；文字整体/逐字符；条码整体/区块/渐变）
   - 图片可变颜色仅对单色黑白图启用
   - 补 CDP 断言（六种模式、默认 10 色、两种分隔写法、粒度限制）
2. **待核 80 条**：A 54（`getstart_*` 入门指引系列、`label_page_label`、`label_main_page` 等）+ B 26（数据页/脚本页/条码特性/表单页小簇）
3. **部分 149 条**：主体是 A 的工具栏/格式栏/对齐栏（存在性已验，缺"点击行为断言"）
4. **3 条未实现**：E-09 硬件锁激活、E-10 专业版演示模式（均为已记录边界，需实体加密狗/版本分层）；E-11 启动自动更新（可做，已排队列）

## 四、循环工装现状（都在仓库里，重启后可直接用）

| 工装 | 作用 |
| --- | --- |
| `tools/loop/Start-Loop.ps1` | 监管器：批次自动接力、HALT/STOP 优雅停止、连续空转自动停机、`-DryRun` 预检 |
| `tools/loop/Run-ParityLoop.ps1` | 驱动器：每轮新 codex 会话 + **独立门禁**（不采信自述）+ 失败写 `FAILURES.md` + **额度哨兵** + **卡死判定（20 分钟双静默即终止）** + 秒退哨兵 + 3 连败回滚 |
| `tools/parity/Report-Progress.ps1` | 一键进度快照（写入 `parity/PROGRESS-LATEST.md`） |
| `tools/parity/Check-Matrix.ps1` | 矩阵完整性校验（列数/编号/状态/证据/出处） |
| `tools/parity/ACCEPTANCE.md` | 合并前验收清单（本次合并即按 F 段执行） |
| `tools/parity/MaxLabelCtl.ps1` + `maxlabel-cdp.cjs` | 复刻版取证驱动（CDP：eval/click/drag/setfile/pageshot…） |
| `tools/parity/LabelShopCtl.ps1` | 真机取证驱动（键盘/菜单/控件消息） |
