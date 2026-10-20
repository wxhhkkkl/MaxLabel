# Contract: Scale IPC

**Feature**: `008-electronic-scale` | **Date**: 2026-10-20

## Channels (additive)

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `scale:read` | renderer → main | Open the configured port, read frames until a stable value or timeout. |
| `scale:test` | renderer → main | Open the port, read a short window and return diagnostics (raw frames, parsed status) without printing. |
| `scale:cancel` | renderer → main | Cancel the active read and release the port. |

Existing channels and payloads are unchanged.

## `scale:read` payload

```ts
{
  requestId: string                 // caller-generated, 1–128 chars
  protocol: 'kasda' | 'tonde' | 'ad' | 'mettler' | 'ohaus' | 'sartorius' | 'standard' | 'custom'
  port: string                      // e.g. COM3; trimmed, 1–32 chars
  baud: string                      // 2400/4800/9600/19200/38400
  unit: 'g' | 'kg' | 'lb' | 'oz' | 'jin'
  decimals: number                  // 0–4
  unitConv: boolean
  timeoutMs?: number                // default 5000, 1–30000
}
```

Validation:

- Unknown protocol/unit/baud/decimals → normalize or reject with `error.invalidPayload`.
- `port` must not be empty and must match a serial-port shape (`COM\d+` on Windows,
  `/dev/tty*` or `/dev/cu.*` on macOS/Linux). No shell interpolation.
- At most one active read; a second request while reading returns `busy` with
  `error.scaleBusy` (the renderer serializes reads anyway).

## `scale:read` result

```ts
{
  ok: boolean
  canceled?: boolean
  reading?: {
    value: number
    unit: 'g' | 'kg' | 'lb' | 'oz' | 'jin'
    stable: true
    raw: string
    timestamp: number
  }
  message?: string                  // raw diagnostic/fallback
  messageKey?: string               // catalog key resolved by the renderer
  messageParams?: Record<string, string | number>
}
```

`reading.value` is the numeric value in the unit reported by the scale. The renderer
applies `weighUnitConv`/`weighDecimals` through the shared `shared/scale/units.ts` module
when building the label string, so conversion/formatting exists in exactly one place and
is unit tested. The raw frame is never printed.

## `scale:test` payload/result

Payload is the same as `scale:read` (without `requestId` requirement).

```ts
{
  ok: boolean
  portOpened: boolean
  frames: string[]                  // up to 10 raw frames, bounded
  stable: boolean
  value?: number
  unit?: string
  message?: string
  messageKey?: string
}
```

The test window is bounded (default 3000 ms) and always closes the port.

## `scale:cancel`

```ts
scale:cancel(requestId: string): { ok: boolean; canceled: boolean }
```

Cancellation is idempotent; an unknown/already-finished request returns
`{ ok: true, canceled: false }`.

## Security / lifecycle

- Serial access stays in the main process; the renderer/preload never import
  `serialport`.
- Payloads are validated before opening a port; no arbitrary command strings, paths or
  shell execution.
- The port is closed in `finally` on success, timeout, error and cancel.
- One active read per process; reads are serialized.
- `scale:test` and `scale:read` share the same transport and cannot run concurrently.

## Error keys

| Key | Meaning |
|-----|---------|
| `error.scalePort` | Port missing/unopenable/busy |
| `error.scaleFrame` | Malformed or unrecognized frame |
| `error.scaleTimeout` | No stable value within the timeout |
| `error.scaleInvalid` | Overload/underload/zero/negative/unstable |
| `error.scaleCustom` | Custom frame not unambiguous |
| `error.scaleBusy` | Another read is in progress |
| `error.invalidPayload` | Invalid request fields |

The renderer resolves these with `localizeIpcMessage(language, result)` and falls back to
`result.message`; raw keys are never shown.

## Preload facade

```ts
window.maxlabel.scale = {
  read(payload: ScaleReadRequest): Promise<ScaleReadResult>
  test(payload: ScaleTestRequest): Promise<ScaleTestResult>
  cancel(requestId: string): Promise<{ ok: boolean; canceled: boolean }>
}
```

Channel names are added to `IPC_CHANNELS` in `shared/ipcContract.ts`; the preload
whitelists only these three methods.
