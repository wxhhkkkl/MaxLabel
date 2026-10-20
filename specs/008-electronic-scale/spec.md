# Feature Specification: Electronic Scale Weight Capture

**Feature Branch**: `008-electronic-scale`

**Created**: 2026-10-19

**Status**: Implemented and converged (2026-10-20); real-device verification deferred

**Input**: User description: "为 MaxLabel 增加电子称串口重量采集：在键盘输入数据源中选择电子称，按协议/端口/波特率/单位/小数位/自动打印/单位换算读取重量并用于标签。当前 UI 已有连接配置，但串口采集逻辑未实现。"

## Clarifications

### Session 2026-10-20

- Q: When a label is previewed and then printed, should the preview use its own scale reading or reuse the readings that will be used for printing? → A: The preview uses one separate sample reading; printing reads a fresh stable value per label.
- Q: When automatic printing is enabled and the print count is greater than one, how many labels should one stable reading produce? → A: Exactly one logical label per stable reading, repeated by the copies-per-label setting; the print count is ignored while auto-print is active.
- Q: What does the configured "weight unit" mean: the scale-reported unit or the label output target? → A: It is the output target; conversion is applied when enabled, and the reported unit is kept when conversion is disabled.
- Q: How should the `custom` protocol work without a user-supplied pattern? → A: A strictly validated tolerant parser extracts a signed decimal and a known unit; an ambiguous frame fails clearly and is never partially parsed.
- Q: Without a real device, how should the eight protocol presets be released? → A: As normally supported protocols with no experimental warning; device-specific frame verification is deferred and corrections stay isolated in the protocol registry.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Weigh a product and print a label with the weight (Priority: P1)

An operator selects a keyboard-input data source, changes its input device to an
electronic scale, configures the scale protocol, serial port and baud rate, then starts a
print. When the scale reports a stable weight, the value is formatted with the configured
unit and decimal places and used in the label; the label prints with the captured weight.

**Why this priority**: Capturing a stable weight and printing it is the core business
value; the remaining options only refine that flow.

**Independent Test**: With a simulated or real serial scale, configure a weight source,
print one label, and verify the label contains the stable weight formatted with the
selected unit and decimals.

**Acceptance Scenarios**:

1. **Given** a keyboard data source with input device set to electronic scale and a valid
   serial configuration, **When** the user prints, **Then** the application reads a stable
   weight and uses it as the data-source value.
2. **Given** the scale reports the same stable value repeatedly, **When** the value is
   captured, **Then** the label prints once with that value and the configured unit and
   decimals.
3. **Given** the scale is disconnected or the port cannot be opened, **When** the user
   tries to print, **Then** the application reports a clear, actionable error and does not
   print a label with an empty or stale value.

---

### User Story 2 - Control units, decimals and automatic printing (Priority: P2)

An operator configures the weight unit, decimal places, optional conversion to another
unit, and whether a stable weight should trigger printing automatically. The printed value
is unambiguous and consistent with the configured rounding.

**Why this priority**: Different products and customers require different units and
precision; a raw scale reading alone is often not acceptable on the label.

**Independent Test**: Capture the same simulated weight under different unit/decimal
configurations and verify the printed text and automatic-print behavior.

**Acceptance Scenarios**:

1. **Given** a scale reading of 1.234 kg, **When** the unit is kg with 2 decimals, **Then**
   the label shows 1.23 kg; when the unit is g, **Then** it shows 1234 g.
2. **Given** automatic printing is enabled, **When** the scale reports a stable weight,
   **Then** exactly one logical label is printed without a separate manual confirmation,
   repeated by the copies-per-label setting; the print count is ignored while auto-print is
   active.
3. **Given** automatic printing is disabled, **When** a stable weight is captured, **Then**
   the value is held for the normal print action rather than printing immediately.

---

### User Story 3 - Fall back safely and diagnose failures (Priority: P3)

An operator can test the scale connection, see whether readings are stable, and fall back
to manual keyboard entry when the scale is unavailable. A failed or cancelled scale read
must not hang the application or print a wrong value.

**Why this priority**: Real scales disconnect, overload and report unstable values; safe
fallback and diagnostics protect the operator from bad labels.

**Independent Test**: Disconnect the scale during a read, force an overload/unstable
reading, and use the manual fallback; verify the application reports the problem and
continues without a corrupt label.

**Acceptance Scenarios**:

1. **Given** the scale is in overload, underload, zero or unstable state, **When** a read is
   attempted, **Then** the application reports the condition and does not print the
   invalid value.
2. **Given** the scale fails to produce a stable value within the timeout, **When** the
   read ends, **Then** the user can retry, cancel, or switch to manual keyboard entry.
3. **Given** the user cancels a print while waiting for a stable weight, **When** the
   operation ends, **Then** the port is released, the job is canceled, and no label is
   printed with a partial reading.

---

### Edge Cases

- Scale disconnected or COM port busy: clear error; no stale value reused from a previous
  label.
- Scale reports unstable, negative, zero, overload or underload values: reject and prompt;
  negative/zero may be valid only when explicitly configured (assumption: reject by
  default).
- Protocol mismatch or malformed frame: time out with an actionable error; never parse a
  partial number silently.
- Long-running read or no data: bounded timeout; cancel releases the serial port.
- Multiple weight sources or multiple labels: one serial connection at a time; reads are
  serialized; each label gets a fresh stable reading when required.
- Preview vs print: a preview uses one separate sample reading; printing uses a fresh
  stable reading per required label; logging does not trigger an additional read.
