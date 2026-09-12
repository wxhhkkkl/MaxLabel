# MaxLabel

兼容「签赋 LabelShop」操作习惯的桌面端条码标签设计打印软件。

- **形态**：桌面优先（Electron + React + Fabric.js）
- **产品版本**：单一完整版本，脚本、ODBC、打印日志、云模板和共享模板均为标准功能
- **定位**：可安装、可授权、可连接云服务的完整桌面产品

## 界面布局（对标 LabelShop 原版截图）

按 LabelShop 真实界面与中文帮助重构 UI 布局和操作流程：

- **菜单栏**：文件(F) / 编辑(E) / 查看(V) / 工具(T) / 排列(A) / 数据库(D) / 账户(A) / 云马通(C) / 选项(O) / 窗口(W) / 帮助(H) / 建议与反馈（含二级子菜单、分隔线、禁用项）
- **标签页**：固定「起始页」+ 可关闭的文档标签，多文档并行编辑，每个标签页独立持有文档/选中/数量/缩放/数据集
- **工具栏**：撤销/重做、文字、条码、RFID、矩形、椭圆、表格、直线、图片、删除、打印机设置、数据、导出条码、云模板、激活、预览、测试打印
- **左侧**：图层面板（对象列表、可见性、上移/下移、删除、隐藏计数），默认图层
- **中央**：带毫米双轴标尺（水平 + 垂直）的编辑画布，网格开关、缩放（50%–400%）
- **右侧打印面板**：参数设置 / 打印服务器 / 帮助 三页签 + 输入数据（管理）+ 打印机（设置）+ 打印数量 / 单签拷贝 + 打印预览 / 测试打印 / 打印
- **底部状态栏**：打印机（指令集 @ dpi）| 标签规格（宽×高 mm）| 数据库状态 | 鼠标坐标（mm）| 缩放 %
- **启动页**：账户/优惠券/待支付/待收货、标签商城、新手入门、开始（新建/打开/本机/云马通/授权激活）、客服、最近模板、欢迎卡片、最新文章
- **选择标签格式弹窗**：预设规格网格预览、打印机枚举、标签品牌/类型/名称、纸张与标签尺寸、选择/自定义/取消

## 已实现功能

### 编辑器
- ✅ 所见即所得标签编辑器（毫米坐标系，网格辅助，拖拽 / 缩放 / 旋转 / 多选）
- ✅ 对象：文字（含弧形、打印机内建字体）、条码、RFID、图片、矩形、直线、椭圆、表格
- ✅ 属性面板：内容、字号、字体、颜色、码制、位置 / 尺寸 / 旋转（mm 精确）、格式化（大写/小写/首字母）、子串截取
- ✅ 标签尺寸设置（宽 × 高 mm）

### 码制（bwip-js）
- ✅ 一维：Code128、EAN-13、EAN-8、UPC-A、UPC-E、Code39、Code93、Codabar、Interleaved2of5、ITF-14、Matrix25、GS1 DataBar
- ✅ 二维：QR、DataMatrix、PDF417、汉信码（hanxin）
- ⚠️ 中国邮政码：bwip-js 未内置，待自研或走打印机内建条码

### 数据源（7 类，对标原版）
- ✅ 常量 / 序列号（前缀/起始/步长/位数/重复，打印后自动推进并支持回写）/ 日期 / 时间 / 数据库字段 / 键盘输入 / 脚本
- ✅ 脚本：JS（对标 VBScript 生命周期：OnBeginPrint / OnGetData / V_PAGE / V_ROW / V_LABELNO / V_TOTALLABELS / V_TITLE / V_PRINTER + 命名共享变量）
- ✅ 对象级格式化 + 子串截取

### 数据库
- ✅ 本地：CSV / 制表符分隔文本 / Excel（xlsx）
- ✅ ODBC / SQL：SQL Server / MySQL / SQLite / 已有 DSN；测试连接、查询导入数据集、打印前自动刷新（数据库直连模式）
- ✅ 多连接管理，连接随模板保存

