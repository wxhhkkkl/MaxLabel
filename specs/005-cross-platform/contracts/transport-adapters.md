# Contract: Platform Transport Adapters

**Feature**: `005-cross-platform` | **Date**: 2026-10-19

## Public Facade

`app/src/main/printing/commandTransport.ts` keeps its existing exports
(`sendCommand`, list functions, result types). Platform code lives behind it; IPC and
renderer code must not import platform modules directly.

## Adapter Interface

```ts
interface PlatformTransportAdapter {
  send(data: Buffer, port: PortConfig, signal?: AbortSignal): Promise<PrintTransportResult>
  listSerialPorts(): Promise<SerialDevice[]>
  listPrinters(): Promise<PrinterFacts>
  listUsbDevices(): Promise<UsbDevice[]>
}
```

## Behavior

- `driver`: Electron print pipeline on all platforms; CUPS facts on macOS/Linux.
- `file`/`tcp`: identical implementation on all platforms.
- `com`/`bluetooth`: PowerShell on Windows, `serialport` on macOS/Linux.
- `usb`: Windows raw queue on Windows, `usb`/libusb on macOS/Linux.
- `lpt`: Windows only; macOS/Linux return `failed` with "当前平台不支持 LPT".
- `cloudbox`: TCP rules on all platforms.

## Status and Batching

- Preserve 003 statuses: `accepted`/`failed`/`unknown`/`canceled`; multi-batch partial
  jobs remain `partial` with confirmed counts.
- Batch sizes and serial/log semantics are unchanged.
- Cancellation must destroy sockets/streams/devices and clear active-job maps.

## Security

- Use `execFile` with argument arrays for `lpstat`/`lp`; never interpolate queue names,
  paths or user input into a shell string.
- Validate queue/device names and paths before invoking system tools.
- Return actionable errors for permissions/udev/CUPS; do not crash the app.

## Tests

- Adapter selection tests for `win32`/`darwin`/`linux`.
- Unix adapter tests with fake `execFile`/`serialport`/`usb` modules.
- Windows regression: all 003 transport/executor tests and E2E remain green.
