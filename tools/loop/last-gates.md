# 门禁结果（round-141）

- 时间：2026-09-23 15:03:52
- HEAD：501d4a4e4a2c4a8830edeff97a0b9f44ffe0d635
- 门禁策略：跑全量 test:ui（本轮改了 UI 相关文件：app/scripts/ui-v121.cjs）
- 结论：全部通过

[PASS] typecheck (exit=0, 3s)
> maxlabel@1.0.20 typecheck
> npm run typecheck:node && npm run typecheck:web
> maxlabel@1.0.20 typecheck:node
> tsc --noEmit -p tsconfig.node.json
> maxlabel@1.0.20 typecheck:web
> tsc --noEmit -p tsconfig.web.json

[PASS] test:architecture (exit=0, 1s)
> maxlabel@1.0.20 test:architecture
> node scripts/architecture-check.cjs && node scripts/runner-safety.test.cjs
8 architecture checks passed锛堝惈 DIFF-83 鏃犲瓧闈㈤噺鍔犻€熼敭锛?24 runner safety checks passed

[PASS] test:editor (exit=0, 1s)
> maxlabel@1.0.20 test:editor
> esbuild scripts/editor-operations.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_editor.cjs && node scripts/_editor.cjs && node -e "require('fs').unlinkSync('scripts/_editor.cjs')"
  scripts\_editor.cjs  32.6kb
Done in 52ms
42 editor operation checks passed

[PASS] test:geometry (exit=0, 1s)
> maxlabel@1.0.20 test:geometry
> esbuild scripts/editor-geometry.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_geometry-test.cjs && node scripts/_geometry-test.cjs && node -e "require('fs').unlinkSync('scripts/_geometry-test.cjs')"
  scripts\_geometry-test.cjs  2.0mb
Done in 100ms
1 editor geometry check passed

[PASS] test:history (exit=0, 1s)
> maxlabel@1.0.20 test:history
> esbuild scripts/document-history.test.ts --bundle --platform=node --format=cjs --outfile=scripts/_history.cjs && node scripts/_history.cjs && node -e "require('fs').unlinkSync('scripts/_history.cjs')"
  scripts\_history.cjs  3.8kb
Done in 5ms
9 document history checks passed

[PASS] test:print (exit=0, 2s)
  鉁?ODBC锛歁ySQL 杩炴帴涓?  鉁?ODBC锛欴SN 杩炴帴涓?  鉁?鍏煎鐭╅樀锛歓ebra 鎺ㄨ崘 ZPL銆佷匠鍗氭帹鑽?TSPL
  鉁?鍏煎鐭╅樀锛氭湭鐭ュ搧鐗屽洖閫€ TSPL 涓旂煩闃靛惈鍏滃簳鏉＄洰
  鉁?鍏煎鐭╅樀锛氭竻鍗曞寘鍚覆鍙ｄ笌涓枃缂栫爜妫€鏌ラ」
  鉁?绂荤嚎浜戝簱鍏佽绌哄湴鍧€骞舵嫆缁濅笉瀹夊叏杩滅▼鍦板潃
  鉁?鏁版嵁搴撶┖瀵嗙爜淇濈暀涓虹郴缁熷畨鍏ㄥ瓨鍌ㄥ洖閫€璇箟
  鉁?绌烘寚浠ゅ湪涓昏繘绋嬭竟鐣岃鎷掔粷
  鉁?鎵撳嵃绔彛杈圭晫涓嶉€忎紶鏈煡瀛楁
  鉁?LPT 绔彛淇濈暀 LabelShop 骞跺彛閰嶇疆涓斾笉閫忎紶鏈煡瀛楁
  鉁?鎵撳嵃绔彛鍚勭被閰嶇疆鍧囧彲楠岃瘉涓旀嫆缁濇棤鏁堝弬鏁?  鉁?搴忓垪鍙疯В鏋愶紙鎸?labelIndex锛?  鉁?搴忓垪鍙烽噸澶嶆寜鏍囩鎺ㄨ繘骞跺湪鎵撳嵃鍚庢帹杩涗竴娆?  鉁?搴忓垪鍙峰垵濮嬪€煎彲浠庨敭鐩樿緭鍏ユ垨鏁版嵁搴撳瓧娈佃鍙?  鉁?database source uses the selected field and per-label record offset
  鉁?鏃ユ湡/鏃堕棿鏍煎紡鍖?  鉁?鍚屼竴鎵撳嵃涓婁笅鏂囧浐瀹氭棩鏈熸椂闂村揩鐓?  鉁?鏃ユ湡鏍煎紡鏀寔涓枃缁勫悎涓庢棩鏈熷亸绉?  鉁?鏃堕棿鍖哄煙涓庡亸绉诲瓧娈靛彲瑙ｆ瀽
  鉁?VBScript OnGetData supports concatenation, arithmetic and globals
  鉁?鑴氭湰璇█閫夐」椹卞姩鏃犲嚱鏁板０鏄庣殑鑴氭湰鎵ц
  鉁?鑴氭湰璇硶妫€鏌ユ寜璇█鎶ュ憡璇硶閿欒
  鉁?鑴氭湰鍑洪敊鏃舵暣鍨嬪彉閲忕疆绌哄瓧绗︿覆
  鉁?鑴氭湰鑼冨洿锛氶瀹氫箟鑴氭湰搴撳彧璇讳笖鍙皟鐢?  鉁?闈炴墦鍗?ASCII 瀛楃琛ㄥ惈 1鈥?1 鍏?31 椤逛笖鐮佷綅閫掑
  鉁?template lifecycle updates output count and shared variables
  鉁?substring cut/trim/keep and max length
  鉁?min length padding
  鉁?ASCII 鎺у埗瀛楃 1-31 鍏ㄨ〃瑙ｇ爜
  鉁?ASCII 鎺у埗瀛楃鏀寔鍙屽乏灏栨嫭鍙疯浆涔?  鉁?鍒嗛殧鏂囨湰榛樿閫楀彿骞舵敮鎸佸埗琛ㄧ/寮曞彿
  鉁?鍒嗛殧鏂囨湰鎸?BOM 璇嗗埆 UTF-8/UTF-16锛屾棤 BOM 鍥為€€ GB18030
  鉁?娴嬭瘯鎵撳嵃涓嶅啓鏃ュ織涓斾笉鎺ㄨ繘搴忓垪鍙?  鉁?鎵撳嵃鏃ュ織 CSV 琛ㄥご瑕嗙洊 LabelShop 淇濆瓨椤圭洰
  鉁?鏃嬭浆180搴﹁緭鍑哄彧鏀瑰彉鎵撳嵃鍓湰鏂瑰悜
  鉁?鑷姩鏃嬭浆杈撳嚭椤甸潰鎸夌焊寮犳柟鍚戞敼鍙樺叡浜満鏅?  鉁?鑷姩鏃嬭浆棰勮涓庢寚浠よ緭鍑哄叡鐢ㄦ棆杞悗鐨?ResolvedPrintScene