### 打印
- ✅ 图形驱动打印：按标签 mm 尺寸走 Windows 打印机驱动（弹打印对话框）
- ✅ 指令直连打印：TSPL / ZPL / CPCL 三套指令引擎（203/300/600 dpi 自动换算）
- ✅ 打印机属性（随模板保存）：速度、浓度、热敏/热转印、标签类型（间隔/连续/标记）、顶部偏移、介质处理（撕纸/剥离/切纸）、出纸回退
- ✅ 端口：打印到文件（指令文件）/ TCP-IP / COM 串口 / 蓝牙 SPP / USB 虚拟串口 / Windows 驱动
- ✅ 指令编码：UTF-8 / GBK（GB18030，iconv-lite）
- ✅ 批量可变打印：打印数量 × 单签拷贝，序列号 / 数据库记录逐张推进
- ✅ 图片 / 中文 / 弧形文字指令化：TSPL PUTBMP、ZPL ^GFA（逐张可变位图，含 BMP 文件头）
- ✅ 打印机内建字体（TSPL Font0-8 / ZPL A-Z,0）
- ✅ RFID 对象：EPC / USER / TID 区写入 + 锁定（TSPL RFID;EPC、ZPL ^RFW/^RFL）
- ✅ 测试打印：1 张，不计日志、不推进序列号
- ✅ 本地打印日志：JSONL 落盘 userData/print-log.jsonl

### 模板与分发
- ✅ 模板保存 / 打开（本地 JSON，含对象、打印机配置、数据集、数据库连接）
- ✅ 云端模板：登录 / 注册 / 保存到云端用户库 / 加载 / 删除（未配置服务时支持本地离线存储）
- ✅ 共享模板库：发布、加载和删除，属于单一版本标准功能

### 分发与授权
- ✅ 单一产品授权：在线密钥校验、机器绑定和本地授权缓存，不区分功能版本
- ✅ 打包分发：electron-builder NSIS 安装包（`npm run dist`）

### 真机兼容
- ✅ 真机兼容矩阵（厂商公开 SDK/文档）：佳博 / 汉印 / 芯烨 / 得力 / 启锐 / Zebra / TSC + 未收录兜底
- ✅ 按品牌推荐指令集 + 生成真机验证清单（复制到剪贴板）

## 如何运行

```bash
cd app
npm install        # 首次；若 Electron 二进制下载失败，先执行：
                   #   set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm run dev        # 开发模式（热更新）
npm run build      # 生产构建，产物输出到 out/
npm run typecheck  # 类型检查
npm run test:print # 指令引擎 / 授权 / ODBC / 兼容矩阵单测
npm run dist       # 打包 NSIS 安装包（release/MaxLabel-Setup-*.exe）
```

## 目录结构

```
app/
├─ src/shared/            共享模块（主进程 / 渲染层 / 单测共用）
│  ├─ domain/             按领域拆分的文档、对象、数据源、打印机与单位模型
│  ├─ model.ts            旧调用方兼容出口（转发至 domain/）
│  └─ print/              指令打印引擎（纯 TS，可单测）
│     ├─ geometry.ts      毫米 ↔ 点阵换算
│     ├─ bitmap.ts        单色 BMP / ZPL ^GFA 位图编码
│     ├─ tspl.ts / zpl.ts / cpcl.ts  三套指令生成
│     ├─ engine.ts        批量指令组装入口（文本 + 二进制分段）
│     └─ compat.ts        打印机真机兼容矩阵 / 推荐 / 验证清单
├─ src/main/              Electron 主进程
│  ├─ index.ts            窗口、打印、模板、导出、串口、端口枚举 IPC
│  ├─ cloud.ts            云端模板（本地离线存储适配）
│  ├─ ipc/                 文件、模板、打印、服务 IPC 与载荷校验
│  ├─ printing/            TCP / 串口等指令传输适配器
│  ├─ license.ts           授权激活（机器绑定 + 服务端校验）
│  ├─ db.ts               ODBC / SQL 查询（PowerShell System.Data.Odbc）
│  └─ sharedLibrary.ts    共享模板库
├─ src/preload/           预加载脚本（contextBridge 安全暴露 IPC）
├─ src/renderer/          渲染层（React + Vite）
│  ├─ App.tsx             主界面组合根（多标签页与 UI 连接）
│  ├─ features/           工作区、编辑命令、打印应用服务、菜单模型与 shell 状态
│  ├─ editor/             MenuBar / TabStrip / Toolbar / LayerPanel / WorkArea(标尺缩放) /
│  │                      LabelEditor / PropertyPanel / StatusBar / PrintDock / barcode / dataImport
│  ├─ pages/              StartPage（启动页）
│  ├─ print/              renderLabel（图形渲染）/ bitmapSource（位图源）
│  └─ dialogs/            NewLabelDialog / PrinterSettings / DataPanel / ExportModal / CloudDialog /
│                         LicenseDialog / TemplateLibDialog / KeyboardInput / OptionsDialog /
│                         AboutDialog / Preview
├─ scripts/               单测脚本（print-engine.test.ts）
├─ docs/labelshop-help-zh/ 签赋 LabelShop 中文帮助文档（开发参考）
├─ out/                   构建产物
└─ release/               打包产物（win-unpacked / NSIS 安装包）
```

