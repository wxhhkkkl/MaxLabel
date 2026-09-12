# MaxLabel 架构

## 当前依赖方向

```text
renderer features ──► application workflow ──► shared domain
       │                                         │
       └────────► Fabric rendering adapter       └──► ResolvedPrintScene
                                                        │
                           TSPL / ZPL / CPCL ◄───────────┘

preload IPC facade ──► main IPC registrations ──► infrastructure services
```

## 统一打印流水线

`LabelDoc + DataCtx` 首先通过 `resolvePrintScene` 生成 `ResolvedPrintScene`。这个阶段负责：

- 展开组合对象；
- 过滤隐藏对象和 `suppressPrint`；
- 解析数据库、序列号、键盘输入和脚本数据源；
- 绑定预渲染单色位图；
- 固化标签序号和份数。

协议适配器只能消费已经解析的场景，不再直接执行数据源。正式打印和指令导出使用 `buildResolvedCommands`；`buildCommands` 仅保留给旧调用方和回归夹具的兼容包装。拼版偏移已经在页面场景中落实，Fabric 与原生打印机语言适配器消费同一套物理坐标。

## UI 边界

- `features/workspace/useDocumentWorkspace.ts`：文档标签页、独立路径、revision 与 dirty 状态。
- `features/workspace/useDocumentHistory.ts`：按文档隔离的撤销/重做历史。
- `features/commands/useLabelShopShortcuts.ts`：LabelShop 快捷键唯一入口。
- `features/commands/labelShopMenus.ts`：菜单、右键菜单与快捷键共用的命令模型，只负责把 UI 状态映射到已有编辑动作。
- `features/editor/operations.ts`：对齐、尺寸、排列、组合等纯编辑命令。
- `features/editor/useEditorTransformCommands.ts`：将 Fabric/React 选择状态接到统一编辑操作，避免 `App.tsx` 维护第二套变换逻辑。
- `features/printing/printJob.ts`：打印上下文、数据快照和序列号提交。
- `features/printing/printExecutor.ts`：打印应用服务；驱动打印与 TSPL/ZPL/CPCL 共享 `PrintPlan`，UI 不再编排协议细节。
- `features/canvas/syncFromFabric.ts`：Fabric 变换到毫米模型的适配器。
- `features/object-properties`：属性页结构和几何草稿状态。
- `features/shell/useViewPreferences.ts`：主题与面板可见性。
- `features/shell/useLicenseStartup.ts`：启动授权复查，不阻塞离线编辑。
- `features/printing/usePrintWorkflow.ts`、`usePreviewWorkflow.ts`、`useCommandExportWorkflow.ts`：分别管理打印、预览和指令导出的任务生命周期、代次守卫与取消。
- `features/printing/printJobJournal.ts`：记录跨进程存活周期的打印任务状态、已发送批次和序列号提交结果；启动时提示未确认任务。
- `features/workspace/useRecentTemplates.ts`：最近模板的本地持久化、按规范化路径去重和容量限制。
- `App.tsx`：组合根，保留文档状态与 LabelShop 命令绑定；打印/预览/导出业务算法不得回流到组件。

## 主进程边界

- `main/index.ts`：主窗口、预览窗口、条码导出和应用生命周期。
- `main/ipc/registerPrintIpc.ts`：打印机枚举、系统驱动打印和原生指令入口。
- `main/printing/commandTransport.ts`：TCP、串口等传输适配器。
- `main/ipc/registerTemplateIpc.ts`、`registerLogIpc.ts`、`registerFileIpc.ts`：模板、日志和文件边界。
- `main/ipc/registerServiceIpc.ts`：云端、单一产品授权、数据库和共享模板 IPC。
- `main/ipc/validation.ts`：IPC 运行时载荷、文件大小、路径扩展名、打印端口和数据库配置校验。
- `main/ipc/pathAccess.ts`：系统文件对话框产生的路径能力记录；renderer 不能凭路径字符串直接读取本机图片或覆盖模板。
- `main/cloud.ts`、`main/sharedLibrary.ts`：单一版本云/共享模板库；索引与模板正文分离保存，旧版内嵌 JSON 首次读取时原子迁移。
- `main/secureJsonStore.ts`、`main/connectionSecrets.ts`、`main/cloudCredentials.ts`：统一使用 Electron `safeStorage` 和原子 JSON 持久化保存数据库密码、云端令牌，文档文件与云端模板只保存非敏感连接配置。

