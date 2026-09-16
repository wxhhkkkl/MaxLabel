# 签赋 LabelShop「启始页」实现规格（依据真机原版文件）

> 资料员产出，**只读原文件、不改任何产品代码**。
> 全部文字均**照抄原文件**，未翻译、未润色。
> 凡属推断的内容，行内标注「**推断**」并给出依据。

---

## 0. 文件清单与优先级（先读这一节，否则会做错版本）

真机 `%APPDATA%\LabelShop\LabelShop\InterAction\` 下实际有 **3 套**启始页/主页相关 HTML。
它们内容不同，必须分清哪一套对应 `00-main.png` 里看到的那一屏。

| 文件 | 大小 | 编码 | 角色 | 是否含模板变量 |
|---|---|---|---|---|
| `default.html` | 16053 B | UTF-8 **带 BOM** | **渲染产物**（= 模板 + 真实数据填充后的静态 HTML），与 `00-main.png` **完全一致** | 否（变量已被替换成真实值） |
| `defaultTmpl.html` | 10796 B | UTF-8 BOM | **旧版模板**（`启始页` 实际渲染用的模板） | 是：`{$USER_UIMG}` `{$USER_UNAME}` `{$USER_COUPON}` `{$USER_ORDERSP}` `{$USER_ORDERSD}` `{$HISTORY}` `{$TOPLINK}` `{$INTERACTION}` |
| `MainPageTmplN.html` | 8952 B | UTF-8 BOM | **新版模板**（瘦身版，只有 `{$HISTORY}` `{$INTERACTION}`） | 是：`{$HISTORY}` `{$INTERACTION}` |
| `StartPageN.html` | 9004 B | UTF-8 BOM | **新版启始页模板**（与 `MainPageTmplN.html` 只差「最近」列表是写死的空 `<br>`） | 否 |
| `topTmpl.html` | 4415 B | UTF-8 BOM | 顶部广告位片段模板（`defaultTmpl.html` 的 `{$TOPLINK}` 内容） | 否 |
| `InterInfo.tml` | 2434 B | UTF-8 BOM | 「最新文章」片段（`{$INTERACTION}` 的内容，5 条 `<dl>`） | 否 |

> 6 个 HTML/TML 文件**全部是 UTF-8 带 BOM**（`EF BB BF` 开头，已逐个验证）。`InterAction.db` 是 SQLite。

**结论（实现依据）**：
- `StartPageN.html` 是任务点名的「**新版起始页**」，它 = `MainPageTmplN.html` 去掉 `{$HISTORY}`/`{$INTERACTION}` 两个占位符。**两者共用同一份 CSS，逐条样式值完全相同**（已逐行 diff）。
- `00-main.png` 那一屏的实际内容来自 **`defaultTmpl.html` 的渲染结果 `default.html`**（含账户区、客服 3 条、最近 `test`、右下「最新文章」+ 云马通二维码块）。
- 因此本规格的**布局与样式以 `StartPageN.html` / `MainPageTmplN.html` 为准**（任务指定的新版），**文字与条目以 `default.html` / `defaultTmpl.html` 为准**，两者差异处均单独标注。

**源文件副本**：全部已复制到 `parity\reference\labelshop\sources\`（SHA256 已逐个校验 MATCH）。

---

## 1. 整体布局分区

### 1.1 CSS 层面（照抄 `StartPageN.html` / `MainPageTmplN.html` 第 36–87 行）

```
.ymg_content12 { background-color:#f5f5f5; width:100%; text-align:left; height:100%;}
.ymg_c12_left  { width:220px; position:absolute; left:0;   top:0; background-color:#FFFFFF; padding:0 0 100px 0;}
.ymg_c12_right { display:inline-block; background-color:#f5f5f5; padding:0 0 100px 0;
                 position:absolute; left:220px; right:0; top:0;}
```

即：**左侧栏固定 220px 白底 + 右侧内容区绝对定位从 x=220px 起自动铺到右边**，右区背景 `#f5f5f5`；再往右是页面背景 `#fff`（`body{background:#fff}`）。

### 1.2 实测（`00-main.png`，2582×1550 物理像素）

截图机器为 **150% DPI**（见 `INDEX.md` 采集说明：物理屏 2560×1600，虚拟坐标 1707×1067），
`00-main.png` 是**物理像素**抓图。启始页 HTML 的可视区（WebBrowser 控件客户区）实测：

| 区域 | 物理像素 | 比例 |
|---|---|---|
| 启始页文档原点 | (15, 225) | — |
| 文档可视宽度（含滚动条） | 15 → 2566 ≈ **2551 px** | 100% |
| 左侧栏（纯白 `#f5f5f5`→白分界在 x=343，故左栏从 15 到 343） | **328 px** | **12.9%** |
| 右侧内容区背景 `#f5f5f5` | 344 → 2542（**2199 px**） | 86.2% |
| 右侧竖向滚动条 | 2544 → 2565 | — |

- **推断**：左侧栏 HTML 宽度 = 220px（CSS 硬编码），实测 328 物理 px ÷ 220 = **1.49 ≈ 150% DPI**，与采集说明一致 → 换算系数 **1 物理 px ≈ 0.671 逻辑 px（CSS px）**。
- **推断**：右侧内容区 HTML 宽度 ≈ 2199 × 0.671 ≈ **1476 CSS px**（随窗口宽度自适应，非固定值）。
- 文档页签栏（`启始页`）占 y=192–221（物理），启始页内容从 y=225 起。

### 1.3 右侧内容区内部的固定宽度表

`default.html` / `defaultTmpl.html` 的**顶部广告位**是一张：

```html
<table width="780pt" border="0" cellpadding="0" cellspacing="0">
```

配套：

```
.tdimg  img {width: 780pt}
.tdimgs img {width: 390pt}
```

`780pt` 在 96dpi 下 = 1040 CSS px。实测广告位横幅宽 ≈ 745 逻辑 px（见 §3.3），
**推断**：WebBrowser 以「1pt ≈ 1.0px」渲染 pt 值（IE 在 `META X-UA-Compatible IE=9` 下 pt→px 使用 96dpi 但对 `width` 属性按 1:1 处理），故 `780pt` 实际占约 780 px。此表是**上一版模板的遗留**，`StartPageN.html` 已经没有这张表。

### 1.4 分区总览

```
┌───────────────────────── 启始页文档 ─────────────────────────┐
│ ┌── 左栏 220px 白底 ──┐ ┌──── 右区 (#f5f5f5) ─────────────┐ │
│ │ A 账户区 dl         │ │ ① 顶部广告位（旧模板独有）      │ │
│ │   头像+未登录       │ │    = {$TOPLINK} / 780pt 表      │ │
│ │   3 个计数格        │ │ ② 最新文章 ymg_c12_info03       │ │
│ │   标签商城/新手入门  │ │    = {$INTERACTION}             │ │
│ │ B 开始  b37_info    │ │ ③ 云马通下载块（旧模板独有）    │ │
│ │ C 最近  b37_info    │ │                                 │ │
│ └─────────────────────┘ └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 左栏逐块规格

所有字号/颜色均照抄 `StartPageN.html` 第 36–65 行 CSS。样式名与 CSS 行号已标注。

### 2.A 账户区 `<dl>`（`default.html` 行 98–121 / `defaultTmpl.html` 行 98–121）

容器样式：

```css
.ymg_c12_left dl     { background-color:#FFFFFF; padding:20px 0;}     /* 行40 */
.ymg_c12_left dl dt  { font-size:14px; font-weight:normal; color:#858e9f;
                       text-align:center; line-height:36px;}          /* 行41 */
.ymg_c12_left dl dt img { width:80px; height:80px; border:2px solid #F5EDED;
                       display:block; margin:0 auto; border-radius:1000px;} /* 行42 */
.ymg_c12_left dl dt a   { font-size:14px; color:#666666;}             /* 行43 */
```

#### A-1 头像 + 登录入口（`<dt>`）

| 项 | 值 |
|---|---|
| 头像图 | `http://www.360code.com/images/ymg_peo_pic.jpg` |
| 头像尺寸 | 80×80 px + 2px 边框 `#F5EDED`，`border-radius:1000px`（= 正圆） |
| 头像链接 | `labelshop:UserLogin`，`title="登录 360Code.com"` |
| 头像下文字 | **`未登录`** |
| 文字链接 | `labelshop:UserLogin`，`title="登录 360Code.com"` |
| 文字样式 | 14px / `#666666`（在 `dt a` 规则内），居中，行高 36px |
| 未登录时的实际 DOM | `<a href = "labelshop:UserLogin" title = "登录 360Code.com"><img src = "http://www.360code.com/images/ymg_peo_pic.jpg"></a>`<br>`<a href = "labelshop:UserLogin" title = "登录 360Code.com">未登录</a>` |
| 新版模板对应的变量 | `{$USER_UIMG}`（头像 HTML）、`{$USER_UNAME}`（用户名 HTML） |

实测（物理 px）：头像带边框外径 ≈ 84 逻辑 px，占 y=273–369（= 96 物理 ≈ 65 逻辑，含上下留白）；`未登录` 文字带 y=401–421 → 高 21 物理 = 14 逻辑 px 字号。**与 CSS 完全吻合**。

> **推断**：`未登录` 是服务端/本地登录态为「未登录」时下发的兜底文案；登录后 `{$USER_UNAME}` 会被换成账号昵称。依据：`defaultTmpl.html` 用 `{$USER_UNAME}` 占位，而 `default.html` 里渲染成固定字符串 `未登录`。

#### A-2 三个计数格（`<dd><ul>`，每格 `width:32%`）

容器与条目样式：

```css
.ymg_c12_left dl dd          { overflow:hidden; border-bottom:0px solid #e4e6ea;
                               border-top:1px solid #e4e6ea;
                               padding:5px 0px 5px 10px; margin-top:10px;}   /* 行44 */
.ymg_c12_left dl dd ul li    { width:32%; float:left; display:inline;
                               font-size:12px; font-weight:normal; color:#FFFFFF;
                               text-align:center; line-height:25px;}          /* 行45 */
.ymg_c12_left dl dd ul li a  { display:block; color:#858e9f;}                  /* 行46 */
.ymg_c12_left dl dd ul li a strong { font-size:18px; font-weight:bold; color:#858e9f;
                               display:block; ...}                             /* 行47 */
.ymg_c12_left dl dd ul li a:hover strong { color:#0099ff;}                     /* 行48 */
```

**逐格确切文字与链接（照抄 `default.html` 行 105–113）**：

| # | 数字 | 文字 | `href` | `title` |
|---|---|---|---|---|
| 1 | `0`（`<strong>`） | **`优惠券`** | `labelshop:OpenULogin:http://www.360code.com/member/member_coupon.aspx` | `优惠券` |
| 2 | `0` | **`待支付订单`** | `labelshop:OpenULogin:http://www.360code.com/member/order_all.aspx` | `待支付订单` |
| 3 | `0` | **`待收货订单`** | `labelshop:OpenULogin:http://www.360code.com/member/order_all.aspx` | `待收货订单` |

- 数字：18px 粗体 `#858e9f`，独占一行（`strong{display:block}`）。
- 标签：12px `#858e9f`。
- 三格各占 32% 宽（合计 96%，靠 `float:left` 左排，格间留 4%）。
- 上下有 1px `#e4e6ea` 分隔线（`border-top`），`margin-top:10px`，`padding:5px 0 5px 10px`。
- 新版模板变量：`{$USER_COUPON}` / `{$USER_ORDERSP}` / `{$USER_ORDERSD}`（**注意顺序**：券 → 待**支付** → 待**收货**）。

实测：数字带 y=472–494（高 23 物理 ≈ 15 逻辑 ≈ 18px 字号的字形高），标签带 y=512–529。**吻合**。

#### A-3 `标签商城` / `新手入门` 两个按钮（`<b>`）

```css
.ymg_c12_left dl b        { display:block; text-align:center; margin-top:10px; overflow:hidden;}  /* 行49 */
.ymg_c12_left dl b a      { height:30px; font-size:14px; font-weight:normal; color:#FFF;
                            text-align:center; line-height:30px; display:inline-block;
                            vertical-align:middle; margin:0 1px; width:40%;
                            background-color:#4db8ff; overflow:hidden;}                          /* 行50 */
.ymg_c12_left dl b a:hover{ background-color:#0099ff; font-weight:bold;}                          /* 行51 */
```

| 文字 | `href` | `title` | 内联样式 |
|---|---|---|---|
| **`标签商城`** | `labelshop:OpenULogin:http://www.360code.com/product/` | `转到云马标签商城` | `style="border-radius:2px 2px 2px 2px;"` |
| **`新手入门`** | `labelshop:OpenULogin:http://www.360code.com/about/software.aspx?sign=learnlabelshop` | `转到 LabelShop 新手入门页面` | `style="border-radius:2px 2px 2px 2px;"` |

- 蓝底 `#4DB8FF` 白字，14px，高 30px、行高 30px，各占 40% 宽、左右各 1px 外边距（居中，两侧共留 ~19%）。
- hover：底色 `#0099ff` + 加粗。
- 新版模板（`StartPageN.html` 行 106–107）这里**没有 `labelshop:` 前缀**，是裸 `http://` 链接（差异已记录，见 §6）。
- **实测佐证**：`00-main.png` 中这两个按钮的蓝色实测为 `rgb(72,180,252)` ≈ **#4DB8FF**，与 CSS 一致；按钮 y 范围物理 564–609（**46 物理 px**），与 CSS `height:30px` × 1.5 = 45 吻合（±1 px 取整）。

### 2.B `开始` 区（`<div class="ymg_blk37">` → `<div class="b37_info">`）

```css
.ymg_blk37             { overflow:hidden;margin-top:0px;}                     /* 行53 */
.b37_info              { overflow:hidden; }                                    /* 行55 */
.b37_info h1           { font-size:32px; font-weight:bold; line-height:36px;
                         display:block; margin:0; color:#e7168e;}              /* 行56 */
.b37_info h2 span      { display:block; height:20px;}                          /* 行57 */
.b37_info h2 span a    { height:30px; line-height:20px; display:block; font-size:16px;
                         font-weight:bold; color:#4db8ff; text-align:left;
                         background-repeat:no-repeat; background-position:right 0;
                         padding:0 20px; cursor:pointer;}                      /* 行58 */
.b37_info h2 span a.hidecontent {color:#858e9f;}                               /* 行59 */
.b37_info_main         { overflow:hidden; height:1%; padding:0 0 10px 0;}       /* 行60 */
.b37_info_main ul li   { font-size:14px; font-weight:normal; line-height:25px;
                         text-align:center; display:block; height:25px; overflow:hidden;} /* 行61 */
.b37_info_main ul li a { color:#858e9f; display:block; text-align:left; padding:0 20px;} /* 行62 */
.b37_info_main ul li a:hover { background-color:#0099ff; color:#FFF;}          /* 行63 */
.b37_info_main ul li.on a    { background-color:#f5f5f5; color:#333333; font-weight:bold;} /* 行64 */
```

#### B-1 大标题

`StartPageN.html` / `MainPageTmplN.html` 有（两行 `<br>` 之后）：

```html
<h1>&nbsp;&nbsp;LabelShop</h1>
```

→ 显示为 **`  LabelShop`**（前置两个不换行空格），32px 粗体，**品红色 `#e7168e`**。
**注意**：`default.html` / `defaultTmpl.html` 的 `<body>` 里**没有这个 `<h1>`**（只有 CSS 定义），所以 `00-main.png` 里看不到它。

#### B-2 区标题 `开始`（`<h2><span><a>`）

旧版模板（`default.html` 行 126–129，与截图一致）：

```html
<h2><span><a href="LabelShop:OpenCodingV"  title="打开云马通应用首页">开始
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
<font color="#ff6600">云马通首页</font>
</a></span></h2>
```

- 左侧词 **`开始`**，16px 粗体 `#4db8ff`，左对齐，左右 padding 20px，行高 20px，块高 30px。
- 同一行右侧（靠 9 个 `&nbsp;` 撑开）是橙色 **`云马通首页`**（`#ff6600`）。
- 整行是一个链接：`href="LabelShop:OpenCodingV"`，`title="打开云马通应用首页"`。
- 新版模板 `StartPageN.html` 行 113 只有 **`<h2><span><a>开始</a></span></h2>`**，**没有 `云马通首页` 这一项**。

#### B-3 `开始` 列表（`<ul>`）逐项

**新版 `StartPageN.html` 行 115–120（4 项）**：

| # | 文字 | `href` | `title` |
|---|---|---|---|
| 1 | **`在线客服`** | `http://wpa.qq.com/msgrd?v=3&uin=3316386126&site=qq&menu=yes` | `在线咨询，QQ：3316386126` |
| 2 | **`新建标签模版`** | `LabelShop:NewDocument` | `新建新的标签格式模板` |
| 3 | **`打开标签模版`** | `LabelShop:OpenDocument` | `打开保存的标签格式模板` |
| 4 | **`打开本机模版`** | `LabelShop:OpenLocal` | `打开本机上保存的标签格式模板` |

> 注意：原文用的是**「模版」**（不是「模板」）。照抄，不要改。

**旧版 `default.html` 行 139–147 / `defaultTmpl.html` 行 139–147（截图实际显示的 7 项）**：

| # | 文字（含内联样式） | `href` | `title` |
|---|---|---|---|
| 1 | **`客服1QQ：1669809392`** | `http://wpa.qq.com/msgrd?v=3&uin=1669809392&site=qq&menu=yes` | `在线客服1，QQ：1669809392` |
| 2 | **`客服2QQ：3395913685`** | `http://wpa.qq.com/msgrd?v=3&uin=3395913685&site=qq&menu=yes` | `在线客服2，QQ：3395913685` |
| 3 | **`客服电话：4000-987-360`** | `#` | `客服电话：4000-987-360` |
| 4 | **`新建标签模版`** | `LabelShop:NewDocument` | `新建新的标签格式模板` |
| 5 | **`打开标签模版`** | `LabelShop:OpenDocument` | `打开保存的标签格式模板` |
| 6 | **`打开本机模版`** | `LabelShop:OpenLocal` | `打开本机上保存的标签格式模板` |
| 7 | **`下载云马通APP`**（包在 `<font color="#ff6600">` 里） | `labelshop:OpenUrl:http://www.codingv.com/c/app_downloadpc` | `下载云马通APP,手机编辑打印标签` |

被 HTML 注释掉的 3 行（`default.html` 行 132–137，**不渲染**，但保留在源码里说明历史入口）：

```html
<!---	
<li><a href="http://www.360code.com/labelshop/data/newServicePage.html" title="在线咨询">在线客服</a></li>
<li><a href="http://wpa.qq.com/msgrd?v=3&uin=1669809392&site=qq&menu=yes" title="在线咨询，QQ：1669809392">在线客服</a></li>

<li><a href="http://www.360code.com/webChat/onlineservice.aspx" title="在线咨询">在线客服</a></li>
-->
```

**列表项通用样式**：14px / `#858e9f`，`line-height:25px`，`height:25px`，`overflow:hidden`，整行可点（`a{display:block}`），左右 padding 20px，文字左对齐。
hover → 底 `#0099ff`、字 `#FFF`；当前项 `.on` → 底 `#f5f5f5`、字 `#333333`、加粗。

**实测**：每项文字带高 21 物理 px（对应 14px 字号），**相邻项中心距 38.1 物理 px**。
按 §1.2 的 **1.49 ≈ 1.5 倍**换算，CSS `line-height:25px` 应得 25×1.5 = **37.5 物理 px**，与实测 38.1 吻合（±0.6 px）。
（若误按 1.25 倍换算会得 31.25，与实测明显不符 —— 这也反过来印证了 1.5 倍/150% DPI 的判断。）

### 2.C `最近` 区（第二个 `b37_info`）

**新版 `StartPageN.html` 行 124–131**（写死空占位，未接数据）：

```html
<div class="b37_info">
<br>
<h2><span><a>最近</a></span></h2>
<div class="b37_info_main">
  <ul>
<br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br>
  </ul>
</div>
</div>
```

- 标题 **`最近`**（与 `开始` 同一样式：16px 粗体 `#4db8ff`），无 `href`，仅 `cursor:pointer`。
- 列表体是 **20 个 `<br>`**（撑高用），无条目。

**新版模板 `MainPageTmplN.html` 行 129 / 旧版 `defaultTmpl.html` 行 157** 此处是变量 **`{$HISTORY}`**。

**旧版渲染结果 `default.html` 行 157–158**（截图里看到的那一条）：

```html
<li><a href="LabelShop:OpenDocument:C:\Users\liyan\Downloads\test.lsdx" title="C:\Users\liyan\Downloads\test.lsdx">test</a></li>
<br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br><br>
```

| 项 | 值 |
|---|---|
| 显示文字 | **`test`** |
| `href` | `LabelShop:OpenDocument:C:\Users\liyan\Downloads\test.lsdx` |
| `title` | `C:\Users\liyan\Downloads\test.lsdx` |
| 格式规律 | `LabelShop:OpenDocument:<文件绝对路径>`，显示名取文件主名（`test.lsdx` → `test`） |
| 数据源 | `%APPDATA%\LabelShop\LabelShop\RecentFile\RecentFile.db` → 表 **`RecentFile`**，字段 `id / path / title / user / updatetime / state` |
| 该表当时仅 1 行 | `id=1 ; path=C:\Users\liyan\Downloads\test.lsdx ; title=test ; user=0 ; updatetime=2026-09-09 09:09:50 ; state=0` |

---

## 3. 右侧内容区逐块规格

右区容器：`.ymg_c12_right{ display:inline-block; background-color:#f5f5f5; padding:0 0 100px 0; position:absolute; left:220px; right:0; top:0;}`

### 3.1 ① 顶部广告位（旧模板独有）

`defaultTmpl.html` 行 167–170：

```html
<div class="ymg_c12_right">
  <div class="ymg_c12_info">
{$TOPLINK}
  </div>
  ...
```

- 容器 `.ymg_c12_info { overflow:hidden; padding:35px;}`（行 66）。
- `{$TOPLINK}` 的内容就是 **`topTmpl.html`**（整段 `<table width="780pt">`），其中可渲染的 3 个链接为：

| # | 图 | 链接 | `title` |
|---|---|---|---|
| 1 | `http://down2.360code.com/mainpage/topright.png`（宽 390pt） | `LabelShop:OpenULogin:http://www.360code.com/product/category.aspx?cate_id=70&brand_id=0&keyword=&isgallerylist=&orderby=` | `签赋` |
| 2 | `http://file.360code.com/mainpage/topleft.jpg`（宽 390pt） | `LabelShop:OpenULogin:http://www.360code.com/about/software.aspx?sign=course` | `签赋` |
| 3 | `http://file.360code.com/mainpage/label1.jpg`（宽 780pt，`colspan="2"`） | `LabelShop:OpenULogin:http://www.360code.com/product/category.aspx?cate_id=11` | `促销` |

- `topTmpl.html` 里另有大段被 `<!-- -->` 注释的「特别提示 / 通知」`<font>` 文本（内容为打假提示与 Windows 11 重影通知），**不渲染**，但可作为文案备份。
- 新版 `StartPageN.html` / `MainPageTmplN.html` **完全没有**这一区。

### 3.2 ② `最新文章`（`.ymg_c12_info03`，两版共有）

```css
.ymg_c12_info03            { overflow:hidden; padding:0px 0; margin:0 35px;}     /* 行77 */
.ymg_c12_info03 h2         { font-size:20px; font-weight:normal; color:#333;
                             line-height:24px; display:block; margin-bottom:20px; text-align:left;} /* 行78 */
.ymg_c12_info03 dl         { overflow:hidden; margin-top:10px;}                 /* 行79 */
.ymg_c12_info03 dl dt      { font-size:12px; font-weight:normal; color:#999;
                             line-height:20px; display:block; height:22px;
                             overflow:hidden; margin-bottom:10px;}              /* 行80 */
.ymg_c12_info03 dl dt b    { font-size:18px; line-height:22px; font-weight:normal;
                             color:#0099ff; padding:0 0 0 20px;
                             border-left:4px solid #0099ff; display:inline-block;
                             margin-right:10px;}                                /* 行82 */
.ymg_c12_info03 dl dt a    { color:#0099ff;}                                    /* 行83 */
.ymg_c12_info03 dl dd a    { color:#999;}                                       /* 行84 */
.ymg_c12_info03 dl dd      { font-size:14px; font-weight:normal; color:#666;
                             line-height:20px; text-align:left; display:block;
                             padding:0 0 0 22px;}                               /* 行85 */
```

**标题**：`<h2>最新文章</h2>`（`StartPageN.html` 行 140 / `default.html` 行 218）。
20px 常规体 `#333`，左对齐，下边距 20px。

**内置的第 1 条（两版都有，照抄 `StartPageN.html` 行 141–142）**：

```html
<dl><dt><b><a href = "LabelShop:OpenUrl:http://www.360code.com/about/software.aspx?sign=learnlabelshop" title="http://www.360code.com/about/software.aspx?sign=learnlabelshop">学习使用 LabelShop ，从这里开始<font color="#EE0000">&nbsp;●</font></a></b></dt>
<dd>包含 LabelShop 使用教程和在线帮助的网页，快速了解和掌握 LabelShop 的使用方法，解决使用 LabelShop 过程中遇到的常见问题。</dd></dl>
```

| 项 | 值 |
|---|---|
| 标题文字 | `学习使用 LabelShop ，从这里开始` + 红色圆点 `&nbsp;●`（`#EE0000`） |
| 标题链接 | `LabelShop:OpenUrl:http://www.360code.com/about/software.aspx?sign=learnlabelshop` |
| 正文 | `包含 LabelShop 使用教程和在线帮助的网页，快速了解和掌握 LabelShop 的使用方法，解决使用 LabelShop 过程中遇到的常见问题。` |
| 正文样式 | 14px / `#666`，`padding-left:22px` |

**动态插入位置**：
- `MainPageTmplN.html` 行 142 → `{$INTERACTION}`（位于 `<h2>最新文章</h2>` 之后、内置第 1 条 `<dl>` **之前**）
- `defaultTmpl.html` 行 176 → `{$INTERACTION}`（同上）

**`{$INTERACTION}` 的数据来源 = `InterInfo.tml`**，其内容为 **5 条 `<dl>`**（原文照抄要点）：

| # | 标题 | 日期 | 链接 |
|---|---|---|---|
| 1 | `读取RFID芯片TID或EPC信息并转印到纸面` | `2025-02-10` | `LabelShop:OpenUrl:http://www.360code.com/article/655.htm` |
| 2 | `LabelShop内置免安装驱动打印参数配置` | `2025-02-10` | `…/article/654.htm` |
| 3 | `LabelShop 打印机 免安装驱动` | `2025-02-10` | `…/article/653.htm` |
| 4 | `PDF文件导入签赋LabelShop编辑打印` | `2025-01-17` | `…/article/652.htm` |
| 5 | `签赋LabelShop新功能之表格` | `2025-01-17` | `…/article/650.htm` |

每条结构：`<dl><dt><b><a href="LabelShop:OpenUrl:URL" title="URL">标题<font color="#EE0000">&nbsp;●</font></a></b>日期</dt><dd>摘要</dd></dl>`

`default.html` 中 `{$INTERACTION}` 已被替换成 **`InterInfo.tml` 的 5 条 + 内置第 1 条 = 共 6 条**（行 219–228），与截图一致（截图只露出前 2 条，其余需滚动）。

### 3.3 ③ 云马通下载 / 新功能预览块（旧模板独有，`ymg_c12_info03`）

`default.html` 行 232–255 / `defaultTmpl.html` 行 180–203，照抄：

```html
<div class="ymg_c12_info03">
  <br><br><br><p ><img src="http://down2.360code.com/mainpage/app_download.png" style="margin:0 0" ></p>
  <br><p><font color="#ff6600">扫一扫下载云马通APP，在手机上实现标签模板编辑打印功能</font></p>

  <font size="5" color="#3cb371"><br>签赋LabelShop新功能预览版<br></font>

  <font size="4" >
    体验图层、表格、PDF打印、图标字符插入、条码尺寸自由调整、RFID TID读取、串口输入打印等诸多新功能！<br>

    <a href="LabelShop:OpenUrl:http://down.360code.com/labelshop/LabelShopPreview.zip"  class="yg_a01">
    点击此处下载最新的 签赋LabelShop 6.39.2515 版本安装包</a>
    <br>
  </font>
<!-- 注释掉的旧版下载块，不渲染 -->
</div>
```

| 元素 | 文字 / URL | 样式 |
|---|---|---|
| 二维码图 | `http://down2.360code.com/mainpage/app_download.png` | `style="margin:0 0"` |
| 二维码说明 | `扫一扫下载云马通APP，在手机上实现标签模板编辑打印功能` | `<font color="#ff6600">` |
| 预览版标题 | `签赋LabelShop新功能预览版` | `<font size="5" color="#3cb371">`（`#3cb371` = mediumseagreen） |
| 功能清单 | `体验图层、表格、PDF打印、图标字符插入、条码尺寸自由调整、RFID TID读取、串口输入打印等诸多新功能！` | `<font size="4">` |
| 下载链接 | `点击此处下载最新的 签赋LabelShop 6.39.2515 版本安装包` → `LabelShop:OpenUrl:http://down.360code.com/labelshop/LabelShopPreview.zip` | `class="yg_a01"`（**该类在 CSS 中未定义**） |

### 3.4 截图 `00-main.png` 中右侧可见的图片型卡片（**不在任何 HTML 里**）

| 位置（物理 px） | 内容 | 出处判定 |
|---|---|---|
| x 537–1952, y 225–740 | 浅蓝渐变卡：大标题 `重要通知`、两段正文、蓝底按钮 `购买点击` | **远程图片**（服务端下发） |
| x 1956–2566, y 225–740 | 深蓝卡：书本图标 + `签赋学堂`、`免安装Windows驱动`、`打印不干胶标签` | **远程图片** |
| x 215–2566, y 750–1570 | 深色大横幅：`各类不干胶标签` / `整箱下单·更优惠` / 红底 `联系客服即刻购买` | **远程图片** |
| x 537 起, y 1567–1600+ | `最新文章`（可滚动区起点） | HTML（§3.2） |

**判定依据（重要，实现时不要去找 HTML 文案）**：
1. 三张卡的**所有文字都是位图**——`default.html` 与 `defaultTmpl.html` 中**完全不存在** `重要通知`、`签赋学堂`、`各类不干胶标签`、`整箱下单`、`购买点击` 这些字符串（已全目录 grep）。
2. `defaultTmpl.html` 的拓扑是「`{$TOPLINK}`（顶部 2 小图 + 1 大图广告表）→ `{$INTERACTION}` 最新文章 → 云马通下载块」。截图里「最新文章」出现在最底部（y>1550），说明**「重要通知 + 签赋学堂 + 各类不干胶标签」三张图整体就是 `{$TOPLINK}` 里那张 `780pt` 宽表的 3 个 `<img>`**（2 小 + 1 大），而不是额外的 DOM 卡片。
3. 三张图的实际素材 URL 在 `topTmpl.html` 里是 `topright.png` / `topleft.jpg` / `label1.jpg`；**但截图里渲染出来的画面与该模板文件里写死的 URL 不匹配**（模板里的 `topright.png` 按 `title="签赋"` 应是「签赋」主题小图，而截图左卡是「重要通知」文字卡）。→ **推断**：运行时 `{$TOPLINK}` 由服务端下发（`http://down2.360code.com/mainpage/…` 或 `http://file.360code.com/mainpage/…` 下会随季节/活动更换的位图），`topTmpl.html` 只是**离线兜底模板**。

**因此，`重要通知` 卡的文案必须视为不可硬编码的位图资源**。本规格把从截图里读出的文字**逐字记录**下来，仅作为美术复原/OCR 校验用：

- 卡标题：**`重要通知`**（超大号黑体，深色 `#1a1a1a`，左对齐，位于卡内左上）
- 正文第 1 段：**`签赋LabelShop如果无法登录，请及时更新到新版本并升级到金牌会员。`**
- 正文第 2 段：**`购买了金牌会员的老用户，请关注会员服务临近到期提醒；到期后将无法登录，请提前续费。`**
  - **推断说明**：截图左边缘被裁（`00-main.png` 的 x=537 处正好切在「签赋LabelShop」的「签」字左侧），这两段的首字是根据上下文与「…abelShop如果无法登录…」「…了金牌会员的老用户…」的残字补全的。**「签赋」与「购买」两个字是推断**，其余字形可从截图直接读出。
- 按钮：**`购买点击`**，蓝底（`≈#2F7BE0`）圆角胶囊、白色描边+高光，紫蓝色文字（`≈#2B3FE8`）。
- 卡的正文前 20 字（任务口径）：**`签赋LabelShop如果无法登录，请`**
- 「签赋学堂」卡文字：`签赋学堂`（标题，白色，前有摊开的书本图标）、`免安装Windows驱动`、`打印不干胶标签`（两行白色大字）。
- 大横幅文字：`各类不干胶标签`（超大号描边字）、`整箱下单·更优惠`（描边方框内）、`联系客服即刻购买`（红底白字 + 4 个 `>` 箭头）。
- 横幅内的纸箱图上还有小字 `不干胶标签纸`、`厂家直销`、`MOCK-UP`、`京成云马（北京）科技有限公司`——属图片内容，不必复刻为文本。

---

## 4. 动态内容与数据来源汇总

| 界面元素 | 模板占位符 | 旧版渲染值 | 数据来源 |
|---|---|---|---|
| 头像 | `{$USER_UIMG}` | `<a href="labelshop:UserLogin" title="登录 360Code.com"><img src="http://www.360code.com/images/ymg_peo_pic.jpg"></a>` | 登录态 / 服务端 |
| 用户名 | `{$USER_UNAME}` | `<a href="labelshop:UserLogin" title="登录 360Code.com">未登录</a>` | 登录态 / 服务端 |
| 优惠券数 | `{$USER_COUPON}` | `<a href="labelshop:OpenULogin:http://www.360code.com/member/member_coupon.aspx" title="优惠券"><strong>0</strong>优惠券</a>` | 服务端会员接口（未登录恒为 0） |
| 待支付订单数 | `{$USER_ORDERSP}` | `<a href="labelshop:OpenULogin:http://www.360code.com/member/order_all.aspx" title="待支付订单"><strong>0</strong>待支付订单</a>` | 同上 |
| 待收货订单数 | `{$USER_ORDERSD}` | `<a href="labelshop:OpenULogin:http://www.360code.com/member/order_all.aspx" title="待收货订单"><strong>0</strong>待收货订单</a>` | 同上 |
| 最近文件列表 | `{$HISTORY}` | `<li><a href="LabelShop:OpenDocument:C:\Users\liyan\Downloads\test.lsdx" title="C:\Users\liyan\Downloads\test.lsdx">test</a></li>` | **本地库** `%APPDATA%\LabelShop\LabelShop\RecentFile\RecentFile.db` |
| 最新文章列表 | `{$INTERACTION}` | `InterInfo.tml` 的 5 条 + 内置 1 条 | **本地文件** `InterAction\InterInfo.tml`；也可由服务端刷新 |
| 顶部广告位 | `{$TOPLINK}` | `topTmpl.html` 的 `780pt` 表 | **远程**：`http://file.360code.com/mainpage/*`、`http://down2.360code.com/mainpage/*` |
| 重要通知/签赋学堂/横幅 | 无占位符 | 见 §3.4 | **远程位图**（服务端下发，随活动更换） |
| 「开始」菜单条目 | 无（硬编码） | 见 §2.B-3 | 静态 HTML |
| 客服 QQ / 电话 | 无（硬编码） | 见 §2.B-3 | 静态 HTML |

### 本地数据库表结构（**实测，非推断**）

三个 `.db` 全部是 **SQLite 3**。

**`InterAction\InterAction.db`**（5120 B，采集时 0 行）
```sql
CREATE TABLE config(ID ntext PRIMARY KEY, strValue ntext, intValue int);
CREATE TABLE history(url ntext, title ntext, viewtime ntext);
CREATE INDEX [lf_url] on [history]([url]);
```
- `config` = 启始页的键值配置（0 行）；`history` = 内嵌浏览器已访问 URL 历史（0 行）。

**`RecentFile\RecentFile.db`**（17408 B）
```sql
CREATE TABLE config(ID ntext PRIMARY KEY, strValue ntext, intValue int);
CREATE TABLE RecentFile(id INTEGER PRIMARY KEY AUTOINCREMENT, path ntext, title ntext,
                        user int, updatetime ntext, state int);
CREATE INDEX [lf_path]   on [RecentFile]([path]);
CREATE INDEX [lf_user]   on [RecentFile]([user]);
CREATE INDEX [lf_update] on [RecentFile]([updatetime]);
CREATE TABLE RecentPath(id INTEGER PRIMARY KEY AUTOINCREMENT, path ntext, title ntext,
                        user int, updatetime ntext, state int);
CREATE INDEX [lp_path]   on [RecentPath]([path]);
CREATE INDEX [lp_user]   on [RecentPath]([user]);
CREATE INDEX [lp_update] on [RecentPath]([updatetime]);
CREATE TABLE RecentLabelFormat( /* 同 LabelFormat 26 列 */ ,
                        Printer ntext, updatetime ntext, IsSystemLabel int);
```
- `RecentFile` → **`{$HISTORY}` 的数据源**（`title` 即列表显示文字，`path` 即 `LabelShop:OpenDocument:` 后面的参数）。
- `RecentLabelFormat` 保存最近用过的标签格式 + 打印机（采集时有 1 行 `608053 … Printer=Microsoft Print to PDF … IsSystemLabel=1`）。
- `config` / `RecentPath` 采集时均为 0 行。

**`RecentFile\LocalCache.db`**（13312 B，全部 0 行）
```sql
CREATE TABLE config(ID ntext PRIMARY KEY, strValue ntext, intValue int);
CREATE TABLE Template (ID ntext PRIMARY KEY, Name ntext, Thumb ntext, LABEL ntext, ModifyTime ntext, State int);
CREATE TABLE Template2(ID ntext PRIMARY KEY, Name ntext, Thumb blob,  LABEL blob,  ModifyTime ntext, State int);
CREATE TABLE Picture  (ID ntext PRIMARY KEY, Name ntext, Thumb blob,  RAW blob,   ModifyTime ntext, State int);
CREATE TABLE General  (ID ntext PRIMARY KEY, Name ntext, TEXT ntext,  RAW blob,   ModifyTime ntext, State int);
```
- `Template2` / `Picture` / `General` = 云模板、云图片、云网页的**本地离线缓存**（`Thumb`/`RAW`/`LABEL` 为 blob）。

---

## 5. JS 交互与可观察行为

**结论：三套启始页 HTML 里都没有 `<script>` 标签，没有任何 JavaScript。**
（已对全部 6 个 HTML/TML 文件 grep `<script`，0 命中。）

所有交互都靠 **`href` 自定义协议**交给宿主 `LabelShop.exe` 处理，以及 **CSS `:hover`**：

| 协议 / 形式 | 出现位置 | 宿主应实现的行为 |
|---|---|---|
| `LabelShop:NewDocument` | 开始列表 | 新建标签模板（触发 `文件(F)→新建(N)` 等价动作） |
| `LabelShop:OpenDocument` | 开始列表 | 打开服务器/云端的标签模板 |
| `LabelShop:OpenDocument:<绝对路径>` | `{$HISTORY}` | 直接打开该路径的 `.lsdx` 模板 |
| `LabelShop:OpenLocal` | 开始列表 | 打开本机保存的模板（本地文件对话框） |
| `LabelShop:OpenCodingV` | `开始` 标题行 | 打开「云马通」应用首页 |
| `LabelShop:OpenULogin:<URL>` | 标签商城、新手入门、券/订单 3 格、顶部广告 | **要求先登录**再打开该 URL（未登录先弹登录框） |
| `labelshop:OpenULogin:<URL>` | 同上（旧版模板用小写 `labelshop:`） | 同 `LabelShop:OpenULogin:`（**大小写不敏感**） |
| `LabelShop:OpenUrl:<URL>` / `labelshop:OpenUrl:<URL>` | 最新文章、下载云马通APP、预览版下载 | 直接用默认浏览器/内嵌浏览器打开该 URL |
| `labelshop:UserLogin` | 头像、`未登录` | 弹出登录对话框 |
| `http://wpa.qq.com/msgrd?v=3&uin=<QQ>&site=qq&menu=yes` | 客服 1/2（新版为「在线客服」） | 唤起 QQ 临时会话（外部协议，非 LabelShop 协议） |
| `#` | `客服电话：4000-987-360` | 空锚点，**无跳转**（不产生任何动作） |

其它可观察交互：

1. **折叠**：`.b37_info h2 span a.hidecontent{color:#858e9f;}` 这个类名（`hidecontent` = 隐藏内容）表明 `开始` / `最近` 的标题**预期支持点击折叠/展开**其下方 `b37_info_main`。**推断**：折叠行为由宿主在页面上注入脚本或由 CSS 类切换实现；HTML 本身没有该项的 JS，也没有任何元素带 `class="hidecontent"`。
2. **`:hover` 反馈**（纯 CSS，可观察）：列表项 hover → 底 `#0099ff`、字 `#FFF`；两个蓝按钮 hover → 底 `#0099ff`、加粗；三个计数格 hover → 数字变 `#0099ff`；任意 `a:hover` → `color:#0099ff`（全局规则，行 33）。
3. **`body{behavior:url(css/iehoverfix.htc)}`**：IE 专有 HTC 行为文件，用于修补 IE6/7 的 `:hover`；**该 `css/` 目录在本机不存在**（`InterAction\` 下只有 7 个文件，无 `css` 子目录），现代内核可忽略。
4. **`<META http-equiv="X-UA-Compatible" content="IE=9" />`**：强制以 IE9 文档模式渲染（原版用 `IWebBrowser2`/MSHTML 宿主）。
5. **滚动**：右侧内容区高度超出可视区时出现竖向滚动条（实测 `00-main.png` x=2544–2565），滚动条为系统样式。

---

## 6. 版本差异对照（`StartPageN.html` vs `defaultTmpl.html`，实现时二选一）

| 区块 | `StartPageN.html`（新版） | `defaultTmpl.html` / `default.html`（旧版，= 截图） |
|---|---|---|
| `css` 目录依赖 | 同 | 同 |
| 单位 | **px** | **pt**（`.sh10`=8pt、左栏 `165pt`、字号 `9pt/10.5pt/12pt/14pt/15pt` 等） |
| `<h1>  LabelShop</h1>` | **有**（32px `#e7168e`） | **无**（只有 CSS 定义） |
| 账户区 `<dl>` | **无** | **有**（头像 / 未登录 / 3 计数格 / 2 按钮） |
| `开始` 标题 | 只有 `开始` | `开始` + `&nbsp;×9` + `<font color="#ff6600">云马通首页</font>`，整行链到 `LabelShop:OpenCodingV` |
| `开始` 列表 | **4 项**（在线客服 / 新建 / 打开 / 打开本机） | **7 项**（客服1QQ / 客服2QQ / 客服电话 / 新建 / 打开 / 打开本机 / 下载云马通APP） |
| `最近` 列表 | 空（20 个 `<br>`） | `{$HISTORY}`，实测渲染出 `test` |
| 顶部广告位 | **无** | `{$TOPLINK}` + `780pt` 表 + `.tdimg/.tdimgs` 规则 |
| 最新文章 | `<h2>最新文章</h2>` + 写死第 1 条 | `<h2>最新文章</h2>` + `{$INTERACTION}` |
| 云马通二维码/预览版下载块 | **无** | **有** |
| 左栏宽 | `220px` | `165pt`（≈ 220px，等价） |
| 链接前缀 | `http://…`（标签商城/新手入门） | `labelshop:OpenULogin:http://…` |

**同一新版的姊妹文件差异**：
- `StartPageN.html` vs `MainPageTmplN.html`：**仅 1 处**——`MainPageTmplN.html` 行 129 的 `<ul>` 里是 `{$HISTORY}`，`StartPageN.html` 行 129 是 20 个 `<br>`；`MainPageTmplN.html` 行 142 多一个 `{$INTERACTION}`。其余（含 CSS）逐字节相同（尺寸差 52 B）。

---

## 7. 未能确定 / 需要复核的点（诚实清单）

1. **「重要通知」「签赋学堂」「各类不干胶标签」三张卡的文字无法从本地文件取证**——它们是远程位图，本地 HTML/DB 里没有对应字符串。本规格 §3.4 的文字是从截图**目视读取**的，其中「签赋」（第 1 段首词）与「购买」（第 2 段首词）因截图左边缘裁切属于**推断补全**。要 100% 确认，需要抓取运行时 `{$TOPLINK}` 实际引用的图片 URL，或对 `00-main.png` 做 OCR 复核。
2. **`{$TOPLINK}` 的运行时来源未取证**：`topTmpl.html` 里的 3 个 `src` 与截图画面不匹配，只能**推断**服务端会下发不同的位图 URL。未观察到实际的 HTTP 响应。
3. **折叠行为（`hidecontent`）未观察到实际效果**：没有任何元素带这个类，也没有 JS，无法确认点击 `开始`/`最近` 标题是否真的折叠。
4. **`{$USER_COUPON}` 等 3 个变量在已登录时下发的 HTML 结构未知**：只知道未登录态是 `<a href="…"><strong>0</strong>优惠券</a>`。登录态是否换 URL/加角标，无从取证。
5. **`{$INTERACTION}` 的两条通路谁是实际生效方未确定**：`InterInfo.tml`（本地文件）与「服务端下发」都能产生这段 HTML；`InterAction.db` 的 `history` 表 0 行，无法判定本地缓存是否被使用。
6. **右侧内容区宽度上限未知**：CSS 是 `right:0` 自适应，未观察到原版在窗口最大化/超宽时的表现；`.ymg_c12_info` 的 `padding:35px` 与 `780pt` 表的组合在窄窗口下是否出现横向滚动条，未取证。
7. **`pt` 单位的 px 换算未实测**：§1.3 中「1pt ≈ 1px」是**推断**（依据是顶部位图实测宽 ≈ 745 逻辑 px 与 `780pt` 同量级）。若复刻体用标准 96dpi 换算（`780pt = 1040px`），顶部位图会比原版宽约 30%。
8. **`InterAction\default.html` 的 `</body></html>` 位置异常**：该文件在 `</body></html>`（行 210–211）**之后**还接着 `</div>` 和「最新文章」块（行 213–257）。按 HTML 解析规则这段会落在 `</html>` 之后，但截图里「最新文章」确实显示在底部。**推断**：这是渲染器把模板尾部片段追加进去时的拼接瑕疵，浏览器容错把它补回了 `body` 内。复刻时**不要模仿这个结构**，应把「最新文章」块放在 `</body>` 之前。
9. **客服电话条目的 `href="#"`**：原版点了确实不跳转（空锚点），但**是否另绑定了宿主命令**（例如点击拨号）无法从 HTML 看出，未取证。

---

## 8. 关键常量速查（直接抄用）

```
左栏宽           220px
右栏背景         #f5f5f5        页面背景 #fff
主文字色         #333            次要文字 #858e9f
链接蓝           #4db8ff         链接 hover #0099ff
标题品红         #e7168e         最新文章标题 #333
文章标题蓝       #0099ff         「云马通首页」橙 #ff6600
正文灰           #666            日期灰 #999
分隔线           #e4e6ea         头像边框 #F5EDED
头像             80×80 + 2px 边框，圆角 1000px
两个蓝按钮       宽 40%，高 30px，行高 30px，14px 白字，margin 0 1px
计数格           各 32% 宽，数字 18px 粗体，标签 12px
「开始/最近」标题 16px 粗体 #4db8ff，高 30px，行高 20px，padding 0 20px
列表项           14px #858e9f，高 25px，行高 25px，padding 0 20px
最新文章标题     20px 常规 #333，margin-bottom 20px
文章条目标题     18px #0099ff，border-left 4px solid #0099ff，padding-left 20px
文章正文         14px #666，line-height 20px，padding-left 22px
顶部广告表宽     780pt（小图 390pt ×2 + 大图 780pt）
```
