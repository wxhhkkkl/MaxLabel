# 门禁结果（round-08）

- 时间：2026-09-14 14:37:57
- HEAD：3d67e4d7086fe96e8ad75bb2c08335cb4c80d36a
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
Done in 52ms
16 editor operation checks passed

[PASS] test:geometry (exit=0, 1s)
> maxlabel@0.1.0 test:geometry
> esbuild scripts/editor-geometry.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_geometry-test.cjs && node scripts/_geometry-test.cjs && node -e "require('fs').unlinkSync('scripts/_geometry-test.cjs')"
  scripts\_geometry-test.cjs  2.0mb
Done in 123ms
1 editor geometry check passed

[PASS] test:history (exit=0, 1s)
> maxlabel@0.1.0 test:history
> esbuild scripts/document-history.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_history.cjs && node scripts/_history.cjs && node -e "require('fs').unlinkSync('scripts/_history.cjs')"
  scripts\_history.cjs  3.8kb
Done in 5ms
9 document history checks passed

[PASS] test:print (exit=0, 1s)
  ✓ TSPL RFID：写入 EPC + LOCK
  ✓ ZPL RFID：^RFW 写入 + 访问密码 + ^RLM 锁定
  ✓ TSPL 内建字体：TEXT "Font3"
  ✓ ZPL 内建字体：^AA
  ✓ TSPL 旋转使用 0/90/180/270，回退使用点数
  ✓ ZPL Code93/Data Matrix 命令与字段转义
  ✓ CPCL 页头、线性条码、QR/PDF417/Data Matrix 语法
  ✓ 位图行宽保持真实值：ZPL ^GFA / CPCL EG
  ✓ suppressPrint 对象不进入原生指令
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
  ✓ 日期/时间格式化
  ✓ 同一打印上下文固定日期时间快照
共通过 72 项断言组。

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

[PASS] build (exit=0, 8s)
> maxlabel@0.1.0 build
> electron-vite build
vite v7.3.6 building ssr environment for production...
transforming...
✓ 27 modules transformed.
rendering chunks...
out/main/index.js  111.18 kB
✓ built in 323ms
vite v7.3.6 building ssr environment for production...
transforming...
✓ 2 modules transformed.
rendering chunks...
out/preload/index.js  6.88 kB
✓ built in 20ms
vite v7.3.6 building client environment for production...
transforming...
✓ 133 modules transformed.
rendering chunks...
../../out/renderer/index.html                      0.50 kB
../../out/renderer/assets/index-CAW4ZY58.css       9.20 kB
../../out/renderer/assets/fabric-ChPYCl1_.js     377.02 kB
../../out/renderer/assets/xlsx-B9fgUmyE.js       987.69 kB
../../out/renderer/assets/index-Kr3e3DL9.js    1,052.10 kB
../../out/renderer/assets/barcode-CxklNei4.js  1,647.24 kB
✓ built in 6.77s

[PASS] test:ui (exit=0, 61s)
PASS 打印面板标题跟随当前文档 => true
PASS 打印面板仅保留原版基础字段 => true
PASS 图层面板六个工具按钮顺序正确 => true
PASS 图层列表三列且保留默认层 => true
PASS Ctrl+P打开打印对话框并承载高级选项 => true
15/15 PASS
15/15 PASS
===== ui-v54.cjs =====
PASS 左栏顶部为头像和未登录且无品牌标题 => true
PASS 计数格文案逐字一致 => true
PASS 开始列表七行顺序与模版文案正确 => true
PASS 开始列表协议入口齐全 => true
PASS 起始页登录与云马通首页协议正确 => true
PASS 右区广告位最新文章下载块存在 => true
PASS 最近空态可见且无伪造模板卡片 => true
PASS 计数格保留 OpenULogin 协议 => true
PASS 打开标签模版入口可打开模板库 => true
PASS 最近列表读取 RecentFile 记录并生成 OpenDocument 路径 => true
PASS 最近标题支持折叠和展开 => true
11/11 PASS
11/11 PASS
========== 姹囨€?==========
ui-v52.cjs : 66/66 : 66/66 PASS
ui-v53.cjs : 15/15 : 15/15 PASS
ui-v54.cjs : 11/11 : 11/11 PASS