## 产品版本

MaxLabel 只有一个完整版本。授权只判断许可证是否有效，不控制功能集合；云模板、共享模板、数据库、脚本和打印协议不按版本分支。管理员/普通用户只用于云服务管理权限，不影响桌面编辑器能力。

## 迁移约束

1. 每个迁移步骤必须保持 `typecheck`、打印协议回归、渲染回归和生产构建通过。
2. 不允许协议适配器重新调用 `resolveObjectText`。
3. 不允许编辑器维护另一套物理打印几何规则。
4. 设备差异放入 printer profile/capabilities，不在业务组件中按品牌写条件分支。

## 文档与打印计划约束

- `.msdx` 信封与裸 JSON 在进入工作区前必须经过 `migrateDocument` + `normalizeDocument`；未来版本明确拒绝，历史字段只通过显式迁移进入正式模型。
- `PrintPlan` 是记录数量、拷贝数、数据库逐行推进、拼版槽位和起始标签的唯一事实来源；“起始标签”通过首页空槽位表达，不能在驱动打印和原生指令打印中分别实现。
- `buildExecutablePrintPlan` 在基础计划上统一应用字段拷贝和数据查重；预览、系统驱动和原生协议必须消费同一份可执行计划。
- 页面方向（0/90/180/270）、标签尺寸和拼版页面尺寸由共享 `layout`/`ResolvedPrintScene` 统一计算；原生协议不再只旋转编辑器 CSS。
- 云模板通过 `CloudRepository` 选择远程 HTTP 或本地离线实现；账户令牌必须绑定服务器地址，禁止 UI 直接散落调用两套存储逻辑。

## 异步与资源边界

- 预览、打印位图和导出指令都经过统一的异步操作代次守卫；打印任务另有 `AbortController` 和主进程任务 ID，可在发送批次期间取消，旧任务不能回写当前状态。
- 数据库查询带请求 ID，界面关闭、切换或取消打印时会终止对应 ODBC PowerShell 子进程，过期结果不能导入当前文档。
- 所有 renderer→main 的特权 IPC 入口都经过共享通道注册表和主窗口发送方校验；preload 只暴露白名单 API。
- 驱动打印把展开拷贝后的页面集合提交为一个系统打印任务，并使用本地临时 HTML/图片文件避免 Base64 URL 峰值；原生指令打印按批发送，并在日志中记录已发送数量和部分/未知状态。
- 静态图片位图按源文件、几何和 DPI 做有上限的进程内缓存，并在批量渲染中主动让出事件循环，避免大批量标签冻结编辑器。
- 原生指令打印按有限页数分批解析、预渲染和发送，单批次共享同一份 `ResolvedPrintJob`，避免一次性保留整批位图和指令。
- 当 TSPL/ZPL/CPCL 无法等价表达对象旋转、复杂文字样式、填充/颜色、椭圆或未知条码时，整页预渲染为单色位图；若位图未准备好则阻止发送，避免“部分打印但用户以为完整”的隐性错误。RFID 图元仍保留原生写入命令。
- 打印日志使用已解析场景中的实际值快照，不会因日志再次解析日期、时间、脚本或序列号而产生第二份数据。
- 脚本数据源使用受限表达式解释器，仅允许数据绑定所需的变量、字符串/数字表达式、条件和少量字符串方法；不执行任意 JavaScript、动态代码或宿主对象访问。
