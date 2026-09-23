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

### 3. 定位到一处**必然导致本脚本全挂**的竞态（最可能的真凶）

`ui-v81.cjs` 开头的建文档流程原来是：

```js
await key('n', { ctrlKey: true }); await sleep(350)
if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) {
  await click('[data-testid="wizard-next"]'); await sleep(350)
  ... 点「选择」 ...
  await sleep(800)
}
if (!await waitFor('!!document.querySelector("canvas.upper-canvas")', 15000)) throw new Error('editor did not open')
```

**这是一个不该有的竞态**：向导若在 `^{n}` 之后 **350ms 内**没渲染出来，`if` 判断为假 →
**整个向导分支被静默跳过** → 没人去点「选择」→ 编辑器永远不会打开 →
`throw 'editor did not open'`（exit 2）。

关键性质：这不是"某条断言变红"，而是**脚本直接死掉**；而且它**与失败前的状态无关**——
只要向导慢了一拍，就 100% 失败。空载时向导总能在 350ms 内出现（所以单跑恒 13/13），
而 round-136 门禁当时正在建产物、同一时段还有别的 electron 实例在跑，350ms 完全不够。

这正好解释了三件事：① 单跑 13/13；② 门禁里红；③ 门禁日志里只留下 `FAILED SCRIPTS: ui-v81.cjs`、
**看不到任何断言级明细**（因为它是 exit 2 的异常收场，不是断言失败）。

**改法**（保持原来的容忍度，两条路都算数）：

```js
const wizardOrEditor = await waitFor(
  '!!document.querySelector("[data-testid=template-wizard]") || !!document.querySelector("canvas.upper-canvas")', 15000)
if (!wizardOrEditor) throw new Error('^{n} 之后 15s 内既没出现向导也没出现编辑器：' + <页面文本>)
if (await evaluate('!!document.querySelector("[data-testid=template-wizard]")')) { ...驱动向导... }
if (!await waitFor('canvas.upper-canvas', 15000)) throw new Error('editor did not open')
```

即：**先等到「向导或编辑器」就绪**（不再赌 350ms），再按实际出现的那条走；
两条路都等不到才报错，且报错信息带上页面文本。
另外「关闭」按钮也改成先 `waitFor` 出现再点；「管理」按钮同理（原来 `clickText('管理')` 的返回值被忽略，
找不到就静默往下走，最后在别的断言上表现为莫名其妙的红）。

### 4. 同时消除的负载敏感性（断言强度不变）

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

### 5. 残留风险（如实说明）

- 失败明细已被门禁日志截断，**无法用实证 100% 钉死** round-136 那次红的就是第 3 节的竞态。
  但可以确定：① 产品侧无回归（同构建 13/13）；② 第 3 节那个竞态是**读到代码即可判定**的
  必然失败条件（向导慢于 350ms ⇒ 100% 全挂 ⇒ exit 2 ⇒ 日志里只有脚本名没有断言明细），
  与观测到的现象**逐条吻合**，是目前唯一能同时解释「单跑绿 / 门禁红 / 无断言明细」的原因。
- 第 4 节的 1 秒级 `waitFor` 与固定 `sleep` 是同一类问题的次要来源，一并消除。
- **若下一次全量门禁 `ui-v81` 仍红**，那就是另一条原因 —— 本轮已把该脚本所有"静默失败点"
  改成"带页面文本的显式报错"，届时日志会直接给出卡在哪一步。
