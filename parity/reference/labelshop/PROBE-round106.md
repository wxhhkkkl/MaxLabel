# round-106 真机取证记录（卷筒标签的纸张尺寸文字 / 预览形态 / 编辑区）

- **日期**：2026-09-20
- **对象**：签赋 LabelShop 标准版 - 未激活 V6.39（真机）
- **背景**：round-105 修完「安装/移除 + 品牌类型名称」后，用户反馈里还包含「**纸张尺寸**、**预览**与编辑区」，
  本轮把「选择标签格式」页预览区与文字、以及卷筒标签进入编辑区后的形态补齐取证。
- **产出**：
  - `probe-11-select-format-roll.png` / `probe-11-roll-paper-size.txt`：选中卷筒打印机 `Gprinter GPL-N (203 dpi)` 时的选择标签格式页
  - `probe-12-select-format-sheet.png` / `probe-12-sheet-select.txt`：选中平张打印机 `Microsoft Print to PDF` 时的同一页
  - `probe-13-editor-roll.png`：点「选择」后用卷筒格式（`[602001] 100mm x 150mm 单列 320签/卷`）建出的文档，编辑区全貌
  - 复刻版对照：`parity/reference/maxlabel/A118-roll-preview.png`

---

## 1. 预览区第二行文字随介质类型变化

| 介质 | 第二行（真机原文） | 第一行 |
| --- | --- | --- |
| 卷筒（Gprinter GPL-N 203dpi） | **`纸宽：  102 毫米`** | `标签：  100.00 毫米 X 150.00 毫米` |
| 平张（Microsoft Print to PDF） | **`纸张：  210 毫米 X  297 毫米`**（`X` 后是右对齐 4 位的宽度，297 前面多一个空格） | `标签：  100.00 毫米 X 70.00 毫米` |

复刻版修复前两种介质都写「纸张： W 毫米 X H 毫米」，卷筒下会显示 `纸张：  102 毫米 X 150 毫米`——与真机不符。

## 2. 卷筒预览是「竖带 + 上下相邻标签切片」

真机 `probe-11` 的预览：一条**宽度 = 纸宽（102）**的竖白带，主标签（100×150）在带内水平居中（左右各 1mm 纸边），
**主标签上下各露出一小截相邻标签**（用同样的圆角/直角形状描边，中间是标签间隙），主标签中央写序号 `1`；
红色尺寸标注仍是「上边 100mm、右边 150mm」。

平张 `probe-12` 的预览：整张纸（210×297）+ 2 列 × 4 行 = 8 枚标签的网格，每枚写序号 1~8，标注 100mm / 70mm。
（平张部分 round-72 起已对齐，本轮只补卷筒形态。）

复刻版修复前：卷筒也按「纸 + 网格」画，`pageH` 直接取标签高度，既没有竖带语义也没有相邻标签切片。

## 3. 卷筒格式进入编辑区后

`probe-13-editor-roll.png`（用 `[602001] 100mm x 150mm 单列 320签/卷` 建出的文档）：

- 编辑区白色版面 = **标签本身 100×150**（不是纸宽 102），四周是青色底；
- 状态栏：`Gprinter GPL-N (203 dpi)` ｜ `100mm x 150mm 单列 320签/卷` ｜ `未使用数据库` ｜ 光标 `19.22, 60.55 毫米` ｜ 缩放 `141%`；
- 右侧「打印」面板的打印机下拉就是刚安装的 `Gprinter GPL-N (203 dpi)`（安装结果会带进打印面板）。

→ 与复刻版的建模一致：文档尺寸取标签尺寸、纸张宽度存在 `layout.pageWidthMm`（102），状态栏显示格式名与打印机名。

## 4. 本轮复刻版改动（对照上面三条）

1. `app/src/renderer/src/dialogs/NewLabelDialog.tsx` 的第二行文字改为按介质类型输出：
   卷筒 `纸宽：  W 毫米`、平张 `纸张：  W 毫米 X  H 毫米`（高度 `padStart(4)`，与真机空格一致）。
2. 同一文件新增卷筒预览分支（`data-testid=new-label-roll-strip` / `new-label-roll-slice`）：
   竖带（纸宽）+ 主标签居中 + 上下各一截相邻标签（高度 ≈ 标签高的 12%，间隔取格式的 `rowGapMm`），主标签中央仍写序号。
3. 复刻版对照截图：`parity/reference/maxlabel/A118-roll-preview.png`（卷筒：纸宽/标签两行 + 竖带 + 上下切片 + 序号 1）。

## 5. 已安装 LabelShop 打印机的「属性」对话框（端口页）

在卷筒文档里按 `Ctrl+P`（或打印面板的「设置」）打开的不是打印对话框，而是 **`<打印机名> 属性`**
（本轮为 `Gprinter GPL-N (203 dpi) 属性`，688x902，`#32770`，含一个 SysTabControl32，当前页「端口」）。

控件（`probe-14-print-dialog.png` / `probe-14-printer-props-combos.txt` / `uia-107` 同款 UIA dump）：

