# MaxLabel v1.0.8 发布说明（默认端口改 USB + USB 指令输出走打印后台）

**基线**：v1.0.7（2026-09-20）
**本次类型**：真机对照缺陷修复 + 功能补齐（打印机链路第六批）
**日期**：2026-09-20

---

## 一、新装的 LabelShop 打印机默认端口改为 USB（DIFF-43）

真机依据：

- 帮助 `print_printer_cfg_port.html`（台账 D-23）写明「打印输出端口类型**默认为USB打印机端口**」；
- 真机 `Gprinter GPL-N (203 dpi) 属性 → 端口` 也确实显示 `类型 = USB 打印机端口`、`端口(O) = USB001 (Gprinter GP-1324D)`。

复刻版此前把新装打印机的端口落成「指令文件」，本轮改为 **`usb` + 枚举到的第一台 USB 设备**（安装时自动查一次端口列表）。

## 二、USB 端口的指令输出：走 Windows 打印后台（spooler）raw 写入

Windows 不把 `USB001` 暴露成可写设备路径（实测 `\\.\USB001` 与 `\\.\USBPRINT\…` 都打不开），
真机是靠**内置驱动**直接写 USBPRINT；复刻版没有内置驱动，因此改为：

1. `usbPortName()` 从 `USB001 (Gprinter GP-1324D)` 取出端口名 `USB001`；
2. `Get-Printer` 按 `PortName` 找到对应的打印队列；
3. `OpenPrinter` → `StartDocPrinter(DATATYPE=RAW)` → `WritePrinter` 把指令原样发出；
4. 找不到队列时给出明确提示：「…上没有找到 Windows 打印队列：请先安装该打印机的官方驱动（或把端口改为串口/指令文件）」
   —— 与真机帮助「安装 LabelShop 打印机…如果想充分发挥打印机的性能，请安装官方提供的驱动程序」口径一致。

> **能力边界（已记录）**：复刻版 USB 发送**需要存在打印队列**（即用户先装厂商驱动）。
> 本机没有 GP-1324D 的打印队列，所以只实测了「无队列」分支；有队列分支等用户装好驱动后再验。

## 三、验证

| 门禁 | 结果 |
| --- | --- |
| 全量 UI 回归 | **72/72 脚本全过** |
| `ui-v119.cjs` | **34/34**（新增：安装后「属性 → 端口」为 `USB 打印机端口`、默认选中 `USB00x (Gprinter GP-1324D)`） |
| `ui-v121.cjs` | **12/12**（新增：把端口切到 USB 后执行发送，输出出现「没有找到 Windows 打印队列…」） |
| `printer-catalog.test.ts` | 默认端口 = usb + 设备；`usbPortName()` 各种写法 |
| 其余单元门禁 | typecheck / architecture / color / barcode / editor / geometry / history / print 全绿 |
| `Check-Matrix.ps1` / `test:evidence` | 605/605；证据 599 行通过 |
| 未收口差异 | **0 条**（DIFF-1…43） |

## 四、产物

| 产物 | 路径 |
| --- | --- |
| 安装包 | `app/release/MaxLabel-Setup-1.0.8.exe` |
| 免安装目录 | `app/release/win-unpacked/` |
| 校验和 | `RELEASE-SHA256.txt` |
| 真机取证 | `parity/reference/labelshop/PROBE-round110.md` |

## 五、下一轮待办

1. **有队列时的 raw 发送验证**：需要用户在 Windows 里装上佳博 GP-1324D 的官方驱动（建出打印队列），
   之后复刻版选中该 USB 端口即可直接发指令；届时我把这条路径实测一遍。
2. 标准 TCP/IP 的 `SysIPAddress32` 四段 IP 控件（复刻版用「主机名/IP + 端口号」，功能等价，已记 D-25 备注）。
3. 真机「工具」页命令为空时静默（复刻版给了提示，属易用性增强）。
4. 需求清单 194 条待验证队列——等用户与清单作者对齐「×」的语义后逐条取证。
