# MaxLabel v1.0.7 发布说明（打印机下拉合并排序 + 收尾核对）

**基线**：v1.0.6（2026-09-20）
**本次类型**：真机对照缺陷修复（打印机链路第五批）
**日期**：2026-09-20

---

## 一、「选择标签格式」打印机下拉的排序修正（DIFF-42）

真机上装**两台**签赋LabelShop 打印机（`Gprinter GPL-N (203 dpi)` 与 `TSC TSPL-N (203 dpi)`）后，打印机下拉共 5 项：

```
Gprinter GPL-N (203 dpi)        ← LabelShop 打印机
HP7E6C81 (HP LaserJet Pro M329) ← 系统
Microsoft Print to PDF          ← 系统
OneNote (Desktop)               ← 系统
TSC TSPL-N (203 dpi)            ← LabelShop 打印机
```

即 **LabelShop 打印机与系统打印机合并后按名称升序**。v1.0.3 时只装了一台（`Gprinter` 恰好排在最前），
当时误判为「已安装的排在系统打印机之前」；本轮装两台证伪并改正。

**修复**：`NewLabelDialog.tsx` 把两组候选合并后按名称升序渲染（`toLowerCase().localeCompare(..., 'en')`）。

## 二、顺带摸清的真机行为（已记录，供后续参考）

- 原版「安装 LabelShop 打印机」的 `安装 / 移除` 作用于列表的**绝对索引 0**（未过滤列表里是 `Gprinter GPL-N (203 dpi)`）；
  品牌过滤只影响**显示**，不改变「当前行」的绝对索引——所以过滤到 `TSC / Zenpert` 后点「移除」，移除的仍是索引 0。
- 用键盘把当前行移到别的行后，`安装` 会装那一行（本轮借此装上了索引 19 的 `TSC TSPL-N (203 dpi)`）；
  但外部无法可靠地把当前行设到指定行，因此**「卸载指定行」本轮没能通过工装完成**。
- 真机因此残留了一台测试用打印机 `TSC TSPL-N (203 dpi)`：如需恢复，在「选择标签格式 → 安装(I)」里用鼠标选中该行点「移除」即可（`Gprinter GPL-N (203 dpi)` 已装回）。

## 三、验证

| 门禁 | 结果 |
| --- | --- |
| 全量 UI 回归 | **72/72 脚本全过** |
| `ui-v119.cjs` | **32/32**（打印机下拉断言改为「LabelShop + 系统按名称升序合并」且两者都在） |
| `ui-v82.cjs` | **15/15**（D-42 同步） |
| 其余单元门禁 | typecheck / architecture / color / barcode / editor / geometry / history / printer / print 全绿 |
| `Check-Matrix.ps1` / `test:evidence` | 605/605；证据 599 行通过 |
| 未收口差异 | **0 条**（DIFF-1…42） |
| 打包版启动冒烟 | 见 `RELEASE-SHA256.txt` 对应版本的构建记录（本轮改动仅渲染层，冒烟照跑） |

## 四、产物

| 产物 | 路径 |
| --- | --- |
| 安装包 | `app/release/MaxLabel-Setup-1.0.7.exe` |
| 免安装目录 | `app/release/win-unpacked/` |
| 校验和 | `RELEASE-SHA256.txt` |
| 真机取证 | `parity/reference/labelshop/PROBE-round109.md`（probe-21） |

## 五、下一轮待办

1. **USB 端口原生指令输出**：Windows 不把 `USB001` 暴露成可写设备路径（实测 `\\.\USB001`、`\\.\USBPRINT\…` 都打不开）；
   真机靠内置驱动写 USBPRINT。复刻版若要支持，需走打印后台（spooler）raw 写入，且要求存在打印队列（即需先装厂商驱动）。
2. 标准 TCP/IP 的 `SysIPAddress32` 四段 IP 控件（复刻版用「主机名/IP + 端口号」，功能等价，已记 D-25 备注）。
3. 真机「工具」页命令为空时静默（复刻版给了提示，属易用性增强）。
4. 需求清单 194 条待验证队列（`parity/需求清单-待验证队列.md`）——等用户与清单作者对齐语义后逐条取证。