| 控件 | 取值 |
| --- | --- |
| 类型(T) | 下拉 7 项：`打印机端口(LPT)` / `串行端口(COM)` / `标准 TCP/IP 打印机端口` / `USB 打印机端口` / `蓝牙` / **`蜂打打云盒`** / `打印机驱动程序端口`（本轮真机当前值 = `USB 打印机端口`） |
| 端口(O) | 类型=USB 时列出 PnP/USBPRINT 设备：**`USB001 (Gprinter GP-1324D)`**（1 项） |
| 提示 | `请连接USB打印机，并打开打印机电源。` |
| 按钮 | `刷新USB端口` / `设置` / `确定` / `取消` / `应用(A)` / `帮助` |
| 其它类型的参数区 | 类型=COM 时有 `波特率/奇偶检验(P)/停止位(S)/流控制(F)`；类型=TCP/IP 时有 `SysIPAddress32` 四段 IP + 端口号 |

Windows 侧的对应关系：`Get-PrinterPort` 只有 `USB001 / WSD-… / COM1-4 / LPT1-3 / FILE: / nul:`，
而设备名要从不进打印队列的 PnP 设备取 —— `Win32_PnPEntity` 里 `Gprinter  GP-1324D` 的
`DeviceID = USBPRINT\GPRINTER_GP-1324D\7&3521C07E&0&USB001`，**末尾就是端口名**；
把 FriendlyName 的多余空格折叠后即为真机的 `USB001 (Gprinter GP-1324D)`。

**复刻版本轮改动**：
- `app/src/shared/domain/printer.ts`：新增 `PORT_TYPE_OPTIONS`（7 项真机文字与顺序）、`PortType` 增加 `cloudbox`（蜂打打云盒）、
  `PortConfig.usbPort`、`formatUsbPrinterPort()`；`portConfigError` 对 `cloudbox` 按 TCP 规则校验、对 `usb` 要求已选端口。
- `app/src/main/printing/commandTransport.ts`：新增 `listWindowsUsbPrinterPorts()`（上面的 PnP 解析）；`sendCommand` 的 TCP 分支同时处理 `cloudbox`。
- `ports:list` 同时返回 `comPorts` 与 `usbPrinterPorts`（`app/src/shared/ipcContract.ts` 契约同步）。
- `app/src/renderer/src/dialogs/PrinterSettings.tsx` 端口页：类型下拉改为真机 7 项文字（+ 我们原有的「打印到文件」），
  USB 类型显示「端口(O)」下拉 + 「刷新USB端口」按钮 + 真机提示；切到 USB 时自动刷新（真机不需手动刷新即可列出设备）。

## 6. 属性对话框的 4 个页签与「工具」页（本轮新发现）

`Gprinter GPL-N (203 dpi) 属性` 的页签是 **首选项 / 端口 / 自定义命令 / 工具** 四个
（`probe-15-cloudbox-port.png` 顶部可见；复刻版 `PrinterSettings.tsx` 目前只有前三个，**缺「工具」页**）。

用 `Ctrl+Tab` 切到「工具」页（`probe-16-props-tools-tab.png`）：

- 分组「常用」
- `操作：` 下拉 2 项（`probe-16-tools-tab-combos.txt`，控件 id=3858）：**`发送打印机命令`** / **`发送文件到打印机`**
- `执行` 按钮
- 下方一块可滚动的大输出区（当前为空）

→ 这是「把命令或文件直接发给打印机」的工具页，属待复刻项。

各端口类型在「端口」页的参数区（同一批控件按类型显隐，`probe-15`/`probe-16` 抓到的全集）：

| 类型 | 参数区控件 |
| --- | --- |
| 打印机端口(LPT) | `端口(O)：` 输入框 |
| 串行端口(COM) | `速率(B)` / `数据位(D)` / `奇偶检验(P)` / `停止位(S)` / `流控制(F)` 五个下拉 |
| 标准 TCP/IP 打印机端口 | `SysIPAddress32` 四段 IP + 端口号 + `设置` 按钮 |
| USB 打印机端口 | `端口(O)：` 下拉（枚举 `USB001 (Gprinter GP-1324D)`）+ `刷新USB端口` + 提示「请连接USB打印机，并打开打印机电源。」 |
| 蓝牙 | 与 COM 同类（速率/数据位/奇偶/停止位/流控制） |
| 蜂打打云盒 | `云盒：` 下拉（本机 0 项）+ `设置` 按钮（`probe-15-cloudbox-port.png`） |
| 打印机驱动程序端口 | Windows 打印机选择 |

## 7. 仍未取证/待办（下一轮）

1. **「工具」页**（操作下拉 2 项 + 执行 + 输出区）——复刻版缺整个页签，且要看「发送文件到打印机」的界面形态。
2. **串行端口(COM) 的 5 个参数**（速率/数据位/奇偶检验/停止位/流控制）：复刻版只有「波特率」，`PortConfig` 也只存 baudRate，`writeSerialWindows` 固定 None/8/One。
3. **蜂打打云盒的参数区**：真机是「云盒下拉 + 设置」，复刻版目前是「IP + 端口」两个输入框。
4. **标准 TCP/IP**：真机用 `SysIPAddress32` 四段 IP，复刻版是「主机名/IP + 端口号」（功能等价）。
5. 卷筒格式在**打印预览**（打印对话框 → 预览）里的纸张呈现。
6. 真机同时安装多台 LabelShop 打印机时的下拉排列顺序。
