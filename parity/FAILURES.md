# 门禁失败 —— round-140 的两条**已结案**（round-141 处置完毕）

> 本文件在 round-141 收尾时**已清空**（无未决门禁失败）。下面留一段结案记录，便于以后回溯
> 「那次 ui-v121 的红到底是什么」，而不是把结论丢在聊天记录里。

## 结论速览

| 脚本 | round-140 现象 | 定性 | 处置 |
| --- | --- | --- | --- |
| `ui-v121.cjs` | 11/12：`USB 发送走打印后台：无打印队列时给出「请先安装官方驱动」的明确提示` = false | **环境变化导致的假红**（不是产品回归） | 断言改为**按环境取期望**，两条分支都钉住 → 14/14 PASS |
| `ui-v107.cjs` | 门禁里红，但失败断言被日志截断 | **单跑三次全绿，不可复现**（疑为门禁时段资源争用） | 不改断言；新增「失败脚本完整输出落盘」以便下次直接取证 |

## 一、ui-v121：断言把「环境前提」当成了恒定值

- **单跑复现**（round-141 实测，`MAXLABEL_UI_SCRIPT='ui-v121.cjs' npm run test:ui`）→ 11/12，失败项与门禁一致。
- **实测输出**（临时加一行 debug 打出来的原文）：
  ```
  DEBUG-USB-VALUE "USB001 (Gprinter GP-1324D)"
  DEBUG-USB-OUT   "14:21:47  发送命令（18 字节）→ 成功：已通过打印队列 Gprinter GP-1324D (USB) 发送 18 字节（RAW）"
  ```
- **根因**：`Get-Printer` 显示 `Gprinter GP-1324D (USB)` 已挂在 `USB001`（驱动 `Generic / Text Only`）。
  原断言要求输出里必须有「没有找到 Windows 打印队列」—— 它把「本机该 USB 端口上恰好没有队列」当成了恒定前提。
  队列一出现（round-139 门禁 13:33 时还是 12/12 PASS，round-140 门禁 14:19 就红了；这中间本机装了驱动），
  打印后台就走了**另一条同样正确**的分支（`commandTransport.ts` 的 `writeRawToWindowsQueue`：有队列就 RAW 写入）。
  → **产品没错**，错的是断言的取期望方式。
- **队列是哪来的（验收方 round-262 的工件自证）**：未跟踪文件 `tools/parity/Send-RawPrint.ps1` 的注释写道
  「Gprinter GP-1324D 走 **USB001**，用**通用驱动建的队列**在直发（RAW）模式下会把字节原样交给打印机……
  直接用后台打印程序的 RAW 接口（`StartDocPrinter` datatype='RAW' + `WritePrinter`）」。
  即：这条队列是**为真实打印验证有意建**的（用户在 round-139/140 前后接的物理打印机那一批工作），
  属于**环境变化**，不是产品侧改动所致 —— 与「round-139 门禁 13:33 时 ui-v121 还是 12/12」的时间线完全吻合。
- **处置**（未降低强度，反而覆盖更全）：用 `listPrinters()` 的 `port` 列（DIFF-91 增补的真实 `Win32_Printer.PortName`，
  与打印后台查的是同一列）判断所选 USB 端口上有没有队列，再据此要求对应输出；
  并额外断言「必须走打印后台且不能退化成静默失败」。12 → **14** 条断言。

## 二、ui-v107：不可复现，不猜

- 单跑 **3 次全 28/28 PASS**（`parity/progress.md` round-141 节有三次运行记录）。
- round-140 的产品 diff（`67c160f`）只碰 `App.tsx` / `PrinterSettings.tsx` / `Modal.tsx` / 两个 IPC 文件，
  与 ui-v107 覆盖的 B-02/B-05/B-44/B-45（拖拽创建、剪贴板、格式栏、RFID）**没有交集**。
- 时间线上唯一可疑的是**资源争用**：验收方 round-139 刚用独立实例（`maxlabel-print-real`）跑过真实打印，
  且门禁时段本机正在装打印机驱动（装驱动会拉起一串 PowerShell/后台进程）。
- **处置**：**不改它的断言**（没有证据指向它，改了就是瞎猜）。
  改为补上**取证能力** —— runner 现在会把失败脚本的完整输出落盘（见下），下次它再红就能直接看到断言原文。

## 三、顺带修掉的取证盲区（本轮新增，已加静态断言）

`app/scripts/run-regression.ps1` 原来把每个脚本的输出走 `node ... | Out-String` 后只留最后一行进汇总：
门禁日志再截断一次，失败脚本的断言原文就**彻底丢了**（round-140 的 ui-v107 正是如此）。
现在：

1. 失败脚本的**完整输出**写到 `tools/loop/logs/fail-<脚本>-<时间戳>.log`（目录在 `.gitignore` 里，不进仓库），
   runner 异常时还会附上 `electron stderr` 末 60 行；
2. 跑脚本那一小段把 `[Console]::OutputEncoding` 切成 UTF-8 再还原 —— 否则 node 的 UTF-8 输出会被按 GBK 解码，
   日志里的中文断言名全是「鎺㈤拡」这类乱码（round-140 门禁日志实测如此）；
3. `app/scripts/runner-safety.test.cjs` 新增 **6 条**静态断言钉住上面两条（18 → **24** checks）。

**实测验证**（跑完即删的临时探针）：`MAXLABEL_UI_SCRIPT='_tmp-fail-probe.cjs' npm run test:ui`
→ 落盘 `tools/loop/logs/fail-_tmp-fail-probe-20260923-142636.log`，内容为可读的
`FAIL 探针断言（这条原文必须出现在失败日志里） => false` / `1/2 PASS`。
