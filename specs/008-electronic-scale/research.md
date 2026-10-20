# Research: Electronic Scale Weight Capture

**Feature**: `008-electronic-scale` | **Date**: 2026-10-20

## Current State (code evidence)

- The keyboard data source already models the scale configuration:
  `inputDevice`, `weighProtocol`, `weighPort`, `weighBaud`, `weighUnit`,
  `weighDecimals`, `weighAutoPrint`, `weighUnitConv`
  (`app/src/shared/domain/datasource.ts`, normalized in `document.ts`).
- The data-source editor renders protocol/port/baud/unit/decimals/auto-print controls and
  states that capture logic is missing (`DataSourceEditor.tsx`).
- Keyboard values are resolved synchronously from `ctx.keyboardValues[source.label]`
  (`app/src/shared/domain/datasource.ts`); print/preview currently collect one value per
  label name.
- `serialport@13` is already a runtime dependency and is unpacked by electron-builder.
  Windows **printing** uses PowerShell `System.IO.Ports`; Unix transports import
  `serialport` dynamically. There is no scale read path.

## D-001: Declarative protocol registry, no per-brand branches

- **Decision**: Each protocol is a declarative `ScaleProtocolSpec`: ordered frame patterns,
  status/stability mapping, unit token mapping, terminator, default baud and a display
  label. `shared/scale/protocols.ts` is the only place brand differences live.
- **Rationale**: The spec lists eight protocol families; a declarative registry keeps the
  reader/parser generic, makes frames auditable, and lets a correction touch one entry.
- **Alternatives considered**: per-brand parser classes (more code, duplicated buffering);
  a single tolerant parser (cannot reject malformed vendor frames safely).

## D-002: `serialport@13` behind a `ScaleTransport` interface

- **Decision**: The main process reads through a small `ScaleTransport` interface
  (`open`, `onData`, `close`) implemented by `serialport`; tests and E2E inject a scripted
  fake transport. No new dependency.
- **Rationale**: `serialport` is already installed and packaged, works on Windows/macOS/
  Linux, and avoids spawning PowerShell per read. The interface keeps the lifecycle
  testable without hardware.
- **Alternatives considered**: PowerShell `System.IO.Ports` (Windows-only, process spawn
  per read); direct OS APIs (non-portable, more native code).

## D-003: Per-label values via `scaleValues` in the data-source context

- **Decision**: Before print/preview, the renderer collects every weigh source, reads one
  stable value per logical label (`labelIndex`), and passes
  `scaleValues: Record<string, string[]>` in the existing print context. Keyboard-source
  resolution returns `scaleValues[label][labelIndex - 1]` when present, otherwise the
  existing `keyboardValues[label]`.
- **Rationale**: FR-007 requires a fresh stable reading per label; `keyboardValues` holds
  one value per label name and would repeat the same weight on every label.
- **Alternatives considered**: overwrite `keyboardValues` per label (same value repeated);
  force count = 1 (rejected in clarification); async resolution inside the print pipeline
  (larger change to the scene resolver and all callers).

## D-004: Stability, validation and timeout

- **Decision**: Accept a reading only when the protocol status is stable **and** the same
  value is seen in two consecutive frames. Reject unstable, overload, underload, negative
  and zero readings with actionable messages (zero/negative rejection is the documented
  default). Default timeout is 5000 ms; a read is aborted on timeout or cancel and the
  port is closed in `finally`.
- **Rationale**: Matches spec FR-002/FR-003/FR-004 and avoids printing transient weights.
- **Alternatives considered**: trust the first stable frame (risk of flicker); require N>2
  frames (slower for every label).

## D-005: Auto-print is a renderer loop

- **Decision**: When a weigh source has `weighAutoPrint`, a toggle in the print dock starts
  a loop: read one stable weight → print one label through the existing executor → wait
  for the next stable weight. Stop/cancel aborts the read, releases the port and does not
  print a partial value. Manual printing keeps the panel's count/copies/start-label rules;
  automatic printing prints one logical label per stable reading (copies applied) and
  ignores the print count.
