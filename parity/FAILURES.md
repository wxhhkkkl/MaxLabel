# 门禁失败（round-126）——已在 round-127 修好，本轮无未决失败

- 时间：2026-09-22 17:23:11
- HEAD：f7df526a8aa3e060e183e7fafc2d04a1f0230c2f
- 处置轮：round-127（提交 `b391980`，见下「round-127 收口结论」）
- 状态：**四个红脚本全部转绿**，无遗留待修项

## 原始失败：test:ui (exit=1)

```
ui-v134.cjs : 16/19 : 16/19 PASS
FAILED SCRIPTS: ui-v56.cjs, ui-v77.cjs, ui-v106.cjs, ui-v134.cjs
```

完整日志：tools/loop/logs/round-126-gates.md

---

## round-127 收口结论（逐脚本，均为实测复跑）

| 脚本 | 失败断言 | 根因 | 处置 | 复跑结果 |
| --- | --- | --- | --- | --- |
| `ui-v56.cjs` | `Code128专属字段在条码页的「条码特殊选项」分组内` | round-126 按真机原文把 `GS1/EAN-128（自动插入 FNC1，支持 ^1 转义）` 改成 `GS1/EAN 128(&U)`，旧断言查的是被证伪的文案 | 断言改用真机原文 `GS1/EAN 128(&U)` + `字符集(&C):`，并加钉加速键 | **11/11** |
| `ui-v106.cjs` | `B-122 Code 128 特殊选项含 GS1/EAN-128 与五档字符集` | 同上；且字符集下拉的定位用 `textContent.trim()==='字符集'`，而真机原文已带 `(&C):` | 定位改 `字符集(&C):`、文案改真机原文；五档选项逐项比对保持 | **33/33** |
| `ui-v77.cjs` | `B-74 Code128 提供 GS1/EAN-128 与 ^1 FNC1 说明` | 同上（GS1 复选框查找串） | 查找串改 `GS1/EAN 128(&U)`；`^1` 说明仍由字符集「手动（^A ^B ^C ^1 控制符）」档承担，保留 | **8/8** |
| `ui-v77.cjs` | `B-69 条码尺寸提供 mil X尺寸与条宽比` | **round-124 的遗留**：`条宽比(&W):` 自 round-124 起按码制条件渲染（真机 Code 128 无此行），而该断言在默认码制 Code 128 上读条宽比 —— round-124 未同步改它，round-126 的首次全量 UI 才暴露 | 改成**先切 Code 39**（真机有该行的码制）再读 7 档；并**拆成两条**：`B-69`（X 尺寸 1–1000/步长 1/mil/常规页高度）+ `B-69a`（Code 128 无 + Code 39 有且 7 档）；断言数 7 → 8，**只增不减** | **8/8** |
| `ui-v134.cjs` | `分组框整数组全等`、`分组框按真机坐标次序出现` | **产品缺陷**：round-126 把「供人识读字符」组渲染在「条码特殊选项」**之前**，与真机 y 序相反（真机 `尺寸`521 → `条码特殊选项`665 → `供人识读字符`821） | 产品侧把那一个 fieldset 连同包装 IIFE 移到「条码特殊选项」之后、页尾「颜色:」之前（复刻版扩展区随之移到颜色之前） | **19/19** |
| `ui-v134.cjs` | `「尺寸」组含真机原文 码  高(&H):` | 断言字面量用了两个 ASCII 空格；产品用 `U+00A0 + 空格`（HTML 里连续空格会被合并成一个，NBSP 才能让渲染与 innerText 都保持两格宽，视觉与真机的两个空格一致） | 断言字面量改用与产品/`ui-v77` 相同的 `U+00A0 + 空格`，并把该取舍写进断言注释 | **19/19** |

### 证据

- 真机分组框 y 序与字段原文：`parity/reference/labelshop/probe-60-barcode-props-tree.txt`
  （L147-149 / L200-202 group box 行 `尺寸`(928,521) / `条码特殊选项`(928,665) / `供人识读字符`(928,821)；
  L118 `码  高(&H):`；L128/L181 `GS1/EAN 128(&U)`）
- 条宽比按码制：`parity/reference/labelshop/probe-sym-code128-values.txt`（无此行）与
  `probe-sym-code39-values.txt`（7 档 2.00…3.00）；负面断言另由 `app/scripts/ui-v126.cjs` 钉住

### 复跑命令

```
cd app
$env:MAXLABEL_UI_SCRIPT='ui-v56.cjs';  npm run test:ui   # 11/11
$env:MAXLABEL_UI_SCRIPT='ui-v77.cjs';  npm run test:ui   # 8/8
$env:MAXLABEL_UI_SCRIPT='ui-v106.cjs'; npm run test:ui   # 33/33
$env:MAXLABEL_UI_SCRIPT='ui-v134.cjs'; npm run test:ui   # 19/19（含 round-126 新增的 19 条，验收方 round-149 提的「未实跑」至此已实跑）
```
