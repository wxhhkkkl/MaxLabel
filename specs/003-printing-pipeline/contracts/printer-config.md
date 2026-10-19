# Contract: Printer Configuration and Catalog

**Feature**: `003-printing-pipeline` | **Date**: 2026-10-18

## Persisted Configuration

`PrinterConfig` stores: command set (`tspl`/`zpl`/`cpcl`), profile/model/firmware,
DPI, speed, density, print mode, label type, top offset, media handling, backfeed,
pre/content/post commands, `saveAsDefault`, port and Windows printer name.

The configuration is part of the template and survives save/open normalization. Device
differences belong here or in catalog capabilities, not in business branches.

## Catalog

- 125 printer entries and 39 brand filters (generated data).
- Recommended command sets: Zebra→ZPL; TSC/佳博/汉印/芯烨/得力/启锐→TSPL; CPCL models→CPCL.
- Unknown brands: TSPL→ZPL→CPCL best effort; no guarantee.
- Catalog entries provide defaults for new `PrinterConfig` objects.

## Validation

At the IPC/persistence boundary:

- Unknown fields are dropped.
- USB requires a selected USB port; TCP requires host/port; cloudbox may be empty.
- COM validates baud/data bits/parity/stop bits/flow control.
- LPT must match `LPT[1-9][0-9]*`.
- Invalid values are rejected with a specific message.

Evidence: `app/src/shared/domain/printer.ts`, `printerCatalog.generated.ts`,
`app/src/main/ipc/validation.ts`, `tests/unit/shared/domain/printer-catalog.test.ts`,
`tests/contracts/ipc-contract.test.ts`.
