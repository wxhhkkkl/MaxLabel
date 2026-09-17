# 门禁失败（round-102）—— 已修复（round-103）

- 原失败时间：2026-09-17 08:35:43（HEAD `f3cb0fa`）
- 状态：**已修复**，`ui-v52.cjs` 重跑 **66/66 PASS**

## test:ui (exit=1) — 原日志

```
ui-v91.cjs : 18/18 : 18/18 PASS
...
ui-v114.cjs : 8/8 : 8/8 PASS
FAILED SCRIPTS: ui-v52.cjs
```

完整日志：tools/loop/logs/round-102-gates.md

## 根因（round-103 定位）

是**测试随产品行为变更而失效**，不是产品回归。

- round-102（提交 `51341da`）把启动态从「起始页 + 一个 `新标签模板1` 空白文档」改成
  「只有起始页一个页签、零文档」，以对齐真机 `parity/reference/labelshop/92-00-startup.png`
  （判定依据与断言见 `app/scripts/ui-v114.cjs`）。
- `ui-v52.cjs` 结尾「关闭当前文档快捷键」一段在 `Page.reload` 之后直接
  `clickText('新标签模板1')`，依赖的正是那个已被删除的启动空白文档页签。
  重载后页签条上只有「起始页」，于是 `关闭测试重新进入干净文档` 取到 `false`；
  没有文档 ⇒ `hasDocument === false` ⇒ `Ctrl+W` 分支（`useLabelShopShortcuts.ts:68`）
  不触发 ⇒ `Ctrl+W关闭当前文档` 也取到 `false`。
  实测 **64/66**，两条失败**完全确定性**（非偶发，与 round-82 的剪贴板偶发无关）。

## 修法

`app/scripts/ui-v52.cjs`：重载后改走真实用户路径建立文档，再断言关闭——
起始页「新建标签模版」→ 模板向导「下一步」→「选择」标签格式 → 文档打开
（`关闭测试重新进入干净文档` 改为断言编辑态菜单出现）→ `Ctrl+W` 关闭并退回短菜单。

**断言强度未降低**：仍然钉住「Ctrl+W 关闭当前文档、文档归零后回到无文档态」这条
用户可见行为，只是不再依赖一个已被有意删除的启动残留。

## 证据

| 命令 | 结果 |
| --- | --- |
| `MAXLABEL_UI_SCRIPT=ui-v52.cjs npm run test:ui` | **66/66 PASS**，`ALL SCRIPTS PASSED (1/1)` |

## 同类排查（未发现第二处）

round-102 门禁的 `FAILED SCRIPTS` 行只有 `ui-v52.cjs` 一条，即同批 64 个脚本中
其余 63 个（含 round-102 新增的 `ui-v114.cjs`）在启动态变更后仍通过；
本轮又核对了依赖启动文档的脚本，未发现其他陈旧前置条件。
