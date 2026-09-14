# 门禁结果（round-14）

- 时间：2026-09-14 18:11:32
- HEAD：749181730259befc9d68c10cd4a50ce90e7afac3
- 结论：全部通过

[PASS] typecheck (exit=0, 4s)
> maxlabel@0.1.0 typecheck
> npm run typecheck:node && npm run typecheck:web
> maxlabel@0.1.0 typecheck:node
> tsc --noEmit -p tsconfig.node.json
> maxlabel@0.1.0 typecheck:web
> tsc --noEmit -p tsconfig.web.json

[PASS] test:architecture (exit=0, 0s)
> maxlabel@0.1.0 test:architecture
> node scripts/architecture-check.cjs
7 architecture checks passed

[PASS] test:editor (exit=0, 1s)
> maxlabel@0.1.0 test:editor
> esbuild scripts/editor-operations.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_editor.cjs && node scripts/_editor.cjs && node -e "require('fs').unlinkSync('scripts/_editor.cjs')"
  scripts\_editor.cjs  14.3kb
Done in 51ms
16 editor operation checks passed

[PASS] test:geometry (exit=0, 1s)
> maxlabel@0.1.0 test:geometry
> esbuild scripts/editor-geometry.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_geometry-test.cjs && node scripts/_geometry-test.cjs && node -e "require('fs').unlinkSync('scripts/_geometry-test.cjs')"
  scripts\_geometry-test.cjs  2.0mb
Done in 119ms
1 editor geometry check passed

[PASS] test:history (exit=0, 1s)
> maxlabel@0.1.0 test:history
> esbuild scripts/document-history.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_history.cjs && node scripts/_history.cjs && node -e "require('fs').unlinkSync('scripts/_history.cjs')"
  scripts\_history.cjs  3.8kb
Done in 4ms
9 document history checks passed

[PASS] test:print (exit=0, 1s)
  ✓ 机器码为 16 位十六进制
  ✓ ODBC：SQL Server 连接串包含驱动与库
  ✓ ODBC：MySQL 连接串
  ✓ ODBC：DSN 连接串
  ✓ 兼容矩阵：Zebra 推荐 ZPL、佳博推荐 TSPL
  ✓ 兼容矩阵：未知品牌回退 TSPL 且矩阵含兜底条目
  ✓ 兼容矩阵：清单包含串口与中文编码检查项
  ✓ 离线云库允许空地址并拒绝不安全远程地址
  ✓ 数据库空密码保留为系统安全存储回退语义
  ✓ 空指令在主进程边界被拒绝
  ✓ 打印端口边界不透传未知字段
  ✓ LPT 端口保留 LabelShop 并口配置且不透传未知字段
  ✓ 序列号解析（按 labelIndex）
  ✓ 序列号重复按标签推进并在打印后推进一次
  ✓ 序列号初始值可从键盘输入或数据库字段读取
  ✓ database source uses the selected field and per-label record offset
  ✓ 日期/时间格式化
  ✓ 同一打印上下文固定日期时间快照
  ✓ 日期格式支持中文组合与日期偏移
  ✓ 时间区域与偏移字段可解析
  ✓ VBScript OnGetData supports concatenation, arithmetic and globals
  ✓ template lifecycle updates output count and shared variables
  ✓ substring cut/trim/keep and max length
  ✓ min length padding and control characters
共通过 81 项断言组。

[PASS] test:render (exit=0, 1s)
PASS arc changes output pixels
PASS editor object geometry and preview pixels match
PASS command text bitmap matches thresholded shared renderer pixel-for-pixel
PASS missing image fails output instead of silently printing incomplete label
PASS LSDX fixture preserves label dimensions
PASS LSDX fixture imports groups and basic object types
PASS LSDX fixture imports basic table geometry
PASS LSDX fixture imports basic RFID parameters
PASS LabelShop form shape and centre hole import
PASS rect paper settings survive save/open normalization
PASS rect blank paper has no printed outline or hole outline
PASS rect centre hole clips content but preserves printable paper
PASS roundRect paper settings survive save/open normalization
PASS roundRect blank paper has no printed outline or hole outline
PASS roundRect centre hole clips content but preserves printable paper
PASS roundRect outer paper shape clips corner content
PASS ellipse paper settings survive save/open normalization
PASS ellipse blank paper has no printed outline or hole outline
PASS ellipse centre hole clips content but preserves printable paper
PASS ellipse outer paper shape clips corner content
PASS disc paper settings survive save/open normalization
PASS disc blank paper has no printed outline or hole outline
PASS disc centre hole clips content but preserves printable paper
PASS disc outer paper shape clips corner content
46 rendering checks passed

