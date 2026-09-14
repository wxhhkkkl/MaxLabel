# 门禁结果（round-23）

- 时间：2026-09-15 00:02:48
- HEAD：150967d6c498b1ea3269bb28fae865e179a80a26
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
Done in 59ms
16 editor operation checks passed

[PASS] test:geometry (exit=0, 2s)
> maxlabel@0.1.0 test:geometry
> esbuild scripts/editor-geometry.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_geometry-test.cjs && node scripts/_geometry-test.cjs && node -e "require('fs').unlinkSync('scripts/_geometry-test.cjs')"
  scripts\_geometry-test.cjs  2.0mb
Done in 121ms
1 editor geometry check passed

[PASS] test:history (exit=0, 1s)
> maxlabel@0.1.0 test:history
> esbuild scripts/document-history.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_history.cjs && node scripts/_history.cjs && node -e "require('fs').unlinkSync('scripts/_history.cjs')"
  scripts\_history.cjs  3.8kb
Done in 5ms
9 document history checks passed

[PASS] test:print (exit=0, 3s)
  ✓ 数据库空密码保留为系统安全存储回退语义
  ✓ 空指令在主进程边界被拒绝
  ✓ 打印端口边界不透传未知字段
  ✓ LPT 端口保留 LabelShop 并口配置且不透传未知字段
  ✓ 打印端口六类配置均可验证且拒绝无效参数
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
  ✓ min length padding
  ✓ ASCII 控制字符 1-31 全表解码
  ✓ ASCII 控制字符支持双左尖括号转义
  ✓ 分隔文本默认逗号并支持制表符/引号
  ✓ 分隔文本按 BOM 识别 UTF-8/UTF-16，无 BOM 回退 GB18030
  ✓ 测试打印不写日志且不推进序列号
  ✓ 打印日志 CSV 表头覆盖 LabelShop 保存项目
  ✓ 旋转180度输出只改变打印副本方向
共通过 91 项断言组。

[PASS] test:render (exit=0, 3s)
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

[PASS] test:workspace (exit=0, 5s)
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

[PASS] build (exit=0, 12s)
> maxlabel@0.1.0 build
> electron-vite build
vite v7.3.6 building ssr environment for production...
transforming...
✓ 29 modules transformed.
rendering chunks...
out/main/index.js  114.32 kB
✓ built in 369ms
vite v7.3.6 building ssr environment for production...
transforming...
✓ 2 modules transformed.
rendering chunks...
out/preload/index.js  7.13 kB
✓ built in 23ms
vite v7.3.6 building client environment for production...
transforming...
✓ 136 modules transformed.
rendering chunks...
../../out/renderer/index.html                      0.50 kB
../../out/renderer/assets/index-CAW4ZY58.css       9.20 kB
../../out/renderer/assets/fabric-ChPYCl1_.js     377.02 kB
../../out/renderer/assets/xlsx-B9fgUmyE.js       987.69 kB
../../out/renderer/assets/index-YT_LgJxe.js    1,147.22 kB
../../out/renderer/assets/barcode-CxklNei4.js  1,647.24 kB
✓ built in 10.16s

[PASS] test:ui (exit=0, 356s)
PASS custom page settings are editable => true
PASS custom page width accepts millimetre input => true
PASS selecting A4 applies 210 by 297 millimetres => true
15/15 PASS
15/15 PASS
========== 姹囨€?==========
ui-v52.cjs : 66/66 : 66/66 PASS
ui-v53.cjs : 15/15 : 15/15 PASS
ui-v54.cjs : 11/11 : 11/11 PASS
ui-v55.cjs : 5/5 : 5/5 PASS
ui-v56.cjs : 11/11 : 11/11 PASS
ui-v57.cjs : 8/8 : 8/8 PASS
ui-v58.cjs : 7/7 : 7/7 PASS
ui-v59.cjs : 6/6 : 6/6 PASS
ui-v60.cjs : 15/15 : 15/15 PASS
ui-v61.cjs : 2/2 : 2/2 PASS
ui-v62.cjs : 13/13 : 13/13 PASS
ui-v63.cjs : 12/12 : 12/12 PASS
ui-v64.cjs : 7/7 : 7/7 PASS
ui-v65.cjs : 2/2 : 2/2 PASS
ui-v66.cjs : 3/3 : 3/3 PASS
ui-v67.cjs : 7/7 : 7/7 PASS
ui-v68.cjs : 14/14 : 14/14 PASS
ui-v69.cjs : 9/9 : 9/9 PASS
ui-v70.cjs : 15/15 : 15/15 PASS

[PASS] parity:matrix (exit=0, 1s)
=== parity/matrix.md 校验 ===
总条目：605
按章节 / 状态：
  A 界面与操作习惯          共 272 条：待核=191  已实现=63  部分=18
  B 编辑器对象能力          共 141 条：待核=93  已实现=26  部分=19  未实现=3
  C 数据源与数据库          共 101 条：待核=18  已实现=83
  D 打印链路             共  75 条：待核=23  已实现=48  部分=4
  E 其他               共  16 条：部分=13  未实现=3
合计：已实现 220 / 部分 54 / 未实现 6 / 待核 325（覆盖率 45%）
校验通过：编号、状态、证据、出处文件均合规。

