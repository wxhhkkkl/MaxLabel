# MaxLabel v1.0.17 发布说明（DIFF-62 收口 4/5，仅剩 1 条待真机取证）

**基线**：v1.0.16（2026-09-21）
**本次类型**：取证暴露缺口的收口（数据源子串「共享变量名」下拉、截短「保留整数/小数部分」）+ 差异台账收口
**日期**：2026-09-21

---

## 一、本轮修掉的两处缺口（DIFF-62 的 ①②）

| 项 | 原版判据 | 修法 |
| --- | --- | --- |
| 共享变量名称「选择名称」 | 真机数据源页的「变量共享名称(&N)」是**可编辑组合框**（有已存在的共享名时可下拉选）；帮助 `datasource_shard.html`/`label_object_page_data.html` | `shared-source-name` 挂 `list="maxlabel-shared-names"` + `<datalist>`；候选名由 `ModalHost.sharedNamesOf(doc)` 汇总——扫描所有对象（含分组内对象）的主数据源与**对象级 `subSources`** 上已用过的 `sharedName`，去重排序。仍可手输新名（组合框语义）。回归 `ui-v128.cjs` |
| 截短「保留」的整数/小数部分 | 帮助 `datasource_advanced_cut.html`：「保留……也可以单独保留数字的整数或者小数部分（包含小数点）」 | 文字页「截短」下拉增 `keepInt`＝保留整数部分、`keepDecimal`＝保留小数部分（含小数点）；语义在 `datasource.ts` 的 `applyCut`。单测 `editor-operations.test.ts` 断言 `12.34` → `12` 与 `.34`；回归 `ui-v128.cjs` |

**顺带纠正的结论**（不涉及代码）：

- 序列号「归位」复刻版一直有（`resetEachRecord` + 按记录基准复位），v1.0.16 起不再记缺口。
- 序列号「边界值」（DIFF-62 ③）：帮助未记载，真机数据源页把「数据源」切到序列号后页面不重排（`CB_SETCURSEL` 改了选中项但 UI 没刷新），本轮仍未读到 —— **待真机换手法再取证**，不算缺口。

## 二、差异台账现状

`parity/diffs.md`：

| 编号 | 状态 |
| --- | --- |
| DIFF-1 … DIFF-49、51 … 59、61 | 已修 |
| **DIFF-62** | 五条中第 1/2/3/4 条已收口（第 1 条序列只读显示、第 2 条归位口径于 v1.0.16；第 3 条共享名下拉、第 4 条截短整数/小数部分于本轮）；**第 5 条序列号「边界值」待真机取证** |
| DIFF-60 | 观察项（真机 EAN/UPC 无「附加条码」、25 码族无独立校验字符，复刻版按原版帮助保留），非缺陷 |

## 三、验证

| 门禁 | 结果 |
| --- | --- |
| `ui-v128.cjs`（新增，本轮两项修复） | 2/2 |
| 全量 UI 回归（79 个脚本，`ui-v48 … ui-v128`） | **ALL SCRIPTS PASSED (79/79)**，exit 0 |
| `test:editor`（40 项，含 `keepInt`/`keepDecimal`） | 全绿 |
| `typecheck` / `test:barcode` / `test:render` / `test:print` / `test:geometry` / `test:history` / `test:color` / `test:printer` / `test:workspace` / `test:evidence` | 全绿 |
| `Check-Matrix.ps1` | 605/605 校验通过 |
| 需求清单 | **194/194（待填 0 条）** |

## 四、产物

| 产物 | 路径 |
| --- | --- |
| 安装包 | `app/release/MaxLabel-Setup-1.0.17.exe` |
| 校验和 | `RELEASE-SHA256.txt` |
| 清单队列 | `parity/需求清单-待验证队列.md`（194/194） |
| 门禁日志 | `tools/loop/logs/round-60g-ui.log`、`v1.0.17-gates.md` |

## 五、之后还剩什么

1. **DIFF-62 ③** 序列号「边界值」——待真机再取证（换切换手法，或让真机停在序列号页时用鼠标真点）。
2. **对象编辑三处真机待确认**：CTRL+拖动是复制还是移动；拖动有无对齐参考线吸附；点空心矩形内部算不算选中。
3. **打印机链路两处待用户配合**：装佳博官方驱动后验证 USB「有队列」发送；把真机残留的 `TSC TSPL-N (203 dpi)` 移除。
4. **E 区边界 5 条**：硬件锁激活、专业版演示模式、三版本分层字段、起始页服务端运营图文、内置驱动不支持预览。
