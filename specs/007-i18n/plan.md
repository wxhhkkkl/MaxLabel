# Implementation Plan: Bilingual UI (Chinese/English)

**Branch**: `007-i18n` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-i18n/spec.md`

## Summary

Add a runtime Chinese/English UI to the existing Electron/React application. The work is a
presentation-layer feature: introduce a typed shared translation catalog, a renderer
language provider/hook, extend the existing `AppOptions.language` from `zh-CN` to
`zh-CN | en-US`, localize the eight in-app HelpDialog sections and the primary UI flows,
and add optional localized message keys for main-process errors. Template content, resolved
data, printer commands and protocol bytes must remain unchanged. English copy is authored
by the implementation agent and reviewed by the owner for terminology.

## Technical Context

**Language/Version**: TypeScript 5.x, React 18, Electron 44.3.0, Node.js 22.12.0

**Primary Dependencies**: Existing React/Electron/Fabric stack; no new i18n runtime
dependency. Use the built-in `Intl` APIs for UI date/number/unit formatting.

**Storage**: Existing renderer `localStorage` key `maxlabel.options` (already contains
`language`); templates and the document model remain unchanged. Main-process errors carry
optional message keys instead of persisting language state.

**Testing**: Vitest (unit/contracts/integration) and Playwright Electron (E2E), following
the existing `app/tests/` layering.

**Target Platform**: Windows 10/11 x64 primary; macOS/Linux builds follow `005-cross-platform`.

**Project Type**: Desktop application (Electron main/preload/renderer/shared).

**Performance Goals**: Language switch applies to the visible shell without a restart
(target: under 100 ms for the primary shell); no measurable print/protocol regression.
No product-level performance SLO exists in 001.

**Constraints**: Offline-capable; no translation of user-authored template content,
barcode data, printer commands, print logs or exported file names; no second print
pipeline; main-process errors must remain actionable when no translation exists.

**Scale/Scope**: Two languages, all primary UI surfaces (editor shell, menus, dialogs,
property panels, print/export/status messages), eight in-app HelpDialog sections, and
localized main-process errors on the primary flows. The parity-only detailed LabelShop
help corpus (156 HTML articles) is explicitly out of scope.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Gate | Status | Notes / remediation |
|-----------|------|--------|---------------------|
| I. 测试先行（TDD） | New behavior must have tests written first, seen failing, then implemented | **PASS** | Catalog parity/fallback/formatting tests, language persistence tests, UI E2E tests and protocol-unchanged assertions are planned before implementation. |
| II. 先澄清，不猜测 | Ambiguous scope/data/contract/state-machine changes clarified first | **PASS** | Owner confirmed English copy is agent-authored and help scope is the eight in-app sections; the parity help corpus is out of scope. |
| III. 巨大架构变更先确认 | Architecture-level changes require explicit owner approval | **PASS (bounded)** | No process-boundary or print-pipeline change. The only cross-layer change is an additive optional `messageKey`/`messageParams` field on IPC results; `message` remains for backward compatibility and the change is reversible. |
| Evidence rule | Every FR traces to code/tests | **PASS** | Each FR maps to catalog/persistence/IPC/E2E verification in `research.md` and `quickstart.md`. |
| Single geometry / pipeline | No duplicate print geometry or protocol logic | **PASS** | i18n only affects presentation; protocol builders and `ResolvedPrintScene` are untouched. |

**Post-design re-check**: unchanged. No gate violations, no complexity exceptions.

## Project Structure

### Documentation (this feature)

```text
specs/007-i18n/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── i18n-messages.md
│   └── ipc-errors.md
└── tasks.md              # generated later by /speckit-tasks
```

### Source Code (repository root)

```text
app/src/shared/i18n/
├── types.ts              # Language, message params, catalog types
├── messages.zh-CN.ts     # Chinese catalog (existing copy)
├── messages.en-US.ts     # English catalog (agent-authored)
├── translate.ts          # t(language, key, params), fallback, missing-key reporting
└── detect.ts             # first-launch language detection + normalization

app/src/renderer/src/features/i18n/
├── I18nProvider.tsx      # language context from AppOptions
└── useI18n.ts            # translate hook

app/src/renderer/src/dialogs/
├── OptionsDialog.tsx     # language union + selector (en-US added)
├── HelpDialog.tsx        # eight sections sourced from the catalog
└── ...                   # primary UI components moved to catalog keys

app/src/main/ipc/         # optional messageKey/messageParams on user-facing errors
app/tests/unit/shared/i18n/
app/tests/unit/renderer/i18n/
app/tests/integration/renderer/i18n/
app/tests/e2e/i18n.spec.ts
```

**Structure Decision**: Place the catalog and translate helper in `shared/` because both
the renderer and main process need stable keys; keep React integration in
`renderer/features/i18n/`. No new package or service is introduced.

## Phase 0 — Research

See [research.md](./research.md) for the decisions and alternatives:

- Custom typed catalog + React context, not an external i18n library.
- Existing `AppOptions.language` (localStorage) as the single preference source.
- Main-process errors use optional stable `messageKey`/`messageParams`; the raw `message`
  is retained for compatibility and logging.
- First launch follows the OS language when it is Chinese/English; otherwise Chinese.
- English copy authored by Claude, owner reviews terminology; eight HelpDialog sections
  are in scope, the parity help corpus is excluded.

## Phase 1 — Design & Contracts

- [data-model.md](./data-model.md): language preference, translation catalog/message,
  localized help section, localized IPC error.
- [contracts/i18n-messages.md](./contracts/i18n-messages.md): catalog key/shape, parity,
  interpolation and fallback rules.
- [contracts/ipc-errors.md](./contracts/ipc-errors.md): additive optional message key
  fields and backward-compatibility rules.
- [quickstart.md](./quickstart.md): manual and automated validation scenarios.

## Complexity Tracking

No constitution violations or complexity exceptions.

## Implementation Outline (for /speckit-tasks)

1. Add failing catalog/translate tests (key parity, interpolation, fallback, language
   detection) and the `AppOptions.language` normalization tests.
2. Add the shared i18n module and renderer provider/hook; extend the options UI and
   persistence; add first-launch detection.
3. Move the eight HelpDialog sections and primary UI strings into the catalog; add the
   English catalog (agent-authored) and owner terminology review notes.
4. Add optional `messageKey`/`messageParams` to the primary IPC error results; localize at
   the UI boundary with a raw-message fallback.
5. Add E2E language-switch coverage and assert protocol/template output is unchanged.
6. Run `npm test`, `npm run test:coverage`, and the Playwright E2E gate; record the
   manual bilingual checks in `quickstart.md`.
