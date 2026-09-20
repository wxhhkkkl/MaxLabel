# round-110 真机取证记录（USB 端口默认值 + USB 指令输出路径）

- **日期**：2026-09-20
- **对象**：签赋 LabelShop 标准版 - 未激活 V6.39；本机真实打印机 佳博 GP-1324D
- **本轮依据的既有取证**（未重复采集，直接引用）：
  - `probe-14-printer-props-combos.txt`：`Gprinter GPL-N (203 dpi) 属性 → 端口` 的 **类型 = `USB 打印机端口`**，`端口(O)` = `USB001 (Gprinter GP-1324D)`
  - 帮助 `print_printer_cfg_port.html`（台账 D-23）：「打印输出端口类型**默认为USB打印机端口**」
  - 本机 `Win32_PnPEntity`：`USBPRINT\GPRINTER_GP-1324D\7&3521C07E&0&USB001`（端口名在设备 ID 末尾）
- **本轮新增的实测（失败路径）**：
  - `\\.\USB001` → `Could not find file`（无法作为设备文件打开）
  - `\\.\USBPRINT\GPRINTER_GP-1324D` → `Could not find a part of the path`
  - `Get-PrinterPort` 里有 `USB001`（描述「USB 虚拟打印机端口」），但 `Get-Printer` 里**没有**该打印机的队列

---

## 1. 结论

1. **默认端口**：真机把新装的 LabelShop 打印机默认配成 `USB 打印机端口`，并在 `端口(O)` 里列出枚举到的设备。
   复刻版此前默认落成「指令文件」（文件端口），本轮改为 **`usb` + 枚举到的第一台 USB 设备**。
2. **USB 指令输出**：Windows 不把 `USB001` 暴露成可写设备路径（上面的实测），
   因此复刻版走**打印后台（spooler）raw 写入**：按端口名找到打印队列 → `OpenPrinter` →
   `StartDocPrinter(DATATYPE=RAW)` → `WritePrinter`。
   - 有队列（用户装了厂商驱动/建了打印队列）时：指令原样发出，返回「已通过打印队列 X 发送 N 字节（RAW）」；
   - 没有队列（本机现状）时：返回「USB001 上没有找到 Windows 打印队列：请先安装该打印机的官方驱动（或把端口改为串口/指令文件）」——
     这与真机帮助里「安装 LabelShop 打印机…如果想充分发挥打印机的性能，请安装官方提供的驱动程序」的口径一致。
3. 复刻版没有内置驱动，无法像原版那样绕过队列直接写 USBPRINT；这是**已记录的能力边界**，不是待修缺陷。

## 2. 复刻版改动

| 文件 | 内容 |
| --- | --- |
| `app/src/renderer/src/features/shell/installedPrinters.ts` | `configFromCatalogEntry(entry, base, usbPort?)` 默认端口改为 `usb`（带上枚举到的设备） |
| `app/src/renderer/src/features/shell/ModalHost.tsx` | 安装时先 `listPorts()` 取第一台 USB 设备，再写进 `PrinterConfig` |
| `app/src/shared/domain/printer.ts` | 新增 `usbPortName(label)`：`USB001 (Gprinter GP-1324D)` → `USB001` |
| `app/src/main/printing/commandTransport.ts` | 新增 `writeRawToWindowsQueue()`（spooler raw）；`sendCommand` 的 `usb` 分支改走它 |

## 3. 判据

- `app/scripts/printer-catalog.test.ts`：`usbPortName()` 各种写法；`configFromCatalogEntry` 默认端口 = `usb` + 设备。
- `app/scripts/ui-v119.cjs` **34/34**：安装后的 LabelShop 打印机在「属性 → 端口」页为 `USB 打印机端口` 且默认选中 `USB00x (Gprinter GP-1324D)`。
- `app/scripts/ui-v121.cjs` **12/12**：把端口切到 USB 后执行「发送打印机命令」，输出里出现「没有找到 Windows 打印队列…」（无队列时的明确提示）。

## 4. 仍未取证/待办

1. **有队列时的 raw 发送**：本机没有 GP-1324D 的打印队列，故只有「无队列」分支被实测；有队列分支需用户装好厂商驱动后再验。
2. 标准 TCP/IP 的 `SysIPAddress32` 四段 IP 控件（功能等价，已记 D-25 备注）。
3. 真机「工具」页命令为空时静默（复刻版给了提示，属易用性增强）。