- Unit conversion: rounding follows the configured decimals; the stored/printed unit is
  explicit and does not depend on the UI language.
- Application shutdown or tab close while waiting: the scale port is released.
- Scale protocol not in the supported list but configured as "custom": a documented
  compatibility path or a clear unsupported error is shown.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A keyboard-input data source MUST support an input device of "electronic
  scale" with configurable protocol, serial port, baud rate, unit, decimal places,
  automatic printing and optional unit conversion.
- **FR-002**: The application MUST read a weight from the selected serial scale using the
  configured protocol framing and MUST NOT treat a malformed or incomplete frame as a
  valid weight.
- **FR-003**: The application MUST only use a stable weight; unstable, overload, underload,
  negative or zero readings MUST be rejected with an actionable message unless a future
  explicit configuration allows them.
- **FR-004**: The read MUST be bounded by a timeout; on timeout the user MUST be able to
  retry, cancel, or switch to manual keyboard entry.
- **FR-005**: The captured weight MUST be formatted with the configured decimal places.
  `weighUnit` is the label output target: when unit conversion is enabled, the reported
  value MUST be converted to `weighUnit`; when disabled, the unit reported by the scale is
  used. Conversion MUST be explicit and rounded to the configured decimals.
- **FR-006**: When automatic printing is enabled, each stable weight MUST print exactly one
  logical label, repeated by the copies-per-label setting; the print count is ignored while
  auto-print is active. When disabled, the value MUST wait for the normal print action.
- **FR-007**: Each logical label that needs a weight MUST receive a fresh reading at the
  point of data resolution. A preview is a separate operation that uses one sample reading
  and MUST NOT consume the readings reserved for printing; logging MUST NOT cause an
  additional read or reuse a stale reading.
- **FR-008**: If the scale is unavailable, the operator MUST be able to fall back to
  manual keyboard entry without losing the document or other label data.
- **FR-009**: Cancellation MUST release the serial port and leave no open handle; a failed
  or canceled read MUST not advance serial numbers, write a successful print log, or
  print a partial value.
- **FR-010**: The application MUST provide a way to test the scale connection and show
  whether the configured port/protocol is producing stable readings.
- **FR-011**: Scale configuration MUST be stored with the template/data source and MUST be
  validated for supported protocol, port, baud rate, unit and decimal range.
- **FR-012**: All supported protocols and units MUST be documented with their expected
  framing and value semantics. The `custom` protocol is a strictly validated tolerant
  parser that extracts a signed decimal and a known unit; when no unambiguous value/unit
  is found it MUST produce a clear error rather than a partial parse or guessed vendor
  semantics. No user-supplied pattern field is added in this feature.
- **FR-013**: Scale reads MUST NOT change the label's stored text when the scale is
  disconnected; the data source must use the last explicitly confirmed/manual value or
  fail the job rather than silently printing an old value.

### Key Entities *(include if feature involves data)*

- **Scale Configuration**: Protocol, serial port, baud rate, unit, decimals, automatic
  printing and unit-conversion options attached to a keyboard-input data source.
- **Weight Reading**: The captured numeric value, unit, stability flag and timestamp; it
  becomes the resolved value for the label.
- **Scale Protocol**: The framing and value-extraction rules for a supported scale family
  (KASDA, TONDE, A&D, Mettler, Ohaus, Sartorius, standard continuous, custom).
- **Print Trigger**: The manual or automatic action that prints after a stable reading.
  Manual printing uses the existing print plan/count/copies/start-label rules; automatic
  printing prints exactly one logical label per stable reading (copies per label applied)
  and ignores the print count.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can configure a scale and print a label containing a stable
  weight in 100% of tested normal cases.
- **SC-002**: A disconnected, overloaded or unstable scale never produces a printed label
  with an invalid or stale weight; the user sees an actionable message in 100% of tested
  failure cases.
- **SC-003**: A scale read completes or times out within the configured bound; cancel and
  timeout release the serial port in 100% of tested cases.
- **SC-004**: Unit/decimal conversion matches the configured rounding in all tested
  values.
- **SC-005**: A preview performs exactly one sample scale read; printing performs exactly
  one fresh stable read per required label; logging performs no additional read. Verified
  in automated tests with a simulated scale.
- **SC-006**: The manual keyboard fallback keeps the document editable and printable when
  the scale is unavailable.

## Assumptions

- Scales connect through a serial COM port; USB-to-serial adapters are treated as COM
  ports. Network scales are out of scope for this feature.
- One scale connection is active at a time; multiple simultaneous scales are out of scope.
- The eight protocol presets are released as normally supported protocols with no
  experimental warning. Exact per-model frames are based on published/common formats;
  device-specific verification is a deferred manual item, and corrections stay isolated
  in the shared protocol registry.
- Stable/overload/underload/zero/negative semantics follow the selected protocol's
  documented status flags.
- Automatic printing prints one logical label per stable reading, repeated by the
  copies-per-label setting, and does not use the print count. It reuses the existing print
  executor and does not introduce a second print pipeline.
- Real-device verification is manual; automated tests use a simulated serial scale.
- The label content, printer commands and template format remain language- and
  scale-independent; only the captured value is injected into the existing data-source
  resolution.
- The legacy menu item 「电子称」 opens a placeholder dialog (`MoreDialogs.tsx`
  `WeighDialog`) that does not persist configuration; scale configuration is edited in
  the data-source editor. Consolidating or removing that menu entry is separate cleanup
  (TODO(待确认)).