## 打印分流

- **驱动打印**：`printer.port.type === 'driver'` → 按当前打印机 DPI 渲染标签 → `webContents.print` 走系统驱动
- **指令直连**：TSPL / ZPL / CPCL 生成指令 → 文本 + 二进制分段 → 文件 / TCP / COM / 蓝牙 / USB 发送
- **测试打印**：1×1，不写日志、不推进序列号

## 打印机适配机制（对标原版）

原版通过「指令集 × 端口 × 分辨率 × 打印机属性」四维组合适配市面上大多数标签打印机，本复刻沿用：

| 维度 | 实现 |
|---|---|
| 指令集引擎 | TSPL / ZPL / CPCL，未收录品牌先试这三套（与原版同策略，不保证 100%） |
| 端口 | 文件 / TCP / COM / 蓝牙 / USB 虚拟串口 / Windows 驱动 |
| 分辨率 | 203 / 300 / 600 dpi，毫米 → 点阵自动换算 |
| 打印机属性 | 速度、浓度、热敏/热转印、标签类型、顶部偏移、介质处理、出纸回退，随模板保存 |
| 指令编码 | UTF-8 / GBK（GB18030） |
| 图片/中文 | TSPL PUTBMP、ZPL ^GFA 位图嵌入（真机可验证前请用"打印到文件"核对） |

## 已验证

- ✅ `npm run typecheck`：主进程 + 渲染层全部通过
- ✅ `npm run test:print`：指令引擎 / 位图 / RFID / 授权密钥 / ODBC 连接串 / 兼容矩阵全部通过
- ✅ `npm run build`：生产构建成功
- ✅ `npm run dev` / 打包版冒烟：窗口正常启动，渲染无报错
- ✅ UI 布局对照原版截图逐项核验：启动页、选择标签格式弹窗、多标签页、菜单、双轴标尺、图层/属性/打印面板、状态栏均对标（经 CDP 截屏验证）
- ✅ `npm run dist`：生成 NSIS 安装包（约 93MB，未签名；生产发售需代码签名证书）
- ✅ 数据库连接密码和云端令牌使用系统安全存储，不写入模板文件或云端模板 JSON

## 已知边界

- 指令打印输出依赖真机验证；"打印到文件" / "TCP 发送"无硬件即可验证链路。
- 原版脚本为 VBScript；复刻只提供数据绑定所需的安全表达式子集，不执行任意 JS，也不承诺逐字兼容全部脚本。
- 汉信码、Matrix25 bwip-js 已支持；「中国邮政码」待自研或走打印机内建条码。
- 云模板与授权的生产环境需部署 `server` 服务。
- ODBC 查询依赖本机安装对应驱动（SQL Server / MySQL / SQLite ODBC Driver）。
- 安装包已配置应用图标；正式发售前仍需补充代码签名证书。


## 界面布局（对标 LabelShop 三栏图标化）

- **主工具栏（图标版）**：文件（新建/打开/保存）· 编辑（剪切/复制/粘贴/删除）· 历史（撤销/重做）· 打印区（标签格式设置/打印预览/打印）· 对象工具（选取/条码/文字/线条/斜线/矩形/椭圆/图片/表格/RFID/数据）· 数据库（设置/定位记录/更新/第一/上/下/最后一条）· 显示（放大/缩小/适应宽度/适应高度/撑满窗口）· 帮助主题
- **格式栏（图标版）**：字体/字号（磅↔毫米双向换算）· 粗体/斜体/下划线/反白/颜色 · 文字停靠（居左/居中/居右/撑满）· 组合/取消组合 · 属性
- **对齐栏（图标版）**：对齐（左/顶/右/底/垂直中/水平中）· 旋转（左旋90/180/右旋90）· 尺寸（水平同宽/垂直同高/水平垂直相同）· 居中（相对标签水平/垂直）· 间距（水平/垂直均布）· 顺序（最前/前移/后移/最后）· 位置（贴标签顶部/左侧/右侧/底部）
- **查看(V) 菜单**：工具栏/格式栏/对齐栏/状态栏 均可显隐；缩放、标尺、网格开关
- **排列(A) 菜单**：对齐/旋转/统一尺寸/相对标签居中/间距/叠放顺序/移到标签边缘/组合/取消组合（与对齐栏同一套回调）
- 全部图标按钮均真实接线到功能：对象工具点击画布放置（十字光标）、粗体/对齐/组合/取消组合/缩放/预览等均经 CDP 冒烟验证
