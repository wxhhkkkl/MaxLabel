# MaxLabel v1.0.4 发布说明（卷筒纸张尺寸/预览 + 打印机属性端口页）

**基线**：v1.0.3（2026-09-20）
**本次类型**：真机对照缺陷修复（打印机链路第二批）
**日期**：2026-09-20

---

## 一、卷筒标签的「纸张尺寸」与「预览」（DIFF-38）

真机取证 `parity/reference/labelshop/PROBE-round106.md`：

| 介质 | 第二行文字 | 预览形态 |
| --- | --- | --- |
| 卷筒（Gprinter GPL-N 203dpi） | `纸宽：  102 毫米` | **竖带**（宽 = 纸宽）+ 主标签居中 + 上下各露一截相邻标签 + 主标签中央序号 `1` |
| 平张（Microsoft Print to PDF） | `纸张：  210 毫米 X  297 毫米`（高度右对齐 4 位） | 整张纸 + 2×4 网格 + 序号 1~8 |

修复前：两种介质都写「纸张： W 毫米 X H 毫米」（卷筒下变成 `纸张：  102 毫米 X 150 毫米`），卷筒预览按「纸 + 网格」画，没有竖带与相邻标签切片。

## 二、打印机属性 → 端口页（DIFF-39）

真机 `<打印机名> 属性`（`Gprinter GPL-N (203 dpi) 属性`）的「端口」页：

- `类型(T)` 下拉 **7 项**：打印机端口(LPT) / 串行端口(COM) / 标准 TCP/IP 打印机端口 / USB 打印机端口 / 蓝牙 / **蜂打打云盒** / 打印机驱动程序端口；
- 类型=USB 时 `端口(O)` 下拉**枚举系统设备**：`USB001 (Gprinter GP-1324D)`，并有按钮 `刷新USB端口` 与提示 `请连接USB打印机，并打开打印机电源。`；
- 端口名取自 `Win32_PnPEntity` 的 `USBPRINT\…&USB001`，设备名取 FriendlyName（多余空格折叠）。

修复前：类型只有 6 项且文字不同（缺「蜂打打云盒」）；USB 只有一句静态说明，没有端口列表与刷新按钮。

## 三、改动文件

| 文件 | 内容 |
| --- | --- |
| `app/src/renderer/src/dialogs/NewLabelDialog.tsx` | 第二行文字按介质输出；卷筒竖带预览（`new-label-roll-strip` / `new-label-roll-slice`） |
| `app/src/shared/domain/printer.ts` | `PORT_TYPE_OPTIONS`（真机 7 项）、`PortType+cloudbox`、`PortConfig.usbPort`、`formatUsbPrinterPort()`、端口校验 |
| `app/src/main/printing/commandTransport.ts` | `listWindowsUsbPrinterPorts()`；TCP 分支兼容 `cloudbox` |
| `app/src/main/ipc/registerPrintIpc.ts` / `app/src/main/ipc/validation.ts` / `app/src/shared/ipcContract.ts` | `ports:list` 返回 `usbPrinterPorts`；端口类型白名单与校验同步 |
| `app/src/renderer/src/dialogs/PrinterSettings.tsx` | 端口页按真机重做「类型(T) / 端口(O)」；切到 USB 自动枚举 |

## 四、验证

| 门禁 | 结果 |
| --- | --- |
| 全量 UI 回归 | **71/71 脚本全过**（ui-v48 … ui-v120） |
| `ui-v119.cjs` | **29/29**（卷筒第二行 = `纸宽：  102 毫米`、竖带 + 2 个相邻切片、序号 1、平张 `纸张：  210 毫米 X  297 毫米`、平张无竖带） |
| `ui-v120.cjs`（新增） | **12/12**：类型下拉前 7 项文字顺序同真机、USB 端口(O) 列表含 `USB001 (Gprinter GP-1324D)`、刷新按钮与提示、未选端口禁止保存、COM/LPT/云盒/驱动控件、保存后回读 |
| `ui-v63` / `ui-v69` / `ui-v108` / `ui-v72` | 12/12 · 9/9 · 8/8 · 8/8（判据按真机端口文字与 USB 必选端口更新） |
| `npm run test:printer` / `test:print` | 通过（新增端口类型/格式化/校验断言） |
| 其余单元门禁 | typecheck / architecture / color / barcode / editor / geometry / history 全绿 |
| `Check-Matrix.ps1` / `test:evidence` | 605/605 已实现；证据 599 行通过 |
| 未收口差异 | **0 条**（DIFF-1…39） |
| 打包版启动冒烟 | `ui-smoke.cjs` 4/4 |

## 五、产物

| 产物 | 路径 |
| --- | --- |
| 安装包 | `app/release/MaxLabel-Setup-1.0.4.exe`（129.25 MB，未签名内部测试包） |
| 免安装目录 | `app/release/win-unpacked/` |
| 校验和 | `RELEASE-SHA256.txt` |
| 真机取证 | `parity/reference/labelshop/PROBE-round106.md` |

## 六、下一轮待办（已取证、待复刻）

1. 属性对话框第 4 个页签 **「工具」**（操作下拉 2 项：发送打印机命令 / 发送文件到打印机；`执行` 按钮 + 输出区）——复刻版目前缺整页；
2. **串行端口(COM)** 的 5 个参数：速率 / 数据位 / 奇偶检验 / 停止位 / 流控制（复刻版只有波特率）；
3. **蜂打打云盒**的参数区（真机是「云盒下拉 + 设置」）；
4. 标准 TCP/IP 的 `SysIPAddress32` 四段 IP 控件（复刻版用「主机名/IP + 端口号」，功能等价）；
5. 卷筒格式在**打印预览**里的纸张呈现；
6. 真机同时安装多台 LabelShop 打印机时的下拉排列顺序。
