# Contract: Template File Format

**Feature**: `001-system-baseline` | **Date**: 2026-10-18

## Formats

| Extension | Content | Read | Write |
|-----------|---------|------|-------|
| `.msdx` | Versioned JSON envelope wrapping `LabelDoc` | Yes | Yes (default) |
| `.json` | Legacy bare `LabelDoc` JSON | Yes | Yes (compatibility) |
| `.lsdx` | LabelShop XML document | Import only | No |

## `.msdx` Envelope

```json
{
  "format": "maxlabel-msdx",
  "version": 2,
  "app": "MaxLabel",
  "doc": { "version": 1, "name": "...", "objects": [] }
}
```

- `format` MUST equal `maxlabel-msdx`.
- `version` MUST be a number ≤ `DOCUMENT_MODEL_VERSION`; higher versions are rejected
  with a clear error.
- `doc` is migrated by `migrateDocument` and normalized by `normalizeDocument` before use.
- Bare `LabelDoc` JSON (no envelope) is accepted for backward compatibility.
- Database passwords are redacted before serialization; secrets live in main-process
  encrypted storage.

## Local Template Library

- Location: Electron `userData/templates`.
- Limits: 1,000 templates, 256 MB total.
- Writes are atomic (temporary file + rename).
- Template listing returns name, path, mtime, size, optional width/height, remark and thumb.
- Save/open dialogs grant path capabilities; the renderer cannot write arbitrary paths.

## LabelShop Import

`.lsdx` is XML and is imported through `io/lsdxImport.ts`. Embedded images may be raw
base64 or zlib-compressed data and are converted to data URLs. Imported documents then
follow the same normalization path as other templates.

Evidence: `app/src/renderer/src/io/msdx.ts`, `lsdxImport.ts`,
`app/src/main/ipc/registerTemplateIpc.ts`, `app/src/shared/domain/document.ts`.
