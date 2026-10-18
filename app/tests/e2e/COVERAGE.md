# E2E Coverage

**Feature**: `002-test-architecture` | **Date**: 2026-10-18

## Covered journeys

| Spec | Journey |
|------|---------|
| `app-launch.spec.ts` | Launch → start page → create a label → editor shell |
| `template-roundtrip.spec.ts` | Open `.msdx` → Ctrl+S → file rewritten with the expected document |
| `print-preview.spec.ts` | Open template → preview window → one page/image rendered → close |
| `offline-license.spec.ts` | Unreachable license server → local open/edit/save still works |

## Rendering / workspace harnesses

| Spec | Coverage |
|------|----------|
| `render-harness.spec.ts` | Editor/preview pixel parity, paper shapes/holes, RFID exclusion, table geometry, bitmap cache invalidation (`PRINT-12`, `EDIT-7`) |
| `workspace-harness.spec.ts` | Rulers, fit modes, wheel zoom, context menu, disc clipping, editor-only hairline (`EDIT-6`) |

The harnesses bundle the real renderer modules with esbuild and execute them in a hidden
Electron `about:blank` window, so they use Chromium canvas/`Path2D` rather than jsdom.

All P1 assertions in `LEGACY-ASSERTIONS.md` are now `ported`; the legacy suite was removed
on 2026-10-18.
