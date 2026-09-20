# round-107 真机取证记录（属性对话框「工具」页 / 串行端口 5 项参数）

- **日期**：2026-09-20
- **对象**：签赋 LabelShop 标准版 - 未激活 V6.39 的 `<打印机名> 属性` 对话框
- **产出**：
  - `probe-16-props-tools-tab.png` / `probe-16-tools-tab-combos.txt`：工具页（操作 = 发送打印机命令）
  - `probe-17-tools-sendfile.png` / `probe-17-sendfile-combos.txt`：工具页（操作 = 发送文件到打印机）
  - `probe-18-com-port-combos.txt`：端口页（类型 = 串行端口(COM)）的 5 个参数下拉
- **复刻版对照**：`parity/reference/maxlabel/`（本轮无新增截图，改动见 §3）

---

## 1. 「工具」页（属性对话框第 4 个页签）

页签顺序：**首选项 / 端口 / 自定义命令 / 工具**（用 `Ctrl+Tab` 逐页切换取证）。

「工具」页结构（分组「常用」）：

| 控件 | 内容 |
| --- | --- |
| `操作：` 下拉 | **2 项**：`发送打印机命令` / `发送文件到打印机` |
| `执行` 按钮 | 按当前操作执行 |
| 下方大区域 | 输出/日志区（当前为空） |

点「执行」的实测行为：
- 操作 = `发送打印机命令`：不弹任何对话框（命令为空时也静默，无提示）；
- 操作 = `发送文件到打印机`：弹出 **Windows「打开」对话框**（`#32770`，1280x799）选文件。

## 2. 「端口」页 —— 串行端口(COM) 的 5 项参数（`probe-18-com-port-combos.txt`）

| 参数 | 选项 | 真机默认 |
| --- | --- | --- |
| 速率(B) | 1200 / 2400 / 4800 / 9600 / 19200 / 38400 / 57600 / 115200 / 128000 / 153600 / 230400 / 460800 / 921600 / 1500000 / 2000000（15 档） | **9600** |
| 数据位(D) | 7 / 8 | 8 |
| 奇偶检验(P) | 无 / 奇 / 偶 / 标志 / 空格 | 无 |
| 停止位(S) | 1 / 1.5 / 2 | 1 |
| 流控制(F) | 无 / 硬件（RTS/CTS）/ 软件（XON/XOFF） | 无 |

## 3. 复刻版本轮改动

1. **工具页**（`app/src/renderer/src/dialogs/PrinterSettings.tsx`）：新增第 4 个页签「工具」，
   分组「常用」+ 操作下拉（发送打印机命令 / 发送文件到打印机）+ 执行 + 输出区；
   - 发送打印机命令 → `window.maxlabel.printCommand({ text, encoding, port })`（走当前端口）；
   - 发送文件到打印机 → `window.maxlabel.printCommandFile({ filePath, port })`，主进程新增
     `command:send-file`（`app/src/main/ipc/registerPrintIpc.ts` + `validateCommandFilePayload` + `MAX_COMMAND_FILE_BYTES = 16MB`）；
   - 与真机的差异：真机点「执行」后弹「打开」对话框，复刻版提供「文件」输入框 + 「选择文件…」按钮（同样可弹系统对话框），便于无鼠标注入环境下回归。
2. **串行端口 5 项参数**：`app/src/shared/domain/printer.ts` 新增 `SERIAL_BAUD_RATES`（15 档，默认 9600）、
   `SERIAL_DATA_BITS`、`SERIAL_PARITY_OPTIONS`、`SERIAL_STOP_BITS_OPTIONS`、`SERIAL_FLOW_OPTIONS`；
   `PortConfig` 增加 `dataBits/parity/stopBits/flowControl`；
   `writeSerialWindows()` 按这 5 项构造 `SerialPort(波特率, 奇偶, 数据位, 停止位)` 与 `Handshake`；
   端口页 UI 用真机的 5 个标签（速率(B)/数据位(D)/奇偶检验(P)/停止位(S)/流控制(F)）与选项；
   `validation.ts` 同步校验（数据位 7/8、停止位 1/1.5/2、奇偶与流控制枚举）。
3. 默认值对齐真机：切到 COM/蓝牙时 `baudRate` 默认从 115200 改为 **9600**，并补齐 dataBits=8 / parity=none / stopBits=one / flowControl=none。

## 4. 仍未取证/待办（下一轮）

1. **蜂打打云盒**的参数区（真机是「云盒下拉 + 设置」按钮，本机扫不到云盒，下拉为空）；
2. 标准 TCP/IP 的 `SysIPAddress32` 四段 IP 控件（功能等价，控件形态不同）；
3. 卷筒格式在**打印预览**（打印对话框 → 预览）里的纸张呈现；
4. 真机同时安装多台 LabelShop 打印机时的下拉排列顺序；
5. 「工具」页真机在命令为空时无提示（复刻版给了「请输入要发送的打印机命令」）——属可接受的易用性增强，若要严格一致可去掉。