[PASS] test:workspace (exit=0, 4s)
> maxlabel@0.1.0 test:workspace
> node scripts/workspace-regression.cjs
renderer: %cElectron Security Warning (Insecure Content-Security-Policy) font-weight: bold; This renderer process has either no Content Security
  Policy set or a policy with "unsafe-eval" enabled. This exposes users of
  this app to unnecessary security risks.
For more information and help, consult
https://electronjs.org/docs/tutorial/security.
This warning will not show up
once the app is packaged.
renderer: Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently
PASS native window resize keeps paper fitted {
  large: { width: 927, height: 486, zoom: 0.8828571428571429 },
  small: { width: 581, height: 304, zoom: 0.5533333333333333 }
}
PASS document redraw, dimensions, rotation, rulers preserve fit and origin
PASS fit width/height center the short axis and keep long-axis gutter
PASS canvas right-click reaches the context menu callback
PASS wheel modes, centered zoom, negative rulers, manual resize, restore fit, disc clipping, editor-only hairline

[PASS] build (exit=0, 9s)
> maxlabel@0.1.0 build
> electron-vite build
vite v7.3.6 building ssr environment for production...
transforming...
✓ 28 modules transformed.
rendering chunks...
out/main/index.js  113.04 kB
✓ built in 336ms
vite v7.3.6 building ssr environment for production...
transforming...
✓ 2 modules transformed.
rendering chunks...
out/preload/index.js  7.13 kB
✓ built in 21ms
vite v7.3.6 building client environment for production...
transforming...
✓ 135 modules transformed.
rendering chunks...
../../out/renderer/index.html                      0.50 kB
../../out/renderer/assets/index-CAW4ZY58.css       9.20 kB
../../out/renderer/assets/fabric-ChPYCl1_.js     377.02 kB
../../out/renderer/assets/xlsx-B9fgUmyE.js       987.69 kB
../../out/renderer/assets/index-D0ffZ_kf.js    1,090.82 kB
../../out/renderer/assets/barcode-CxklNei4.js  1,647.24 kB
✓ built in 7.24s

[PASS] test:ui (exit=0, 168s)
6/6 PASS
6/6 PASS
===== ui-v60.cjs =====
PASS script data source remains seventh in ordered entry list => true
PASS script editor has OnGetData default => true
PASS script editor exposes lifecycle variable hint => true
PASS allow script is disabled by default => true
PASS template properties expose global script field => true
PASS global script field is empty by default => true
PASS text properties expose cut and length controls => true
PASS keep-right reveals cut count => true
PASS minimum length reveals padding fields => true
PASS minimum padding defaults to left => true
10/10 PASS
10/10 PASS
========== 姹囨€?==========
ui-v52.cjs : 66/66 : 66/66 PASS
ui-v53.cjs : 15/15 : 15/15 PASS
ui-v54.cjs : 11/11 : 11/11 PASS
ui-v55.cjs : 5/5 : 5/5 PASS
ui-v56.cjs : 11/11 : 11/11 PASS
ui-v57.cjs : 7/7 : 7/7 PASS
ui-v58.cjs : 7/7 : 7/7 PASS
ui-v59.cjs : 6/6 : 6/6 PASS
ui-v60.cjs : 10/10 : 10/10 PASS

[PASS] parity:matrix (exit=0, 1s)
=== parity/matrix.md 校验 ===
总条目：605
按章节 / 状态：
  A 界面与操作习惯          共 272 条：待核=191  已实现=63  部分=18
  B 编辑器对象能力          共 141 条：待核=105  已实现=19  部分=17
  C 数据源与数据库          共 101 条：待核=57  已实现=38  部分=6
  D 打印链路             共  75 条：待核=68  部分=7
  E 其他               共  16 条：部分=13  未实现=3
合计：已实现 120 / 部分 61 / 未实现 3 / 待核 421（覆盖率 30%）
校验通过：编号、状态、证据、出处文件均合规。

