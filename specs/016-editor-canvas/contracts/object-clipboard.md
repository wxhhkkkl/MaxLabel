# Contract: Object Clipboard

**Feature**: `016-editor-canvas` | **Date**: 2026-10-20

## Payload

```ts
interface ClipboardPayload {
  format: 'maxlabel-objects'
  version: 1
  objects: LabelObject[]
}
```

Serialized as text JSON and written to `navigator.clipboard` on copy/cut. An in-memory copy is
kept as a fallback for environments where the system clipboard is unavailable.

## Copy / cut

- Copy leaves the document untouched; cut removes the selected objects in one document
  mutation and clears the tab selection if it pointed at a removed object.
- Both write the same payload and mark Paste as available.
- Status messages report the number of objects.

## Paste

1. Read system-clipboard text (or the in-memory copy).
2. Parse JSON; accept the envelope or a bare object array.
3. Reject non-arrays, empty arrays and non-MaxLabel text → no objects.
4. Normalise objects through `normalizeDocument` (version 2, 10000×10000 scratch document).
5. Clone each object with a fresh ID and +1 mm x/y offset; groups recurse.
6. Append to the document in one mutation and select the last pasted object.
7. Status reports the number of pasted objects.

Malformed clipboard content never mutates the document.

## Interaction with selection/format

- Clipboard content is independent of the current tab; copying in one template and pasting
  in another is supported.
- Pasted objects keep their data source/format/colour properties, subject to document
  normalisation.
- Position-locked objects can be copied; the lock flag is preserved.

## Non-goals

- Rich-text/OS-native object formats.
- Undo grouping across copy/paste beyond the normal document mutation.