- **Rationale**: Keeps one print executor and one print plan; the loop only orchestrates
  reads. FR-006/FR-009.
- **Alternatives considered**: main-process auto-print (would duplicate print
  orchestration and IPC state).

## D-006: Unit parsing, conversion and formatting

- **Decision**: Parse the unit token from the frame; map it to `g`, `kg`, `lb`, `oz` or
  `jin`. Conversion factors are exact constants (kg = 1000 g, lb = 453.59237 g,
  oz = 28.349523125 g, jin = 500 g). If `weighUnitConv` is enabled, convert the reported
  value to `weighUnit`; otherwise keep the reported unit. Format with `weighDecimals`
  (0–4) using fixed-point rounding. The value passed to the label is a plain string and
  does not depend on UI language.
- **Rationale**: Spec FR-005 and the edge case “unit conversion is explicit and rounded”;
  the label must remain stable across UI languages.
- **Alternatives considered**: always convert to `weighUnit` (ignores the
  `weighUnitConv` toggle); locale number formatting (would change printed content).

## D-007: `custom` protocol is a tolerant parser

- **Decision**: `custom` accepts any frame and extracts the first signed decimal plus a
  recognised unit token; if no unambiguous value/unit is found it fails with a clear
  “unsupported/malformed frame” error. No pattern field is added to the template model in
  v1.
- **Rationale**: The UI already exposes `custom`; adding a `weighPattern` field would be a
  template-format change outside this feature. A tolerant, strictly validated parser
  covers unknown text-output scales without guessed vendor semantics.
- **Alternatives considered**: reject `custom` entirely (contradicts the chosen “all 8”
  scope); add a user regex field (template-format change; needs separate approval).

## D-008: Protocol frames and no-device verification

- **Decision**: Implement protocol specs from published/common formats and mark them in
  `contracts/scale-protocols.md`. The eight presets ship as normally supported protocols
  with no experimental warning. No real device is available, so per-model frame
  verification is a deferred manual item tracked as `TODO(device)`; representative frames
  are covered by unit tests and the simulator.
- **Rationale**: Owner chose all 8 protocols and simulation-only validation. Isolating
  frames in one registry keeps later corrections local.
- **Risk**: KASDA/TONDE firmware variants may differ. The specs accept multiple known
  patterns and fail clearly on unknown frames rather than guessing.

### Protocol format evidence

| Protocol | Common frame | Stability signal |
|----------|--------------|------------------|
| Standard continuous | `ST,GS,+001.234kg\r\n` / `US,...` | `ST` stable, `US` unstable |
| A&D | `ST,+001.234 g\r\n`, `US,...` | `ST`/`US` header |
| Mettler Toledo (SICS / continuous) | `S S  1.234 kg\r\n` or `ST,GS,...` | `S` vs `D`/`US` |
| Ohaus | right-justified weight + unit + stability char | blank stable, `?` unstable |
| Sartorius | 16/22-char frame, `+  123.56 g  \r\n` | status character in frame |
| KASDA (common Yaohua-compatible) | `ST,GS,+0012.34,kg\r\n`; `02 <status> <6 digits> <decimals> <xor hi/lo> 03` | status byte / `ST` |
| TONDE (common Yaohua-compatible) | same family as KASDA; `=51.0700=` variant | status byte / `ST` |
| Custom | any signed decimal + unit token | no explicit flag; require two equal frames |

Sources: Mettler Toledo SICS and IND manuals; A&D balance/indicator manuals; Ohaus print
format guides; Sartorius technical notes; Keli/Yaohua continuous-output documentation.
Exact per-model byte maps are recorded as TODO(device) in the protocol contract.

## Open Questions

None blocking. Device-specific frame details are a documented verification item for the
owner when hardware becomes available; they do not change the architecture.
