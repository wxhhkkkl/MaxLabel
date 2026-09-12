# MaxLabel 全量架构与 LabelShop 行为兼容审计

## 判定原则

1. 文件、编辑、选择、移动、组合、排列、缩放、数据源、预览和打印操作，以仓库内 LabelShop 6.37 中文帮助为行为基准。
2. Web/Electron 实现可以不同，但用户可见的入口、快捷键、对话流程、数据推进和打印结果必须一致。
3. 仅在原行为会导致数据丢失、安全漏洞，或依赖已淘汰的多文档子窗口模型时采用现代替代；替代不得减少功能。
4. 编辑画布、位图输出和 TSPL/ZPL/CPCL 不允许各自解释模板，统一由 `ResolvedPrintScene` 提供最终场景。

## 当前定型后的模块边界

| 层 | 目录 | 职责 |
| --- | --- | --- |
| Domain | `src/shared/domain/*`, `src/shared/model.ts`, `src/shared/table.ts` | 标签文档、对象、数据源和打印机语义，不访问浏览器或 Electron；`model.ts` 仅作兼容出口 |
| Print scene | `src/shared/print/scene.ts`, `layout.ts` | 数据绑定、对象展平、可见性、拼版、最终打印几何 |
| Protocol adapters | `src/shared/print/tspl.ts`, `zpl.ts`, `cpcl.ts` | 只把 resolved scene 翻译为打印机语言 |
| Renderer adapters | `src/renderer/src/rendering` | 把同一场景翻译为 Fabric/Canvas |
| Application | `src/renderer/src/features` | 文档会话、历史、视图偏好、编辑命令 |
| UI | `editor`, `dialogs`, `pages` | LabelShop 操作外观与交互，不承载打印规则 |
| Desktop adapters | `src/main/ipc` | 文件、日志、模板、服务 IPC |
| Preload contract | `src/shared/ipcContract.ts` | 主进程和 renderer 的唯一 API 类型来源 |

## 已核对并修正的高风险逻辑

- 多文档保存路径由全局状态改为标签页会话状态，切换标签后不会覆盖错误文件。
- 撤销和重做改为按文档 key 隔离，禁止跨文档恢复状态。
- 所有文档变更统一产生未保存标记，标签标题显示 `*`。
- 关闭标签、关闭全部、菜单退出和窗口关闭统一执行“保存 / 不保存 / 取消”流程。
- 打开、最近文件、模板库、云模板和企业模板统一走文档 codec；不再因入口不同而丢失备注、方向、键盘顺序、颜色索引等字段。
- 文档 codec 拒绝非法尺寸和异常对象数量，旧裸 JSON 与 MSDX 信封继续兼容。
- LabelShop 文件只读导入，首次保存转为 MSDX，避免破坏原文件。
- 模板库删除使用规范化路径边界校验，不能利用相似目录前缀删除库外文件。
- 串口 PowerShell 参数已转义，外部链接仅允许 HTTP/HTTPS。
- 嵌套组合由模型、Fabric 和打印场景递归处理，不再人为禁止。

## LabelShop 操作习惯对照

| 操作 | 兼容行为 |
| --- | --- |
| Ctrl+N/O/S/P/W | 新建、打开、保存、打印、关闭当前标签 |
| Ctrl+Z/Y | 当前文档独立撤销/恢复 |
| Ctrl+A/T、Tab | 全选、循环选择对象 |
| Ctrl+C/V/X、Shift+Delete、Delete | 复制、粘贴、剪切和删除 |
| Alt+Enter | 打开当前对象属性 |
| Ctrl+G/U/L/B | 组合、取消组合、锁定、移到底层 |
| 方向键 | 0.5 mm 微移；Shift 为 5 mm 快移 |
| Ctrl++/-、Ctrl+Alt+0 | 放大、缩小、撑满工作区 |
| 空格拖动 | 平移标签工作区 |
| 双击对象 | 打开对象属性相应页面 |
| 工具拖放 | 文字、条码、线、矩形、图片等按拖动区域创建 |
| 关闭未保存文档 | 保存 / 不保存 / 取消，取消必须终止整个关闭动作 |
| 打印后序列号 | 按实际标签数推进，并在已有保存路径时回写当前模板 |
| 多标签拼版 | 预览、位图和原生指令共享行列、间距、顺序、起点和偏移 |

## 有意保留的实现差异

- LabelShop 的 MDI“新建窗口/层叠/平铺/排列图标”在 Electron 中由文档标签页替代。这些窗口排列命令保留为不可用菜单项，用来维持菜单肌肉记忆，但不复制已经淘汰的子窗口管理。
- 系统剪贴板中的任意 LabelShop 私有二进制对象格式无法在没有格式规范的情况下可靠互通；MaxLabel 内部对象复制粘贴和图片剪贴板输出保持可用。

## 不能由代码仓库单独验收的边界

- TSPL/ZPL/CPCL 固件方言、中文内建字体、RFID、切刀、回卷、状态回读必须使用目标打印机矩阵实测。
- 电子秤、读卡器等外设必须有协议文档和设备，配置界面不能替代采集驱动。
- LabelShop 私有 LSDX 中尚未采集到的对象/变量编码只能在取得真实样本后补充映射；导入器必须明确告警，不允许静默丢弃。
- 云标签库和许可证的生产部署必须使用 `server` 服务；本地共享模板库只是离线存储，不作为远程权限或安全边界。

## 验收门槛

- `npm run typecheck`
- `npm run test:print`
- `npm run test:render`
- `npm run build`
- `npm run dist`
- 每种目标机型按 `native-protocol-validation.md` 留存原始指令、打印照片、DPI、固件和偏移测量结果。
