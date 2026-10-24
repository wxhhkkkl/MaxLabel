# Contract: Entitlement IPC

**Feature**: `017-start-page-license-gating` | **Date**: 2026-10-22

本契约新增主进程 → 渲染层的授权状态通道。所有通道名进入 `shared/ipcContract.ts` 的 `IPC_CHANNELS` 白名单；payload 由主进程校验；只有主窗口（`assertTrustedRenderer`）可调用。

## Channels

### `entitlement:status`

**Direction**: renderer → main（invoke）
**Args**: 无
**Returns**:

```ts
type EntitlementStatusResult =
  | { ok: true; state: EntitlementState }
  | { ok: false; error: string; messageKey?: string }
```

**Semantics**
- 返回当前授权快照；主进程负责读取会员订阅与加密狗状态，不信任渲染层输入。
- 启动时、登录/续费后、加密狗插拔后都应返回最新状态。
- 读取失败时返回 `ok:false`；渲染层按只读处理并显示可重试错误。

### `entitlement:changed`

**Direction**: main → renderer（webContents.send）
**Payload**: `EntitlementState`

**Semantics**
- 仅当状态实际变化时发送（订阅、版本、到期、加密狗插拔）。
- 渲染层收到后整体替换本地快照；不得与本地旧状态合并。
- 窗口重载后以 `entitlement:status` 为准；事件不保证重放。

## Preload facade

```ts
interface MaxLabelAPI {
  entitlement: {
    status(): Promise<EntitlementStatusResult>
    onChanged(callback: (state: EntitlementState) => void): () => void
  }
}
```

`onChanged` 返回取消订阅函数；不得暴露 `ipcRenderer` 本身。

## Types

```ts
type Edition = 'none' | 'standard' | 'professional' | 'enterprise'

type FeatureKey =
  | 'editDocuments' | 'print'
  | 'databaseSources' | 'batchDataSources' | 'printHistory'
  | 'cloudTemplates' | 'scripts' | 'scaleAutoPrint'
  | 'rfidObjects' | 'extendedBarcodeTypes'

interface DongleState {
  present: boolean
  valid: boolean
  reason?: 'absent' | 'unwritten' | 'expired' | 'unreadable' | 'rejected' | 'unsupported'
  identifierMasked?: string
  checkedAt: string
}

interface EntitlementState {
  editable: boolean
  edition: Edition
  editionLabel: string
  source: 'none' | 'member' | 'dongle' | 'member+dongle'
  features: Record<FeatureKey, boolean>
  subscriptionActive: boolean
  expiresAt?: string | null
  offline: boolean
  dongle: DongleState
  checkedAt: string
}
```

## Invariants（主进程与渲染层都必须成立）

1. `state.editable === state.features.editDocuments`。
2. `state.features.print === true`（只读也允许打印）。
3. `state.dongle.valid === true` → `state.source` 包含 `dongle`，且所有 `features` 为 `true`。
4. `state.source === 'none'` → `state.editable === false`。
5. 离线快照仅在 `now < expiresAt` 时生效；否则按 `none` 处理。
6. 渲染层不得通过任何参数提交/覆盖 `editable`、`edition`、`features`。

## Main-process enforcement

除 UI 守卫外，以下主进程入口在 `editable === false` 时必须拒绝并返回可见错误：

- `template:save`
- `template:saveTo`
- `template:saveToLib`
- `mall:template-save`（保存/更新云模板）
- `mall:template-share` / `mall:template-unshare`（上传/取消共享）
- 其它会写入用户模板或云端模板的 IPC

允许：`template:open`、`template:openPath`、`mall:template-load`、`mall:shared-load`、打印与预览（打印不推进序列号、不自动保存）。

错误形状沿用现有 `IpcErrorFields`：

```ts
{ ok: false, error: '当前为只读状态：请登录有效会员或插入授权加密狗', messageKey: 'error.entitlementReadOnly' }
```

## Test obligations

- 通道名唯一、以 `entitlement:` 命名、进入白名单（契约测试）。
- 非主窗口调用被拒绝（`assertTrustedRenderer`）。
- `status` 在会员/加密狗组合下返回正确矩阵（集成测试）。
- `changed` 只在状态变化时发送（集成测试）。
- 只读时保存类 IPC 全部拒绝；打开/加载/打印 IPC 不受影响（集成测试）。
- 网络失败时保留最近一次成功凭据与快照；只有 401 清除（集成测试）。
- 授权失效（到期/拔狗）时，渲染层保留全部标签页与未保存内容并转只读（e2e）。
