# 门禁失败（round-136）——round-137 处置记录

- 时间：2026-09-23 11:31:40
- HEAD：8b2dd2855ebb8eb370bad8d89c135ee49d97bd58

## test:ui (exit=1) —— 唯一失败脚本 `ui-v81.cjs`

```
FAILED SCRIPTS: ui-v81.cjs
```

完整日志：tools/loop/logs/round-136-gates.md

## round-137 复核与处置

### 1. 先复核：不是产品回归

在**同一构建**（HEAD `8b2dd28`，工作树无源码改动）上单跑：

```
$env:MAXLABEL_UI_SCRIPT='ui-v81.cjs'; npm run test:ui
→ 13/13 PASS，ALL SCRIPTS PASSED (1/1)
```

round-136 只改了 `NewLabelDialog.tsx` / `CustomLabelFormatDialog.tsx` / `previewAnnotation.ts`（预览字号与毫米两位小数），
没有任何一处碰到 ui-v81 走的链路（向导建文档 → 对象属性数据源页 → ODBC/云数据库/CSV 导入 → 模板库 → 标签格式设置页签）。
13 条断言逐条对照过，**条件与失败前完全一致**。

### 2. 失败明细拿不到（记录为流程问题）

`tools/loop/logs/round-136-gates.md` 的 `[FAIL] test:ui` 段落里，
逐脚本结果**只保留了末尾 24 行**（`ui-v117` → `ui-v140`），`ui-v81` 自己的那一行输出连同
`ERR ...` / `FAIL ...` 明细都被截断了；runner 的收尾行 `FAILED SCRIPTS:` 在 finally 里，
所以"点名了谁"保住了、"为什么"没保住。

→ 记进 `backlog.md`：门禁日志对 `test:ui` 的保留窗口应从"末尾 N 行"改成"全部行"或"每个失败脚本的输出单独落盘"，
否则每次 test:ui 红灯都要靠单跑复现来猜根因。

### 3. 实际修的：脚本自身的负载敏感性（断言强度不变）

`ui-v81.cjs` 原来大量使用「**固定 `sleep(N)` 之后立刻断言**」，且一处 `waitFor` 只给 **1000ms**
（同批 `ui-v13x`/`ui-v14x` 的量级是 3000–9000ms）。这类写法与机器负载耦合：门禁当时
正在跑构建、且同一时段有别的 electron 实例在跑，一次 React 重渲染超过 150ms 就会红。

改法（`app/scripts/ui-v81.cjs`）：

- 新增 `waitValue(expression, timeout = 9000)`：轮询到表达式为真再返回**它的值**；超时仍返回 `false`。
- 13 条断言**从 `evaluate(` 原样搬到 `waitValue(`**，表达式字符串一字未改（`git diff` 逐行审计过：
  所有断言行在 `-`/`+` 两侧只有函数名不同）。
- `waitFor` 的时间预算对齐同批脚本：CSV 文件输入 `1000 → 9000`、编辑器就绪 `5000 → 15000`、
  旧模板打开 `5000 → 15000`、对象属性对话框 `5000 → 9000`。
- 点「选择」「取消」「打开」等按钮之前先 `waitFor` 目标控件出现，不再靠 `sleep` 赌它已经渲染。
- 一处错误信息变得更具体（`text import type is not visible after cloud flow` 现在带上 `document.body.innerText` 末尾 1200 字），
  便于下次真的挂了时直接看到现场。

**未降低断言强度**：13 条断言的条件、期望值与覆盖面均未变；超时后仍返回失败。

复跑：

```
$env:MAXLABEL_UI_SCRIPT='ui-v81.cjs'; npm run test:ui
→ 13/13 PASS，ALL SCRIPTS PASSED (1/1)
```

### 4. 残留风险（如实说明）

失败明细已被截断，**无法 100% 证明** round-136 那次红的就是这里改掉的负载敏感性。
可以确定的是：① 产品侧无回归（同构建 13/13）；② 脚本原先确有 1 秒级 `waitFor` 与固定 `sleep` 这两处
客观脆弱点，现已消除。**若下一次全量门禁 `ui-v81` 仍红，那就是另一条原因** —— 届时新日志会带上
脚本名与具体失败断言（错误信息已增强），可直接定位。
