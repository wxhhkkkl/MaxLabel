# Quickstart: Electronic Scale Weight Capture

**Feature**: `008-electronic-scale` | **Date**: 2026-10-20

## Prerequisites

- Windows 10/11 x64 (primary), Node.js ≥ 22.12.0, `npm install` completed.
- No physical scale is required: the main process supports a scripted simulated transport.
- The existing keyboard data-source UI is used; no new screen is required.

## Setup

```bash
cd app
npm run dev
```

Production build: `npm run build`.

## Simulation

Select the simulated transport instead of a real serial port:

```bash
# Bash
MAXLABEL_SCALE_SIM=stable MAXLABEL_SCALE_VALUE=1.234 MAXLABEL_SCALE_UNIT=kg npm run dev
```

- `MAXLABEL_SCALE_SIM` values:
  - `stable` — emits a stable frame with the configured protocol every 200 ms.
  - `unstable` — emits alternating unstable/stable frames (timeout unless it settles).
  - `overload` / `underload` / `zero` / `negative` — emit the corresponding rejected state.
  - `malformed` — emits partial/garbled frames.
  - `disconnected` — opening the port fails.
- `MAXLABEL_SCALE_VALUE`, `MAXLABEL_SCALE_UNIT` set the simulated reading (default
  `1.234` / `kg`).
- The simulator is main-process only and is never enabled in production builds unless the
  environment variable is set (documented test hook, same pattern as
  `MAXLABEL_OPEN_PATH`).

## Automated validation

```bash
cd app
npm test
npm run test:coverage
env -u ELECTRON_RUN_AS_NODE npm run test:e2e
```

Expected planned coverage:

- **Unit — protocol parsers** (`tests/unit/shared/scale/parse.test.ts`): every protocol's
  representative stable/unstable/overload/underload/zero/negative/malformed frames; binary
  KASDA/TONDE frames; custom ambiguity rejection.
- **Unit — units** (`tests/unit/shared/scale/units.test.ts`): g/kg/lb/oz/jin conversion,
  rounding to 0–4 decimals, unknown unit rejection, conversion disabled.
- **Unit — stability/timeout logic** (`tests/integration/main/scale.test.ts`): two equal
  frames required; timer expiry; cancel.
- **Unit — per-label resolution** (`tests/unit/shared/scale/resolve.test.ts`,
  `tests/unit/shared/domain/document-scale.test.ts`): indexed values, keyboard fallback,
  configuration normalization.
- **Contract** (`tests/contracts/scale-ipc.test.ts`): payload validation, result shape,
  error keys, cancel/busy behavior.
- **Integration** (`tests/integration/main/scale.test.ts`): fake transport open/read/close,
  one read at a time, timeout/cancel release the port, no stale value.
- **Renderer** (`tests/unit/renderer/scale/auto-print.test.ts`,
  `tests/integration/renderer/scale-print.test.ts`): per-label `scaleValues`, one read per
  logical label, no reuse across jobs, no log/serial on failure, auto-print loop triggers
  one print per stable reading and stops on cancel.
- **E2E** (`tests/e2e/scale.spec.ts`): simulated stable preview (with unit conversion),
  disconnect error without a preview, and the auto-print control.

## Manual validation (simulated scale)

### V-01 Single label

1. Create or open a label; add a text object.
2. Data source → Keyboard input → Input method → Electronic scale.
3. Protocol `standard`, port `SIM1`, baud `9600`, unit `kg`, decimals `2`, conversion off.
4. Start with `MAXLABEL_SCALE_SIM=stable MAXLABEL_SCALE_VALUE=1.234 MAXLABEL_SCALE_UNIT=kg`.
5. Print one label.

Expected: the label shows `1.23` (kg, 2 decimals); the preview uses the same value; no
extra read occurs for logging.

### V-02 Unit conversion

1. Set the scale to report `kg`; set the target unit to `g`, enable conversion, decimals 0.
2. Simulate `1.234 kg` and print.

