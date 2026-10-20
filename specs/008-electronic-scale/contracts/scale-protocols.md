# Contract: Scale Protocols

**Feature**: `008-electronic-scale` | **Date**: 2026-10-20

## Common rules

- Frames are read as bytes; text frames are decoded as ASCII, never using the UI language.
- A frame is valid only if it matches one of the protocol's declared patterns exactly. A
  partial or malformed frame is discarded and never yields a number.
- Stable status and the same value in two consecutive frames are both required.
- Units are case-insensitive (`kg`/`KG`); an unknown unit is a malformed frame.
- Reject zero and negative values by default.
- A protocol may declare several patterns (for example a text frame and a binary frame).
  Patterns are tried in order.
- Default read timeout 5000 ms; the reader may see many frames within the timeout.

## Protocol specifications

### `standard` — standard continuous output

- Default baud: 9600; terminator: `\r\n`.
- Patterns:
  - `^(ST|US)\s*,\s*(GS|NT)\s*,\s*([+-]?\s*\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s*$`
  - `^([+-]?\s*\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*$`
- Stability: `ST` stable; `US` unstable.
- Used as the reference format for `custom` and for scales that expose a generic text
  output.

### `ad` — A&D

- Default baud: 9600; terminator: `\r\n`.
- Header is the stability indicator: `ST` stable, `US` unstable; `OL` overload.
- Pattern: `^(ST|US|OL)\s*,\s*([+-]?\s*\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s*$`
- Unit token may be absent; then use the configured `weighUnit`.
- Source: A&D balance/indicator manuals (FZ-i/FX-i, AD-4212, GH, MC, AD-4430R).

### `mettler` — Mettler Toledo (SICS-style / continuous)

- Default baud: 9600; terminator: `\r\n`.
- Patterns:
  - `^S\s*(S|D)\s*([+-]?\s*\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s*$` (SICS send response)
  - `^(ST|US)\s*,\s*(GS|NT)\s*,\s*([+-]?\s*\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s*$`
- Stability: second `S` or `ST` stable; `D`/`US` unstable.
- Source: MT-SICS reference manuals, IND-series manuals.

### `ohaus` — Ohaus

- Default baud: 9600; terminator: `\r\n`.
- Pattern (fixed fields, stability char is a space when stable, `?` when unstable):
  `^(.{0,11}?)([+-]?\s*\d+(?:[.,]\d+)?)\s*([A-Za-z/]+)\s*([ ?])\s*(G|N|T|PT)?\s*$`
- If the frame is a plain `weight unit` pair, accept it and treat a `?` anywhere before the
  unit as unstable.
- Source: Ohaus print-format guides (Valor, Ranger, Defender, Explorer).

### `sartorius` — Sartorius

- Default baud: 9600; terminator: `\r\n`.
- 16/22-character frame: sign, space, weight with decimal point, spaces, unit, spaces.
- Pattern: `^([+-])\s*(\d+(?:[.,]\d+)?)\s*([A-Za-z]+)?\s*$`
- Stability is taken from an optional status/marker block when present; otherwise require
  two equal frames.
- Source: Sartorius technical notes / Q-App configurable output.

### `kasda` — KASDA (common Yaohua-compatible output)

- Default baud: 9600; terminator: `\r\n` for text frames, `0x03` for the binary frame.
- Text patterns:
  - `^(ST|US)\s*,\s*(GS|NT)\s*,\s*([+-]?\s*\d+(?:\.\d+)?)\s*,?\s*([A-Za-z]+)?\s*$`
  - `^=([+-]?\d+(?:\.\d+)?)=$` (D2+-style variant)
- Binary frame (12 bytes): `0x02 <status> <6 ASCII digits> <decimals 0–4> <xor hi> <xor lo> 0x03`
  - status bit 0: stable; bit 1: overload/underload; bit 2: negative; bit 3: net/gross.
- Source: common Keli/Yaohua continuous-output documentation. **TODO(device): confirm the
  exact status bits and XOR range for the target KASDA model.**

### `tonde` — TONDE (common Yaohua-compatible output)

- Default baud: 9600; terminator: `\r\n` or `0x03`.
- Accepts the same text and binary patterns as `kasda`; commonly ships with the Yaohua
  TF=0/TF=2/TF=4 output family.
- **TODO(device): confirm whether the target TONDE model enables TF=0, TF=2 or TF=4 by
  default.**

### `custom` — tolerant parser

- Accepts any single-line text frame and extracts the first signed decimal plus a
  recognised unit token (`g`, `kg`, `lb`, `oz`, `jin`, case-insensitive).
- No stability flag: requires two identical consecutive values.
- If no unambiguous value/unit is found, returns `malformed` and never prints.
- This is the documented “unknown text scale” path; it is not a user-supplied regex.

## Errors

| Condition | `messageKey` | Behaviour |
|-----------|--------------|-----------|
| Port empty/unopenable/busy | `error.scalePort` | No read; actionable message |
| Protocol or frame malformed | `error.scaleFrame` | Discard frame; continue until timeout |
| No stable value before timeout | `error.scaleTimeout` | Cancel read; release port |
| Overload/underload/zero/negative | `error.scaleInvalid` | Reject the reading |
| Custom frame not unambiguous | `error.scaleCustom` | Clear unsupported error |
| User cancel | `status.exportCanceled` (or dedicated key) | Release port; no print |

Raw `message` is always preserved for logs/diagnostics; the UI resolves `messageKey`
first and falls back to `message`.
