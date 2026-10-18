# Contract: Fixtures and Golden Files

**Feature**: `002-test-architecture` | **Date**: 2026-10-18

## Locations

| Path | Kind | Policy |
|------|------|--------|
| `app/fixtures/protocol/*.prn` | Protocol goldens | Byte-exact; read as `Buffer`; `.gitattributes -text` |
| `app/fixtures/protocol/*-warnings.txt` | Expected warnings | Byte-exact; either assert or remove in the rewrite |
| `app/fixtures/protocol/protocol-snapshots.json` | Golden manifest | `version`, `file`, `bytes`, `sha256`, `mustContain` |
| `app/fixtures/lsdx/minimal.lsdx` | LabelShop import fixture | Import as raw text; parse with `DOMParser` under jsdom |
| `app/tests/fixtures/**` | New feature-specific fixtures | Prefer generating in the test/temp dir; commit only stable inputs |

## Rules

1. Protocol goldens MUST be compared by byte length, SHA-256 and required tokens.
2. Golden generation is the only supported update path:
   `npm run fixtures:print` (legacy generator) or its replacement.
3. Updating a golden requires reviewing the byte diff and the manifest together.
4. Tests MUST NOT normalize line endings for byte-exact goldens.
5. Tests MUST NOT write into `app/fixtures`; generated outputs go to OS temp directories.
6. `.lsdx` is imported as text, not executed. Embedded images may be raw base64 or
   zlib-compressed data; the fixture `minimal.lsdx` is image-free.
7. Fixtures used by the fast gate MUST be small (< 100 KB each) and deterministic.

## Update Procedure

1. Change the generator or the production code.
2. Run the generator.
3. Inspect `git diff` for every `.prn` and the manifest.
4. Run the protocol contract tests.
5. Commit the code, goldens and manifest together.
