# Data Model: Cross-Platform Builds and Transports

**Feature**: `005-cross-platform` | **Date**: 2026-10-19

## PlatformTransportAdapter

| Method | Input | Output | Meaning |
|--------|-------|--------|---------|
| `send` | `data: Buffer`, `port: PortConfig`, `signal?: AbortSignal` | `PrintTransportResult` | Send raw bytes/command payload |
| `listSerialPorts` | — | `SerialDevice[]` | Enumerate serial/Bluetooth devices |
| `listPrinters` | — | `PrinterFacts` | CUPS queues or Windows printer facts |
| `listUsbDevices` | — | `UsbDevice[]` | Enumerate accessible USB devices |
| `cancel` | `jobId` | boolean | Abort an in-flight job (where supported) |

The adapter is selected at module load/`send` time by `process.platform`; the facade
`commandTransport.ts` keeps the existing exports.

## SerialDevice

| Field | Meaning |
|-------|---------|
| `path` | `/dev/ttyUSB0`, `/dev/tty.usbserial-*`, `COM3` |
| `manufacturer` / `serialNumber` | Optional display info |
| `vendorId` / `productId` | Optional USB serial metadata |
| `accessible` | Permission/claim status |

## UsbDevice

| Field | Meaning |
|-------|---------|
| `vendorId` / `productId` | USB IDs |
| `busNumber` / `deviceAddress` | Location |
| `manufacturer` / `product` | Display info |
| `interfaceNumber` / `endpoint` | Printer interface/endpoint |
| `accessible` | Claim/permission status |

## CupsQueue / PrinterFacts

| Field | Meaning |
|-------|---------|
| `name` | CUPS queue name |
| `isDefault` | Default queue |
| `status` | Enabled/disabled/stopped |
| `uri` | Optional device URI |

`PrinterFacts` mirrors the existing Windows facts shape (printer name, port/location,
default flag) so the UI does not branch.

## BuildArtifact

| Field | Meaning |
|-------|---------|
| `platform` | `win32` / `darwin` / `linux` |
| `arch` | `x64` / `arm64` |
| `target` | `nsis` / `dmg` / `zip` / `AppImage` / `deb` |
| `signed` | boolean |
| `notarized` | boolean (macOS) |
| `path` | Artifact path |

## NativeModuleConfig

| Field | Meaning |
|-------|---------|
| `name` | `serialport` / `usb` |
| `rebuiltForElectron` | boolean |
| `asarUnpacked` | boolean |
| `loadError` | Actionable error if the module cannot load |

## PortConfig → Adapter Mapping

| Port type | Windows | macOS/Linux |
|-----------|---------|-------------|
| `driver` | Electron print pipeline + Win32 printer facts | Electron print pipeline + CUPS `lpstat` facts |
| `file` | Local file | Local file |
| `tcp` | Socket | Socket |
| `com` | PowerShell SerialPort | `serialport` |
| `bluetooth` | PowerShell SerialPort on COM | `serialport` on RFCOMM device |
| `usb` | Windows raw print queue | `usb`/libusb claim + write |
| `lpt` | `\\.\LPTn` | Unsupported (clear error) |
| `cloudbox` | TCP | TCP |

## Error and Status Mapping

- Missing device/service/permission → `failed` with actionable message.
- Service unavailable (no CUPS, no udev access) → `failed`/`unknown` with guidance;
  never crash.
- Pre-aborted job → `canceled`.
- Connection closed after write → `unknown`.
- Device accepted bytes → `accepted`.

## CI Build Matrix

| Job | Runner | Output |
|-----|--------|--------|
| Windows fast/E2E | `windows-latest` | gate + E2E |
| macOS build | `macos-latest` | dmg/zip x64/arm64 (arm64 best effort) |
| Linux build | `ubuntu-latest` | AppImage/deb x64 |

Invariants:

- Windows status/byte behavior is unchanged (003/004 tests).
- No shell interpolation for queue/device names.
- Native modules are rebuilt/unpacked or the build fails clearly.
- Signing/notarization status is recorded per artifact.
