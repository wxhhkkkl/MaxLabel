# Feature Specification: Electronic Scale Weight Capture

**Feature Branch**: `008-electronic-scale`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "为 MaxLabel 增加电子称串口重量采集：在键盘输入数据源中选择电子称，按协议/端口/波特率/单位/小数位/自动打印/单位换算读取重量并用于标签。当前 UI 已有连接配置，但串口采集逻辑未实现。"

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
   **Then** the print is triggered without a separate manual confirmation, subject to the
   existing print count/copies rules.
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
- Preview vs print: preview and print must use the same capture semantics; logging must
  not trigger a second scale read.
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
- **FR-005**: The captured weight MUST be formatted with the configured unit and decimal
  places; unit conversion, when enabled, MUST be explicit and rounded to the configured
  decimals.
- **FR-006**: When automatic printing is enabled, a stable weight MUST trigger the print
  using the existing print count/copies/start-label rules; when disabled, the value MUST
  wait for the normal print action.
- **FR-007**: Each logical label that needs a weight MUST receive a fresh reading at the
  point of data resolution; preview, printing and logging MUST NOT cause duplicate reads
  or reuse a stale reading.
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
  framing and value semantics; an unsupported custom protocol MUST produce a clear error
  rather than guessed parsing.
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
- **Print Trigger**: The manual or automatic action that prints after a stable reading;
  it uses the existing print plan/count/copies semantics.

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
- **SC-005**: Preview, print and logging together trigger exactly one scale read per
  required label in automated tests with a simulated scale.
- **SC-006**: The manual keyboard fallback keeps the document editable and printable when
  the scale is unavailable.

## Assumptions

- Scales connect through a serial COM port; USB-to-serial adapters are treated as COM
  ports. Network scales are out of scope for this feature.
- One scale connection is active at a time; multiple simultaneous scales are out of scope.
- The owner provides or confirms the exact protocol documentation and target device
  models before implementation; the UI already lists the intended protocol families.
- Stable/overload/underload/zero/negative semantics follow the selected protocol's
  documented status flags.
- Automatic printing uses the existing print count/copies/start-label behavior and does
  not introduce a second print executor.
- Real-device verification is manual; automated tests use a simulated serial scale.
- The label content, printer commands and template format remain language- and
  scale-independent; only the captured value is injected into the existing data-source
  resolution.
