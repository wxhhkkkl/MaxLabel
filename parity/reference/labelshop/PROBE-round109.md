# round-109 真机取证记录（装两台 LabelShop 打印机后的下拉顺序）

- **日期**：2026-09-20
- **对象**：签赋 LabelShop 标准版 - 未激活 V6.39
- **产出**：
  - `probe-21-two-printers.txt`：「选择标签格式」页打印机下拉（装了 2 台 LabelShop 打印机 + 3 台系统打印机）
  - `probe-19-filemenu.png` / `probe-20-filemenu-sheet.png`（round-108 采集，本轮沿用）

---

## 1. 结论：打印机下拉是「合并后按名称升序」

真机上先装着 `Gprinter GPL-N (203 dpi)`，再装第二台 `TSC TSPL-N (203 dpi)` 后，下拉变成 5 项：

| # | 取值 |
| --- | --- |
| 1 | `Gprinter GPL-N (203 dpi)` ← LabelShop 打印机 |
| 2 | `HP7E6C81 (HP LaserJet Pro M329)` ← 系统 |
| 3 | `Microsoft Print to PDF` ← 系统 |
| 4 | `OneNote (Desktop)` ← 系统 |
| 5 | `TSC TSPL-N (203 dpi)` ← LabelShop 打印机 |

即 **签赋LabelShop 打印机与系统打印机合成一个列表按名称升序**（G < H < M < O < T）。

round-105 只装了一台时看到 `Gprinter` 排在最前，当时误判为「已安装的排在系统打印机之前」；本轮装两台后证伪，复刻版随即改为合并排序（DIFF-42）。

## 2. 装第二台的手法（原版鼠标注入无效时的可行路径）

原版对 `SetCursorPos + mouse_event` 不响应；用 `LVM_SETITEMSTATE` 从外部设置列表选中态也改不了它的**焦点行**（点「安装」装的仍是原来的行）。本轮可用的是键盘：

1. `Probe-LabelShopCombos.ps1 -SetCombo 0 -SetIndex 1`：把「可安装的打印机」的品牌过滤切到 `TSC / Zenpert`（列表缩到 5 行）；
2. `keydlg:{TAB}` ×3 → 焦点在过滤框/列表之间移动，`{DOWN}` 让列表出现当前行；
3. `Invoke-LabelShopButton.ps1 -Text 安装`（PostMessage BM_CLICK）→ 装的是**过滤后第 0 行** `TSC TSPL-N (203 dpi)`；
4. `Read-LabelShopListView.ps1` 复核「状态」列出现 `已安装`。

> 注意：`TAB` 次数会影响焦点落点——`{TAB}{TAB}{DOWN}` 那次实际把品牌过滤切到了 `TSC / Zenpert`，`{TAB}{TAB}{TAB}{DOWN}` 才让列表获得选中行。

## 3. 「安装 / 移除」的作用行（本轮补充观察）

- 不选中任何行时，点「安装」装的是**列表绝对索引 0**（未过滤列表里是 `Gprinter GPL-N (203 dpi)`）——
  这一点在 round-105 与本轮都复现；用键盘把当前行移到别处后，「安装」就装那一行（本轮用这种方式装了第 19 行 `TSC TSPL-N (203 dpi)`）。
- 「移除」同样作用在当前行上；**品牌过滤只影响显示，不改变「当前行」的绝对索引**——
  所以过滤到 `TSC / Zenpert` 后点「移除」，移除的仍是绝对索引 0（`Gprinter GPL-N (203 dpi)`，只是它不在过滤视图里看不见）。
- 结论：外部（窗口消息）无法可靠地把「当前行」设到指定行，因此**自动化只做到「装第二台」**；
  卸载指定行的动作本轮未能通过工装完成。

> **真机残留状态（已知）**：本轮为了取证，在真机上多装了 `TSC TSPL-N (203 dpi)`（索引 19），
> 且工装无法把它单独卸载。用户如需恢复，可在「选择标签格式 → 安装(I)」里用鼠标选中该行后点「移除」。
> 另：`Gprinter GPL-N (203 dpi)` 已被重新装回，保持原状。

## 4. 仍未取证/待办

1. **USB 端口原生指令输出**：Windows 不把 `USB001` 暴露成可写设备路径（`\\.\USB001`、`\\.\USBPRINT\…` 实测都打不开）；真机靠内置驱动写 USBPRINT。复刻版 USB 端口仍返回「请使用系统打印驱动或映射为串口」。
2. 标准 TCP/IP 的 `SysIPAddress32` 四段 IP 控件（复刻版用「主机名/IP + 端口号」，功能等价，已记 D-25 备注）。
3. 卷筒格式 + Windows 驱动端口的「打印预览」组合在真机上**无法构造**（卷筒格式只在选中卷筒打印机时出现，而卷筒打印机都是内置驱动 → 预览被禁用），故不再作为待验证项。
4. 真机「工具」页在命令为空时静默（复刻版给了提示，属易用性增强）。