Expected: the label shows `1234` (g). With conversion off it shows `1.23` (kg).

### V-03 Multiple labels

1. Set print count to 3 with a weigh source.
2. Simulate a scripted sequence of three stable weights (`1.000`, `2.000`, `3.000` kg).
3. Print.

Expected: the three labels show the three values in order; the read is serialized and the
port is released at the end. Missing a value fails the job instead of printing a blank.

### V-04 Auto-print

1. Enable “print automatically after weight capture”.
2. Start the weighing loop in the print dock; simulate a sequence of stable weights.
3. Stop the loop.

Expected: one stable reading prints exactly one logical label, repeated by the
copies-per-label setting; the print count is ignored while auto-print is active. Stopping
cancels the pending read and releases the port; no partial value is printed.

### V-05 Failure and fallback

Run each simulation mode and try to print:

| Mode | Expected |
|------|----------|
| `disconnected` | actionable port error; no label |
| `unstable` | timeout error; retry/cancel/manual input offered |
| `overload` / `underload` | invalid-weight error; no label |
| `zero` / `negative` | rejected by default; no label |
| `malformed` | no partial number; timeout/error |

After each failure, switch the input method back to Keyboard and confirm the document is
unchanged and still printable.

### V-06 Language independence

Repeat V-01 in English and Chinese.

Expected: the printed weight string and protocol bytes are identical; only UI messages
change language.

## Validation record (2026-10-20, simulated scale)

All results below come from the scripted transport; no physical scale or printer was
available, and no system print dialog was invoked.

| Gate | Command | Result |
|------|---------|--------|
| Typecheck (node/web/test) | `npm test` | PASS |
| Vitest unit/contracts/integration | `npm test` | 66 files, 471 tests PASS |
| Coverage (`shared/domain` + `shared/print`, 80% lines) | `npm run test:coverage` | PASS — 86.66% lines |
| Playwright Electron E2E | `env -u ELECTRON_RUN_AS_NODE npm run test:e2e` | 17 tests PASS (includes 3 scale tests) |

Scenario coverage:

| Scenario | Evidence | Result |
|----------|----------|--------|
| V-01 single label, stable 1.234 kg → 1.23 | `unit/shared/scale/units.test.ts`, `integration/renderer/scale-print.test.ts`, `e2e/scale.spec.ts` (stable preview) | PASS |
| V-02 kg → g conversion | `unit/shared/scale/units.test.ts` (1234 g), `e2e/scale.spec.ts` (conversion enabled) | PASS |
| V-03 three labels receive three values | `integration/renderer/scale-print.test.ts` (1.00/2.00/3.00, three reads) | PASS |
| V-04 one label per stable reading; stop cancels | `unit/renderer/scale/auto-print.test.ts` | PASS |
| V-05 disconnected/unstable/overload/underload/zero/negative/malformed | `integration/main/scale.test.ts`, `integration/renderer/scale-print.test.ts`, `e2e/scale.spec.ts` (disconnect) | PASS |
| V-06 language independence | Values are numeric strings formatted in `shared/scale/units.ts`; English error path covered in `unit/renderer/scale/auto-print.test.ts` | PASS for formatting/errors; a bilingual physical print remains a manual check |

Not exercised automatically: physical printers, real serial hardware, and the Windows
driver print dialog. These stay in the real-device checklist below.

## Real-device checklist (deferred — TODO(device))

When hardware is available:

1. Confirm the model's serial format and status bits; update
   [contracts/scale-protocols.md](./contracts/scale-protocols.md).
2. Run V-01, V-03 and V-04 with the real scale.
3. Verify disconnect/reconnect, overload and unstable readings.
4. Confirm the COM port is released after cancel and application exit.

## Out of scope

- Network scales and multiple simultaneous scales.
- User-supplied protocol regexes (the `custom` protocol is a tolerant parser, not a
  pattern editor).
- Changes to template format, print plans, printer commands or protocol bytes beyond the
  injected weight string.
