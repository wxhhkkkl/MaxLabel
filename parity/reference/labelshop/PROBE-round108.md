# round-108 真机取证记录（打印预览随打印机类型禁用 / 蜂打打云盒参数区）

- **日期**：2026-09-20
- **对象**：签赋 LabelShop 标准版 - 未激活 V6.39
- **产出**：
  - `probe-19-filemenu.png`：**卷筒文档**（`[602001] 100mm x 150mm`，打印机 = `Gprinter GPL-N (203 dpi)` 内置驱动）的文件菜单
  - `probe-20-filemenu-sheet.png`：**平张文档**（`[608053]`，打印机 = `Microsoft Print to PDF`）的文件菜单
  - `probe-15-cloudbox-port.png`（round-106 采集，本轮用于云盒参数区）
  - `uia-107-filemenu.txt`：菜单 UIA dump（本版 LabelShop 的弹出菜单没有 UIA 节点，空文件）
- **复刻版对照**：`app/scripts/ui-v119.cjs`（第 6 段）、`app/scripts/ui-v120.cjs`（云盒段）

---

## 1. 打印预览随「打印机是不是内置驱动」变化（关键发现）

两次取证只差一个变量——文档绑定的打印机：

| 文档 | 打印机 | 文件菜单里的 `打印预览(V)` | `导出打印机指令文件(E)` |
| --- | --- | --- | --- |
| 卷筒 `[602001] 100mm x 150mm 单列 320签/卷` | `Gprinter GPL-N (203 dpi)`（**签赋LabelShop 打印机 = 内置驱动**） | **灰（禁用）** | 灰（禁用） |
| 平张 `[608053] 100mm x 70mm 圆角8枚/页 20页/盒` | `Microsoft Print to PDF`（Windows 驱动端口） | **可用** | 灰（禁用） |

这与帮助 `print_preview.html` 的「LabelShop 打印机内置驱动不支持打印预览」一致（台账 DIFF-23 曾把这一条判为「复刻版无内置驱动端口，限制客观不存在」——round-105 引入「安装 LabelShop 打印机」之后，复刻版**也有**内置驱动打印机了，限制必须补上）。

`打印(P)...` 在两种文档下都可用；`导出打印机指令文件(E)` 在两种文档下都禁用（复刻版本来就是恒禁用，行为一致）。

菜单项文字与快捷键（probe-19/20 逐项核对）：新建(N) Ctrl+N / 新建条幅飘带 / 打开(Q)... Ctrl+O / 关闭(C) Ctrl+W / 保存(S) Ctrl+S（灰） / 另存为(A)... / 分享(I)...（灰） / 分隔线 / 打印(P)... Ctrl+P / 打印预览(V)（无快捷键） / 导出打印机指令文件(E)（灰） / 分隔线 / 标签格式设置(L)... / 模板属性设置(M)... / 最近的文件（灰） / 退出(X)。

## 2. 复刻版本轮改动

1. `app/src/renderer/src/features/shell/installedPrinters.ts` 新增 `isLabelShopBuiltInPrinter(printer)`：
   文档绑定的 `printerName` 命中「已安装的 LabelShop 打印机」即视为内置驱动。
2. 预览入口全部按该判定禁用：
   - 文件菜单 `打印预览(V)`（`labelShopMenus.ts`：`disabled: isStart || busy || internalPrinter`，`LabelShopMenuDeps` 新增 `internalPrinter`）；
   - 工具栏「打印预览」按钮（`Toolbar.tsx` 新增 `previewBlocked`，title 提示「LabelShop 打印机内置驱动不支持打印预览」）；
   - 打印对话框的「预览」按钮（`PrintDialog.tsx` 新增 `previewBlocked`，禁用 + title）；
   - `App.tsx` 的 `handlePreview()` 兜底：命中时置状态栏「LabelShop 打印机内置驱动不支持打印预览，请改用「打印」或选择 Windows 打印机驱动端口」。
3. 「蜂打打云盒」参数区形态对齐真机：`云盒：` 下拉（复刻版恒为「未检测到云盒」，因为我们没有云盒发现协议）+ `设置` 按钮；点「设置」展开「云盒地址 + 端口」两个输入框（复刻版补充能力，真机是由云盒发现填充 + `设置` 弹子对话框）。

## 3. 仍未取证/待办

1. USB 端口原生指令输出：Windows 不把 `USB001` 暴露成可写设备路径（本轮实测 `\\.\USB001` / `\\.\USBPRINT\...` 均无法打开），
   真机是靠内置驱动写 USBPRINT；复刻版目前 USB 端口返回「请使用系统打印驱动或映射为串口」，已安装打印机的默认端口仍是「指令文件」（可另存 .prn）。
2. 标准 TCP/IP 的 `SysIPAddress32` 四段 IP 控件（功能等价）。
3. 卷筒格式在打印预览里的纸张呈现——**但按 §1 的结论，内置驱动文档下预览本来就不可用**；只有换成 Windows 驱动端口后预览才有意义，留给后续。
4. 真机同时安装多台 LabelShop 打印机时的下拉排列顺序。
