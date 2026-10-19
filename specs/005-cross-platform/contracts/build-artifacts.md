# Contract: Build Artifacts

**Feature**: `005-cross-platform` | **Date**: 2026-10-19

## Targets

| Platform | Arch | Target |
|----------|------|--------|
| Windows | x64 | NSIS (unchanged) |
| macOS | x64, arm64 | dmg + zip |
| Linux | x64 | AppImage + deb |

Linux arm64 and other distributions are best effort.

## Native Modules

- `serialport` and `usb` are declared dependencies.
- They must be rebuilt for the Electron ABI and unpacked from asar
  (`asarUnpack`/`files` rules).
- A build or smoke test must fail clearly if a native module cannot load.

## Artifact Metadata

Each artifact records: platform, arch, target, signed (boolean), notarized (macOS),
version and commit. Unsigned/not-notarized artifacts are labeled in release notes.

## CI

- Windows fast/E2E jobs remain blocking.
- macOS/Linux jobs build artifacts and upload them.
- Build logs report signing/notarization availability rather than failing silently.
- Caches for npm and Electron downloads are used.

## Compatibility

- Existing Windows artifacts and behavior are unchanged.
- New artifacts use the same application version and protocol/feature set (including
  ESC/POS from 004).
