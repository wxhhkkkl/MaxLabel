# Contract: Device Enumeration

**Feature**: `005-cross-platform` | **Date**: 2026-10-19

## Sources

| Platform | Printers | Serial | USB |
|----------|----------|--------|-----|
| Windows | Win32 printer facts (unchanged) | PowerShell/COM | Windows USB printer ports |
| macOS | CUPS queue list (`lpstat -p -d`) | `serialport` list | `usb` list/claim |
| Linux | CUPS queue list (`lpstat -p -d`) | `serialport` list | `usb` list, udev permissions |

## Shape

`PrinterFacts` keeps the existing fields (name, port/location, default flag) so the UI
does not branch. `SerialDevice` exposes path/manufacturer/serial/accessibility.
`UsbDevice` exposes vendor/product/bus/address/interface/accessibility.

## Behavior

- Enumeration failures return empty lists plus an actionable message; the app must not
  crash or hang.
- Inaccessible USB devices are listed with `accessible=false` and guidance (udev/permission).
- CUPS absence reports "未检测到 CUPS/lp" instead of an empty successful list.
- LPT is not enumerated on macOS/Linux.

## UI

Printer settings shows platform-appropriate ports; selecting an unavailable port gives the
same validation error shape as Windows. Brand/profile recommendations remain data-driven.
