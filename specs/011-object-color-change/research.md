# Research: Object Colour Change and Colour Index Table (As-Is)

**Feature**: `011-object-color-change` | **Date**: 2026-10-20

## Method

Brownfield analysis of `shared/domain/objects.ts`, `shared/domain/document.ts`,
`ObjectPropsDialog`, Fabric rendering and the print capability/rasterisation path, plus the
existing `color-change.test.ts`. No new colour feature was designed. Open questions remain
`TODO(待确认)` and are outside the change scope.

## D-001: One resolver for every consumer

- **Decision**: `resolveColorChangePlan` is the only place that turns a mode + content +
  table into `ColorChangePlan` (`kind`, `colors`, `rows`, `cols`). Preview/Fabric rendering,
  the re-render path, bitmap output and native fallback all consume it.
- **Rationale**: The spec's SC-005 requires no colour drift between preview, bitmap and
  commands. The existing code already has a single resolver; duplicating it in adapters
  would violate the constitution's single-geometry/single-pipeline rule.
- **Alternatives considered**: Per-renderer colour logic (rejected: drift); moving colour
  into the print plan (rejected: the plan carries resolved primitives, not source modes).

## D-002: Mode and granularity matrix

- **Decision**: Keep the seven modes (`fixed`, `random`, `indexByContent`, `indexVar`,
  `valueVar`, `index`, `rgb`) and the four granularities (`solid`, `char`, `block`,
  `gradient`). Granularity is constrained per object type:
  - line/rect/ellipse/image: `solid` only;
  - text: `solid`, `char`;
  - barcode: `solid`, `block`, `gradient`;
  - table/rfid/group: no variable colour.
  A stored granularity that is not allowed for the type collapses to `solid`.
- **Rationale**: Matches the recorded LabelShop behaviour and the existing tests.
- **Alternatives considered**: Allowing every granularity everywhere (rejected: printers and
  object geometry cannot express it); per-mode granularity lists (rejected: current matrix
  is already encoded in `GRANULARITY_BY_TYPE`).

## D-003: Ten predefined colours and table precedence

- **Decision**: Empty shared/private tables fall back to `DEFAULT_COLOR_INDEX_TABLE`
  (10 colours, indexes 0–9). A non-empty selected table is used as-is and indexes wrap.
- **Rationale**: The help text defines the ten predefined colours; the fallback keeps old
  templates and empty tables working.
- **Alternatives considered**: Treating an empty table as an error (rejected: breaks old
  templates); merging user colours with defaults (rejected: index semantics would shift).

## D-004: Character-to-index algorithm

- **Decision**: Digits map to their value; letters A–Z/a–z map to `|code − 'A'| mod 10`;
  other characters map to `code mod 10`.
- **Rationale**: Matches the help text and the existing test expectations
  (`'0'→0`, `'A'→0`, `'a'→2`, `'Z'→5`, `'#'→5`).
- **Alternatives considered**: Case-sensitive ASCII modulo only (rejected: letters would
  index differently than LabelShop).

## D-005: Deterministic random colours

- **Decision**: Random colours derive an index from `labelSeed` (label index, copy, record)
  and position using a mixed integer hash. The same label/copy/record/position must yield
  the same colour in preview and output.
- **Rationale**: Non-deterministic randomness would make preview and print differ; the
  existing `pseudoRandomIndex`/`labelSeed` are the current implementation.
- **Alternatives considered**: `Math.random()` (rejected: not reproducible); seeding from
  time (rejected: same problem).

## D-006: Colour-value parsing

- **Decision**: `parseColorValues` splits on `,` or `|`, trims, drops empty entries, and
  keeps the remaining strings. Empty input yields `[]`, which makes the resolver fall back
  to the object colour. `indexVar` reads an index string from a named variable;
  `valueVar` reads colour values from it.
- **Rationale**: Matches the help text ("逗号或竖线分隔") and the tested behaviour.
- **Alternatives considered**: One separator only (rejected: breaks recorded UI guidance);
  validating colours at parse time (rejected: the renderer already tolerates non-hex and
  falls back).

## D-007: Image eligibility

- **Decision**: Variable image colour is allowed only for datasource images or loaded
  mono bitmaps; embedded/linked colour images are excluded. The property page additionally
  blocks the controls when the loaded image is known to contain colour.
- **Rationale**: LabelShop treats image data sources as monochrome bitmaps; tinting a colour
  image is not expressible.
- **Alternatives considered**: Allowing all images with a tint (rejected: changes semantics
  and can produce unexpected output).

## D-008: Native output must rasterise dynamic colour

- **Decision**: Any primitive using a non-fixed colour mode must force page rasterisation
  when the printer uses native commands (TSPL/ZPL/CPCL/ESC/POS). Windows driver output keeps
  colour.
- **Rationale**: Native protocols have no colour parameter; sending the object's base colour
  would silently print black. The spec's FR-013 requires the bitmap fallback.
- **Current state / risk**: `sceneNeedsRasterization` already forces raster for text, rect
  and ellipse with dynamic colour. Barcodes with dynamic colour are rendered as tinted
  bitmaps in Fabric and vector pages throw `VectorUnsupportedError`, but the native-command
  raster trigger does not currently include barcodes. The implementation phase must add a
  failing test for a dynamic-colour barcode on a native printer and fix the trigger.
- **Alternatives considered**: Emitting per-colour barcode commands (not supported by the
  protocols); ignoring colour on native printers (rejected: wrong output).

## D-009: Normalisation and migration

- **Decision**: Keep the current document normaliser: legacy `variable` mode migrates to
  `valueVar`; unknown modes → `fixed`; unknown granularity → `solid`; `tableSource` is
  `shared` or `private`; private tables ≤256 entries (strings ≤64 chars); block rows/cols
  integers 1–100; variable name/input ≤255 chars; document `colorIndexTable` ≤256 colours.
  Unknown enum values fall back, while out-of-range numeric/string limits are rejected by
  document normalisation (the document does not load).
- **Rationale**: Protects templates from malformed data and keeps old files loading.
- **Alternatives considered**: Strict rejection (would break existing templates); silent
  truncation without tests (rejected: normalisation is already covered and should stay
  observable).

## Open Questions (deferred)

- Mono-image detection when the image is not loaded: currently "unknown" is treated as
  unsupported in the property page (TODO(待确认)).
- Whether editing the colour-index table should create its own undo unit (TODO(待确认)).
- Whether the random sequence must stay stable across application versions (TODO(待确认)).