鍏遍€氳繃 110 椤规柇瑷€缁勩€?

[PASS] test:render (exit=0, 1s)
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
PASS roundRect default radius follows LabelShop fixed 1mm rule
PASS roundRect preview path uses the shared 1mm arc
PASS rect paper path has zero outer radius
PASS circle paper path uses width and height as diameters
PASS circle with a hole uses the hole diameter in the shared path
PASS renderLabel clips the default roundRect corner with the shared radius
PASS rectangle hole shape survives save/open normalization
PASS print scene forwards the rectangle hole shape to output
PASS renderLabel clips the rectangle hole as a centred square
PASS circle hole leaves the square corner printed (rect and circle holes differ)
PASS transparent-background barcode renders bars (not a solid black block)
PASS transparent-background barcode keeps its transparent background
66 rendering checks passed

[PASS] test:workspace (exit=0, 4s)
> maxlabel@1.0.20 test:workspace
> electron scripts/workspace-regression.cjs
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
> maxlabel@1.0.20 build
> electron-vite build
vite v7.3.6 building ssr environment for production...
transforming...
鉁?35 modules transformed.
rendering chunks...
out/main/index.js  138.58 kB
鉁?built in 344ms
vite v7.3.6 building ssr environment for production...
transforming...
鉁?2 modules transformed.
rendering chunks...
out/preload/index.js  8.23 kB
鉁?built in 19ms
vite v7.3.6 building client environment for production...
transforming...
鉁?154 modules transformed.
rendering chunks...
../../out/renderer/index.html                      0.50 kB
../../out/renderer/assets/index-B6D3LzPX.css      11.38 kB
../../out/renderer/assets/fabric-BWsEBtPp.js     377.04 kB
../../out/renderer/assets/xlsx-B9fgUmyE.js       987.69 kB
../../out/renderer/assets/index-BLNgjkQw.js    1,630.00 kB
../../out/renderer/assets/barcode-CxklNei4.js  1,647.24 kB
鉁?built in 6.52s

[PASS] test:ui (exit=0, 2001s)
ui-v119.cjs : 36/36 : 36/36 PASS
ui-v120.cjs : 16/16 : 16/16 PASS
ui-v121.cjs : 14/14 : 14/14 PASS
ui-v122.cjs : 20/20 : 20/20 PASS
ui-v123.cjs : 17/17 : 17/17 PASS
ui-v124.cjs : 12/12 : 12/12 PASS
ui-v125.cjs : 19/19 : 19/19 PASS
ui-v126.cjs : 13/13 : 13/13 PASS
ui-v127.cjs : 5/5 : 5/5 PASS
ui-v128.cjs : 2/2 : 2/2 PASS
ui-v129.cjs : 17/17 : 17/17 PASS
ui-v130.cjs : 17/17 : 17/17 PASS
ui-v131.cjs : 16/16 : 16/16 PASS
ui-v132.cjs : 5/5 : 5/5 PASS
ui-v133.cjs : 8/8 : 8/8 PASS
ui-v134.cjs : 19/19 : 19/19 PASS
ui-v135.cjs : 30/30 : 30/30 PASS
ui-v136.cjs : 11/11 : 11/11 PASS
ui-v137.cjs : 6/6 : 6/6 PASS
ui-v138.cjs : 11/11 : 11/11 PASS
ui-v139.cjs : 7/7 : 7/7 PASS
ui-v140.cjs : 14/14 : 14/14 PASS
ui-v141.cjs : 21/21 : 21/21 PASS
ui-v142.cjs : 6/6 : 6/6 PASS
ALL SCRIPTS PASSED (93/93)

[PASS] parity:matrix (exit=0, 1s)
=== parity/matrix.md 校验 ===
总条目：609
按章节 / 状态：
  A 界面与操作习惯          共 276 条：已实现=276
  B 编辑器对象能力          共 141 条：已实现=141
  C 数据源与数据库          共 101 条：已实现=101
  D 打印链路             共  75 条：已实现=75
  E 其他               共  16 条：已实现=16
合计：已实现 609 / 部分 0 / 未实现 0 / 待核 0（覆盖率 100%）
校验通过：编号、状态、证据、出处文件均合规。

