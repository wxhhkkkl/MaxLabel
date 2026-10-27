# Contract: 更新 IPC（main ↔ renderer）

**Version**: 1 | **Feature**: `018-online-update` | **Date**: 2026-10-27

所有通道只允许主窗口渲染进程调用；沿用现有 `senderGuard`（已知通道 + 可信 sender）。渲染层不接触 `electron-updater`、文件系统或安装器。

## 1. 通道一览

| 方向 | 通道 | 类型 | 说明 |
|------|------|------|------|
| renderer → main | `update:check` | invoke | 检查最新稳定版本；无参数 |
| renderer → main | `update:download` | invoke | 开始下载已发现的版本；无参数 |
| renderer → main | `update:cancel` | invoke | 取消当前下载 |
| renderer → main | `update:install` | invoke | 安装已下载版本并重启；只在渲染层完成未保存守卫后调用 |
| renderer → main | `update:state` | invoke | 读取当前更新状态（对话框重开/延迟安装） |
| main → renderer | `update:changed` | event | 状态/进度/错误变化 |

Preload 命名空间：

```ts
window.maxlabel.update = {
  check(): Promise<UpdateCheckResultDto>
  download(): Promise<UpdateActionResult>
  cancel(): Promise<{ ok: boolean; canceled: boolean }>
  install(): Promise<UpdateActionResult>
  state(): Promise<UpdateStateDto>
  onChanged(callback: (state: UpdateStateDto) => void): () => void
}
```

## 2. `update:check`

**请求**：无参数。**响应**：

```ts
interface UpdateCheckResultDto {
  status: 'update' | 'latest' | 'unavailable'
  current: string
  latest?: string
  notes?: string
  releaseDate?: string
  message?: string
  messageKey?: string
}
```

规则：
- 只比较稳定数字版本；`latest <= current` 返回 `latest`，不提供降级。
- 网络/feed 解析失败返回 `unavailable`，不抛到渲染层。
- 启动检查调用方按 `updateCheckOnStartup` 决定是否调用；失败静默。
- 手动检查始终允许调用；`unavailable` 必须展示 `message`/`messageKey`。
- 与已有检查重叠时复用同一状态机；不并发开第二个检查。

## 3. `update:download`

**请求**：无参数。**响应**：

```ts
interface UpdateActionResult {
  ok: boolean
  error?: string
  messageKey?: string
}
```

规则：
- 仅 `state='available'` 时接受；其他状态返回 `ok=false`（幂等：下载中/已下载直接返回成功或“进行中”）。
- 不接收 URL、文件名、路径等参数；下载地址只来自固定 feed。
- 开始后状态进入 `downloading`，通过 `update:changed` 推送进度。
- 重复调用不得启动第二个下载。

## 4. `update:cancel`

**请求**：无参数。**响应**：

```ts
{ ok: boolean; canceled: boolean }
```

- 仅 `downloading` 时有意义；取消后状态回到 `available`。
- 取消不得执行安装；残留缓存由 electron-updater 管理，可在下次下载时复用/清理。

## 5. `update:install`

**请求**：无参数。**响应**：`UpdateActionResult`。

规则：
- 仅 `state='ready'` 时接受；其他状态返回 `ok=false`。
- 调用方（渲染层）必须先完成 `hasRunningOperation` 检查与 `closeAll` 未保存确认；主进程不重复实现文档保存。
- 主进程设置 `allowMainWindowClose=true`，调用 `quitAndInstall`；失败时恢复该标志并返回错误。
- 重复调用：已进入 `installing` 时返回“进行中”，不重复退出。
- 安装前不得再次下载或切换版本。

## 6. `update:state`

**响应**：

```ts
interface UpdateStateDto {
  state: 'idle' | 'checking' | 'available' | 'latest' | 'downloading' | 'ready' | 'installing' | 'error'
  current: string
  latest?: string
  notes?: string
  releaseDate?: string
  progress?: {
    percent: number
    transferred: number
    total: number
    bytesPerSecond: number
  }
  error?: string
  messageKey?: string
}
```

- 用于对话框重新打开、延迟安装、渲染层刷新后恢复状态。
- 不含安装包路径、feed 凭据或任何敏感信息。

## 7. `update:changed` 事件

- 负载同 `UpdateStateDto`。
- 状态变化必发；下载进度按约 250ms 节流，避免 IPC 洪水。
- 主窗口未就绪时缓存最新状态；渲染层挂载后通过 `update:state` 拉取。
- 事件只发给主窗口，不广播给商城/帮助/预览等子窗口。

## 8. 错误键

| `messageKey` | 场景 | 启动检查 | 手动检查/对话框 |
|--------------|------|----------|------------------|
| `update.error.network` | 无法连接 feed | 静默 | 显示“检查失败，请检查网络” |
| `update.error.feed` | feed 缺失/格式错误 | 静默 | 显示“更新信息无法识别” |
| `update.error.download` | 下载失败/中断 | — | 显示“下载失败，可重试” |
| `update.error.verify` | SHA-512/来源校验失败 | — | 显示“更新包校验失败，已保留当前版本” |
| `update.error.install` | 安装器启动/权限失败 | — | 显示“安装失败，当前版本仍可用” |
| `update.error.busy` | 打印/预览/导出中或安装中 | — | 显示“当前有任务进行中，请稍后重启” |

原始错误字符串可放入 `error` 供诊断，但不得包含凭据、完整 URL 查询参数或用户数据。

## 9. 安全与生命周期

- 通道必须加入 `IPC_CHANNELS` 白名单与 `assertKnownIpcChannel`；preload 只暴露上述方法。
- 不接受任意 URL/路径参数；feed 地址由构建配置/非打包测试覆盖决定。
- 安装动作只在主进程执行；渲染层只能请求，不能指定安装器路径或参数。
- 应用退出/窗口关闭时取消进行中的检查/下载；`installing` 是唯一允许主窗口关闭的状态（由主进程设置）。
- 打包构建忽略 `MAXLABEL_UPDATE_URL` 等测试覆盖；非打包构建可用测试适配器模拟状态。
