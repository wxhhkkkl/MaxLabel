# 合并回 main 前的验收清单（Merge Checklist）

本文件是 `codex/parity-loop` → `main` 合并前的**可执行验收清单**。每条都要留下证据，全部通过才合并。

## A. 门禁（必须全绿，且是最新构建）

在 `app/` 下依次执行，全部 exit 0：

```powershell
cd D:\workspace\maxlabel\app
npm run typecheck
npm run test:architecture
npm run test:editor
npm run test:geometry
npm run test:history
npm run test:print
npm run test:render
npm run test:workspace
npm run build
npm run test:ui          # 内部串跑 ui-v48..v7x 的 CDP 冒烟
```

另在仓库根跑（清单完整性，必须 exit 0）：

```powershell
powershell -File tools/parity/Check-Matrix.ps1
```

> **构建新鲜度**：以上结论仅当 `app/out/renderer/assets/index-*.js` 的写入时间**晚于**被验提交时间才有效（见 `parity/README.md` 的说明）。

## B. parity 矩阵（`parity/matrix.md`，605 条）

| 检查项 | 通过条件 |
| --- | --- |
| `未实现` | 仅允许「已记录边界」条目（硬件锁激活、专业版演示模式、启动自动更新等），且证据列写明边界原因 |
| `待核` | A/B/C/D/E 各章节均无「因未实现而待核」的条目；剩余待核只能是「已实现但尚未登记证据」且当轮清零 |
| `部分` | 每条都必须写明差异与等价替代说明 |
| `已实现` | 证据列必须有：测试脚本名/断言名、截图文件名或命令中的**至少两项** |

可用 `powershell -File tools/parity/Get-Scorecard.ps1 -Markdown parity/SCORECARD.md` 出分。

## C. 差异台账（`parity/diffs.md`）

- **未收口 DIFF 必须为 0**（当前仅剩 DIFF-12）；
- 等价替代项必须在台账与矩阵两侧都有说明（例：DIFF-11 加速键、DIFF-23 内置驱动预览、C-70 四步导入）。

## D. 真机对照（相似度）证据

| 场景 | 原版证据 | 复刻版证据 | 判定 |
| --- | --- | --- | --- |
| 起始页 | `00-main.png` | `00-main.png` | 左栏分区/客服三行/开始列表（「模版」用字）/右区结构一致 |
| 编辑态主框架 | `40-editor.png` | `02-editor.png` | 菜单栏 12 项、三行工具栏、状态栏 6 段、左右面板一致 |
| 模板向导 | `32-dlg-template-wizard.png` | `30-clone-wizard.png` | 标题/正文/四项单选/默认项/复选框/按钮一致 |
| 选择标签格式 | `60-dlg-choose-label.png` | `31-clone-choose-label.png` | 预览尺寸标注、只读行格式、分组框、安装按钮、按钮组一致 |
| 打印对话框 | `63-dlg-print.png` | `D2-print-dialog-check.png` | 探针 `missingCount: 0`（16 项分组/字段/按钮），`打印标签边框` 禁用 |
| 打印预览 | — | `D3-page0.png` | 独立窗口 + 尺寸/翻页/缩放/适应/1:1/打印全部/关闭 |
| 对象属性（文字/条码/RFID/图形/图片） | 帮助原文 | `B1/B2/B5/B6.png` + `ui-v56/v57/v71` | 页签顺序与字段按帮助；图形 `形状/圆角半径/填充方框内部`；图片 4 缩放+9 对齐 |
| 打印机属性 | `61b-*.png`、`64a/64b` | `ui-v69` | 三页签 + 端口枚举 + 高级打印选项两页 |
| 数据源/数据库 | 帮助原文 | `C2-datasource-tab.png`、`C4/C5/C6-*` | 主数据源 7 类 + 附加子串；CSV/xlsx/GBK 导入；多连接开关 |

对照图生成：`powershell -File tools/parity/Verify-Round.ps1 -Round <N>`（产出 `parity/review/`）。

## E. 交付物与可复现性

- [ ] `app/package.json` 的 `build` 配置可产出 NSIS 安装包（`npm run dist`），未签名状态在 `app/docs/release.md` 注明；
- [x] **标签库可复现性已达标**（验收方端到端验证）：生成器改为读入库原件 `parity/reference/labelshop/sources/LabelFormat360.fmt`（UTF-16 SQLite，经 Python stdlib sqlite3 解析），重跑生成器产出**字节一致**的 275 条结果（哈希不变、工作区无改动）；生成器 / 产物 / 测试 / `ui-v72` 四个文件均已入库；依赖：运行生成器需 `python` 在 PATH（缺失时脚本会抛出明确错误）。
- [ ] `app/docs/labelshop-help-zh/`（帮助原文）与 `parity/reference/labelshop/sources/`（真机原件）随仓库保留；
- [ ] `README.md` 的「已知边界」章节与本清单的 B 表一致（硬件锁/演示模式/自动更新/真机方言/ODBC 驱动等）。

## F. 合并动作

```powershell
cd D:\workspace\maxlabel
git checkout main
git merge --no-ff codex/parity-loop -m "merge: LabelShop 复刻 parity 循环成果（矩阵覆盖 ≥90%、未收口差异 0、门禁全绿）"
git log --oneline -3
```

合并后：
1. 在 `main` 上重跑 A 段全部门禁（合并可能带来自动合并的语义冲突）；
2. 用 `powershell -File tools/parity/Get-Scorecard.ps1 -Markdown parity/SCORECARD.md` 存档最终分；
3. 若 `main` 门禁不过，立即 `git reset --hard` 回合并前提交并在 `parity/FAILURES.md` 记录原因。

> **合并记录**：2026-09-16 10:05 已按本清单 F 段合并回 main（合并提交 `14338b4`），main 上全部门禁（含 UI v52–v90）实测通过。

