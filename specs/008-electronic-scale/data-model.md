# Data Model: Electronic Scale Weight Capture

**Feature**: `008-electronic-scale` | **Date**: 2026-10-20

## ScaleConfig

Persisted inside a keyboard data source in the template. Existing fields; no template
version change is required because all fields already normalize today.

| Field | Type | Rules |
|-------|------|-------|
| `inputDevice` | `'keyboard' \| 'weigh'` | Default `keyboard`. `weigh` activates serial capture. |
| `weighProtocol` | `'kasda' \| 'tonde' \| 'ad' \| 'mettler' \| 'ohaus' \| 'sartorius' \| 'standard' \| 'custom'` | Unknown → `kasda`. |
| `weighPort` | string | 1–32 chars, trimmed; e.g. `COM3`. Empty → clear error at read time (no hidden default). |
| `weighBaud` | string | `2400`, `4800`, `9600`, `19200`, `38400`; unknown → `9600`. |
| `weighUnit` | `'g' \| 'kg' \| 'lb' \| 'oz' \| 'jin'` | Unknown → `kg`. Target unit when conversion is enabled. |
| `weighDecimals` | integer | 0–4; default 2. |
| `weighAutoPrint` | boolean | Default false. |
| `weighUnitConv` | boolean | Default false; when true, convert the reported unit to `weighUnit`. |

Validation is performed by `normalizeDocument` (existing) and re-checked before a read
(port non-empty, protocol/unit/baud recognized, decimals in range).

## ScaleReading

| Field | Type | Rules |
|-------|------|-------|
| `value` | number | Parsed numeric weight in the reported unit; finite. |
| `unit` | `WeighUnit` | Reported unit (or configured unit if the frame has no unit and conversion is off). |
| `stable` | boolean | True only when the protocol says stable **and** two consecutive frames match. |
| `raw` | string | Original frame text (diagnostics only; never printed). |
| `timestamp` | number | Epoch milliseconds. |
| `status` | `'stable' \| 'unstable' \| 'overload' \| 'underload' \| 'zero' \| 'negative' \| 'malformed'` | Only `stable` is usable for a label. |

Rejected states produce an error result (no reading is injected into the label):
unstable, overload, underload, zero and negative by default; malformed frames are never
partially parsed.

## ScaleProtocolSpec

Static registry entry in `shared/scale/protocols.ts`.

| Field | Type | Rules |
|-------|------|-------|
| `id` | `ScaleProtocol` | One of the eight identifiers. |
| `label` | string | Display name (catalog key or source text). |
| `defaultBaud` | string | Used when the configured baud is empty. |
| `terminator` | string | `\r\n`, `\r`, or byte frame end. |
| `frames` | `FrameSpec[]` | Ordered matchers: regex for text frames or byte-layout for binary frames. |
| `stability` | mapping | Stable/unstable tokens or status-bit masks. |
| `units` | mapping | Frame unit token → `WeighUnit`. |
| `fallback` | boolean | Only `custom` uses the tolerant parser. |

Frame specs are documented in [contracts/scale-protocols.md](./contracts/scale-protocols.md).

## ScaleReadRequest / ScaleReadResult

IPC-only shapes (not persisted).

```text
ScaleReadRequest {
  requestId: string
  protocol: ScaleProtocol
  port: string
  baud: string
  unit: WeighUnit
  decimals: number
  unitConv: boolean
  timeoutMs?: number        // default 5000, max 30000
}

ScaleReadResult {
  ok: boolean
  reading?: ScaleReading    // only when ok
  message?: string          // raw fallback/diagnostic
  messageKey?: string       // catalog key for the UI
  messageParams?: Record<string, string | number>
  canceled?: boolean
}
```

## DataSourceContext extension

```text
DataSourceContext {
  ...existing fields
  scaleValues?: Record<string, string[]>   // label name -> formatted value per labelIndex
}
```

Resolution order for a keyboard source:

1. If `inputDevice === 'weigh'` and `scaleValues[label]` exists, return
   `scaleValues[label][labelIndex - 1]` (empty string if the index is missing — the print
   job fails validation instead of printing an empty weight).
2. Otherwise return the existing `keyboardValues[label]`.

The value is already formatted with the target unit/decimals; it is a plain string and is
language-independent.

## Read lifecycle (main process)

```text
idle --read--> opening --open--> reading --stable--> result(ok)
                   |                 |
                   |                 +--timeout/cancel--> close --> result(error/canceled)
                   +--open error-------------------------> result(error)
```

- One active read per process; concurrent requests are serialized (queue) or rejected with
  a busy error.
- `close` runs in `finally`; cancel aborts the in-flight read and closes the port.
- No stale reading is cached between labels or jobs.

## Print integration

- **Manual print**: the renderer reads one stable value per logical label before building
  the print context; `scaleValues` is passed through `createPrintContext`.
- **Preview**: one sample stable read is used for the preview; it does not consume the
  values reserved for printing.
- **Command export**: uses the same per-label resolution as print.
- **Auto-print**: loop reads stable → invokes the normal print action for one label →
  repeats until stopped; cancel/stop releases the port.
- Logging, serial-number advancement and print plans are unchanged except for the injected
  value.
