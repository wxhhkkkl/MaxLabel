# round-134 进度 —— P4 四件套：把「引用写法」造成的一批可复核性丢失修回来

> 上一轮（round-133）的门禁结论见 `tools/loop/last-gates.md`；其 9 项失败已由 `parity/FAILURES.md` 定性为
> **验收方 node_modules 事故**（junction 被递归删除），非产品回归。本轮开工先复核工具链与全部门禁，均 PASS。

## 一、本轮结论：不改产品代码，修台账里一批"引用写法"缺陷

读普查脚本 `tools/parity/survey-evidence-coverage.cjs` 的分类器后发现：它**按证据列里出现的文件名**判定四件套，
而矩阵有 **35 行**的断言引用只写了脚本号（`ui-v52「未连库数据库菜单禁用规则正确」`）、**漏了 `.cjs`**，
于是被判成"无自动断言"。

逐条核对后确认：**这些脚本真实存在且确实断言了这些行**（如 `app/scripts/ui-v52.cjs:217-221`），
所以这是**引用写法问题，不是断言缺失**——补扩展名即可，**未改动任何断言内容、未新增任何主张**。

| 指标 | 改前 | 改后 |
| --- | --- | --- |
| 四件套齐 | 71（11.7%） | **80（13.1%）** |
| 有自动断言 | 491（80.6%） | **520（85.4%）** |
| A 模块 四件套齐 | 49（17.8%） | **58（21.0%）** |

命令：`node tools/parity/survey-evidence-coverage.cjs`

## 二、改动文件

- `parity/matrix.md`（35 行的证据列补 `.cjs`，纯文本替换；CRLF / UTF-8 无 BOM 保持不变）
- `parity/diffs.md`（DIFF-77 补「断言 / 状态」两行 —— 验收方 round-165 要求已修条目须指向机器可复核断言；`audit-diffs.cjs` 缺项 42 → 41）
- `parity/backlog.md`（round-134 结算 + 下一轮候选）
- `parity/progress.md`（本文件）
- **产品代码零改动**（本轮无用户可见行为变更，故无需新增 UI 断言）

## 三、门禁（全部 PASS）

`npm run typecheck` / `test:architecture` / `test:editor` / `test:geometry` / `test:history` / `test:print` /
`test:render` / `test:workspace` / `build` → **全 PASS**；`tools/parity/Check-Matrix.ps1` → exit 0（609 条，100%）。
`node tools/parity/check-evidence-files.cjs` → 引用 180 个文件、存在 180 / 缺失 0。

## 四、剩余风险与下一步

1. **`audit-diffs.cjs` 仍有 41 条缺项**（DIFF-19~DIFF-59 早期条目居多，缺的多是「处置 / 证据」关键词）。
   多数是启发式误报，但按要求应写明四要素 → 建议**分批**（每轮 10~15 条）补 `- 状态 / - 证据 / - 处置 / - 断言：`，不要一次性重写台账。
2. **B-74 / B-75 / B-72 / B-64 四条各差一件**，且**本轮主动没有引用**现成图：`parity/review/cmp-propsbarcode-r124.png` 的复刻版侧
   把 `条码特殊选项` / `供人识读字符` 两组滚出了可视区，引它作并排图会**过度主张**（口径：不确定就不引用、不凑数）。
   要补齐得重出一张把这两组滚进画面的并排图（出图归验收方）。
3. **DIFF-70**（打印输出里有没有孔）仍待取证，路径：打印对话框 → 预览(V) → 放一个满标签大矩形确认输出非空。
