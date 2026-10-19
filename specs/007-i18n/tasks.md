---
description: "Task list for bilingual UI implementation"
---

# Tasks: Bilingual UI (Chinese/English)

**Input**: Design documents from `specs/007-i18n/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Required (project constitution). Catalog/translate/options tests are written and
seen failing before implementation; each story adds its own automated coverage.

**Organization**: Tasks are grouped by user story so each story is independently testable.
US1 is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: `[US1]` … `[US3]` for user-story phases only
- Every task names an exact file path or command

## Phase 1: Setup (Tests and Scaffolding)

**Purpose**: Establish the red tests and the catalog test helpers before implementation.

- [X] T001 [P] Write failing catalog/translate unit tests in `app/tests/unit/shared/i18n/translate.test.ts` covering key parity, placeholder interpolation/parity, empty/missing fallback and language normalization.
- [X] T002 [P] Write failing options/language tests in `app/tests/unit/renderer/options-i18n.test.ts` covering `en-US` normalization, unknown→`zh-CN`, persistence and first-launch OS detection.
- [X] T003 [P] Write failing IPC error localization contract tests in `app/tests/contracts/i18n-ipc-errors.test.ts` for optional `messageKey`/`messageParams` and raw-message fallback.
- [X] T004 [P] Add the E2E skeleton in `app/tests/e2e/i18n.spec.ts` for language switch, HelpDialog, persistence and output-unchanged scenarios.

**Checkpoint**: The red tests fail for the intended reasons (missing modules/behavior), not setup errors.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared catalog, translation runtime, language preference and IPC message-key
infrastructure that all stories need.

- [X] T005 Create `app/src/shared/i18n/types.ts` with `Language = 'zh-CN' | 'en-US'`, message-key and parameter types.
- [X] T006 Create the initial catalogs `app/src/shared/i18n/messages.zh-CN.ts` and `app/src/shared/i18n/messages.en-US.ts` with the same key set for the shell and help surfaces.
- [X] T007 Implement `app/src/shared/i18n/translate.ts` (`t(language,key,params)`, named interpolation, active→zh-CN→key fallback, missing-key reporting) so T001 passes.
- [X] T008 Implement `app/src/shared/i18n/detect.ts` (OS-language detection and normalization) so the detection cases in T002 pass.
- [X] T009 Extend `AppOptions.language` and `normalizeAppOptions` in `app/src/renderer/src/dialogs/OptionsDialog.tsx` to accept `en-US`; add the English option to the existing language selector and persist it through `loadOptions`/`saveOptions`.
- [X] T010 Implement `app/src/renderer/src/features/i18n/I18nProvider.tsx` and `app/src/renderer/src/features/i18n/useI18n.ts` reading the active language from options.
- [X] T011 Wire the provider at the app root in `app/src/renderer/src/App.tsx` so all renderer screens can translate.
- [X] T012 Implement the catalog completeness checker in `app/src/shared/i18n/completeness.ts` and make `app/tests/unit/shared/i18n/completeness.test.ts` enforce key/empty/placeholder/help-section parity.
- [X] T013 Add optional `messageKey`/`messageParams` to IPC results in `app/src/shared/ipcContract.ts` and the primary handlers (`app/src/main/ipc/validation.ts`, `registerPrintIpc.ts`, `registerTemplateIpc.ts`, license IPC), keeping the existing `message` unchanged.

**Checkpoint**: Catalog/translate tests pass; the language selector persists; the IPC error fields are additive and backward-compatible.

## Phase 3: User Story 1 - English core journey (Priority: P1) 🎯 MVP

**Goal**: An English-speaking operator can complete the core new-label → preview → print
journey with no Chinese-only UI text.

**Independent Test**: Switch to English, complete a new-label → preview → print flow, and
verify the UI is translated while the printed/protocol output is unchanged.

### Implementation for User Story 1

- [X] T014 [P] [US1] Move shell/menu/toolbar/status strings into the catalog: `app/src/renderer/src/features/commands/labelShopMenus.ts`, `app/src/renderer/src/editor/Toolbar.tsx`, `app/src/renderer/src/editor/StatusBar.tsx`, `app/src/renderer/src/App.tsx`.
- [X] T015 [P] [US1] Move editor/property/print-dock strings into the catalog: `app/src/renderer/src/editor/LabelEditor.tsx`, `app/src/renderer/src/editor/PropertyPanel.tsx`, `app/src/renderer/src/dialogs/ObjectPropsDialog.tsx`, `app/src/renderer/src/editor/PrintDock.tsx`, `app/src/renderer/src/dialogs/PrintDialog.tsx`.
- [X] T016 [P] [US1] Move printer settings, export and print-status strings into the catalog: `app/src/renderer/src/dialogs/PrinterSettings.tsx`, `app/src/renderer/src/dialogs/ExportModal.tsx`, `app/src/renderer/src/features/printing/printExecutor.ts`, `app/src/renderer/src/features/exporting/barcodeExport.ts`.
- [X] T017 [US1] Add agent-authored English values for every US1 key in `app/src/shared/i18n/messages.en-US.ts`; keep keys/placeholders aligned with `messages.zh-CN.ts`.
- [X] T018 [US1] Localize primary IPC errors at the UI boundary using `messageKey`/`messageParams` with raw-message fallback in `app/src/renderer/src/features/shell/useLicenseStartup.ts` and the print/template error paths.
- [X] T019 [P] [US1] Add integration coverage for IPC error localization in `app/tests/integration/renderer/i18n-errors.test.ts` (translated key, missing key, raw fallback).
- [X] T020 [US1] Extend `app/tests/e2e/i18n.spec.ts` to switch to English and complete the core label → preview → print flow, asserting no Chinese-only UI labels or raw keys.
- [X] T021 [US1] Add a regression assertion in `app/tests/e2e/i18n.spec.ts` that resolved data, printer settings, protocol output and print-log snapshots are unchanged by the language switch.

**Checkpoint**: US1 is fully usable in English; the print pipeline and protocol goldens are unchanged.

## Phase 4: User Story 2 - Switch, persist and format (Priority: P2)

**Goal**: The language choice is persistent, OS-aware on first launch, and locale formatting
affects display only.

**Independent Test**: Switch language, restart, and verify the preference; verify formatted
display values do not change stored/printed values.

### Tests for User Story 2

- [X] T022 [P] [US2] Extend `app/tests/unit/renderer/i18n-format.test.ts` and `app/tests/e2e/i18n.spec.ts` with persistence, first-launch OS detection and locale-formatting cases.

### Implementation for User Story 2

- [X] T023 [US2] Implement locale display helpers in `app/src/renderer/src/features/i18n/format.ts` (`Intl` date/number/unit labels) and use them in status/history/dialogs without changing data-source parsing.
- [X] T024 [US2] Verify/implement immediate language application and state preservation (document, selection, undo/redo, dirty state, printer settings) in `app/src/renderer/src/features/i18n/I18nProvider.tsx` and `app/src/renderer/src/dialogs/OptionsDialog.tsx`.
- [X] T025 [US2] Wire first-launch OS detection and persistence in `app/src/renderer/src/dialogs/OptionsDialog.tsx` using `app/src/shared/i18n/detect.ts`.
- [X] T026 [US2] Add assertions in `app/tests/e2e/i18n.spec.ts` that templates, print logs and exported file names/content do not change with the UI language.
- [X] T027 [US2] Update `app/tests/INDEX.md` and `app/tests/README.md` with the new i18n tests.

**Checkpoint**: US1 and US2 work independently; the preference survives restart and output remains canonical.

## Phase 5: User Story 3 - Missing translations and layout quality (Priority: P3)

**Goal**: Missing keys fall back safely and the English UI remains usable at supported
window sizes, including the eight HelpDialog sections.

**Independent Test**: Remove/empty a key, inspect the fallback; open HelpDialog and resize
primary dialogs in both languages.

### Tests for User Story 3

- [X] T028 [P] [US3] Extend `app/tests/unit/shared/i18n/completeness.test.ts` and `app/tests/e2e/i18n.spec.ts` with missing/empty-key fallback, HelpDialog section coverage and minimum-window layout checks.

### Implementation for User Story 3

- [X] T029 [US3] Implement missing/empty-key reporting and development logging in `app/src/shared/i18n/translate.ts`; ensure the UI shows the Chinese fallback, never a blank control or raw key.
- [X] T030 [US3] Move the eight HelpDialog sections (title/intro/item title/body) into the catalog and add English copy in `app/src/renderer/src/dialogs/HelpDialog.tsx` and `app/src/shared/i18n/messages.en-US.ts`.
- [X] T031 [US3] Fix any English layout overflow/truncation in `app/src/renderer/src/dialogs/OptionsDialog.tsx`, `PrinterSettings.tsx`, `PrintDialog.tsx` and `HelpDialog.tsx`; make the E2E minimum-window checks pass.
- [X] T032 [US3] Record the fallback and layout validation results in `specs/007-i18n/quickstart.md`.

**Checkpoint**: All three stories are independently functional; missing translations and layout are safe.

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T033 [P] Update `app/tests/INDEX.md` and `app/tests/README.md` for the final i18n coverage.
- [X] T034 Run the full gate: `npm test`, `npm run test:coverage`, and `env -u ELECTRON_RUN_AS_NODE npm run test:e2e`; record results in `specs/007-i18n/quickstart.md`.
- [ ] T035 Run the manual bilingual validation (V-01–V-05) and owner terminology review; update `specs/007-i18n/spec.md`/`plan.md` only for confirmed changes.
- [X] T036 Commit with `git add specs/007-i18n app && git commit`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → no dependencies.
- **Foundational (Phase 2)** → depends on Setup; blocks all stories.
- **US1 (Phase 3)** → depends on Foundational; MVP.
- **US2 (Phase 4)** → depends on Foundational; can run in parallel with US1, but US1's catalog keys are needed for the full UI.
- **US3 (Phase 5)** → depends on Foundational and the HelpDialog/catalog work from US1.
- **Polish (Phase 6)** → depends on the desired stories.

### Within Each User Story

- Tests first, seen failing, then implementation.
- Catalog/translation foundation before screen migration.
- HelpDialog catalog migration before its E2E/layout checks.
- No print-pipeline or template-format changes.

### Parallel Opportunities

- T001–T004 (tests/scaffolding).
- T014–T016 (different UI areas).
- T019 and T022/T028 test additions.
- T033 documentation and T034 gate can run after implementation.

## Parallel Example: User Story 1

```text
T014  shell/menu/toolbar/status strings
T015  editor/property/print-dock strings
T016  printer/export/print-status strings
```

## Implementation Strategy

### MVP First

1. Setup + Foundational (T001–T013).
2. US1 (T014–T021).
3. **STOP and VALIDATE**: English core journey + unchanged print output.

### Incremental Delivery

1. US1 → English core journey.
2. US2 → persistence and locale-aware display.
3. US3 → missing-key fallback, HelpDialog and layout quality.
4. Polish → full gate and manual bilingual review.

### Safety Rules

- Do not translate user-authored template content, barcode data, printer commands, print
  logs or exported file names.
- Do not change `ResolvedPrintScene`, `PrintPlan`, protocol builders or template formats.
- Keep `message` on IPC errors; `messageKey` is additive and optional.
- Missing translations must fall back to Chinese, never blank controls or raw keys.
- English copy is agent-authored; owner reviews product terminology.

## Notes

- Tests are required by the constitution even though the template marks them optional.
- The parity-only detailed LabelShop help corpus is out of scope.
- Language preference is stored in `maxlabel.options`, not in templates.
- No new i18n runtime dependency; use the shared catalog, React context and `Intl`.

## Phase 7: Convergence

- [X] T037 Complete the English lookup catalogs: add the ~163 missing `PROPERTY_EN_US` entries and wrap the remaining option/legend/hint text nodes in `ObjectPropsDialog`, `DataSourceEditor`, `PropertyPanel` and `PrinterSettings` per FR-004/SC-002 (partial).
- [X] T038 Translate the secondary dialogs and panels through the shared catalog: `NewLabelDialog`, `CustomLabelFormatDialog`, `LicenseDialog`, `CloudDialog`, `ObjectInfoPopup`, `PrintAdvancedDialog`, `TemplateLibDialog`, `TemplateWizardDialog`, `AboutDialog`, `FeedbackDialog`, `GetStartedDialog`, `TemplatePropsDialog`, `DataPanel`, `KeyInputOrderDialog`, `PrintersInstallDialog`, `ChangeDataDialog`, `CustomizeToolbarDialog`, `MoreDialogs`, `PaperFields` and `paperHoleFields` per FR-004 (missing).
- [X] T039 Add the missing menu labels to `MENU_EN_US` and localize the remaining editor chrome (`toolbarLayout.ts` labels, `AlignBar`, `FormatBar`, `LayerPanel`, `WorkArea`) per FR-004/US1/AC2 (partial).
- [X] T040 Add optional `messageKey`/`messageParams` to the license IPC results (`license:status`, `license:activate`, `license:check`) and resolve them in `LicenseDialog` with raw-message fallback per FR-010 and plan D-003 (partial).
- [X] T041 Extend the E2E minimum-window layout checks to the English `PrinterSettings`, `PrintDialog` and `ObjectPropsDialog` per FR-009/SC-005 (partial).
- [X] T042 Align the lookup catalogs with `contracts/i18n-messages.md` by converting `MENU_EN_US`, `TOOLBAR_EN_US` and `PROPERTY_EN_US` to dotted-key entries, or record an owner-approved contract exception per contracts/i18n-messages (contradicts).
- [X] T043 Translate the remaining static StartPage navigation/promotional UI copy, leaving news article bodies as content per FR-004 (partial).
- [X] T044 Extend the completeness gate to the menu/toolbar/property lookup maps and add no-CJK E2E assertions for the primary dialogs per FR-013/SC-002 (partial).

## Phase 8: Convergence

- [X] T045 Localize the barcode data tab (`BarcodeDataFields`), the `BARCODE_TYPES` symbology labels and the `barcodeSpecRows` labels/values, and extend the coverage gate to see data-array strings per FR-004/SC-002 (partial).
- [X] T046 Thread the active language/translator into `useDocumentCommands`, `useEditorTransformCommands`, `useDocumentHistory`, `useDataManagement`, `documentPersistence`, `useCommandExportWorkflow`, `printPreviewService`, `labelSpec` and `TransientModals`, and localize every user-facing status message per FR-004/US1/AC1 (partial).
- [X] T047 Add stable message keys/structured errors for user-visible import/print/render failures in `lsdxImport`, `dataImport`, `imageValidation`, `renderLabel`, `vectorBarcode`, `bitmapSource`, `driverPage`, `fabricObjects`, `editor/barcode`, `operations` and `msdx`; localize at the UI boundary and keep raw text for logs per FR-004/FR-010 (partial).
- [X] T048 Add optional `messageKey`/`messageParams` to the `cloud.*`, `cloudCredentials.*` and `db.*` IPC results and resolve them in `CloudDialog` and `DataPanel` with raw-message fallback per FR-010 and plan D-003 (partial).
- [X] T049 Store a canonical or empty default cloud category instead of the localized `L('未分类')` so the UI language cannot change cloud metadata per FR-007 (partial).
- [X] T050 Format the license expiry and cloud/template timestamps with `formatDateTime(..., language)` from the active locale per FR-006 (partial).
- [X] T051 Translate the StartPage news titles/summaries or record an explicit content exception in the spec/quickstart per FR-004 (partial).
- [X] T052 Extend `catalog-coverage.test.ts` (or add a source audit) to detect raw CJK strings in user-facing `setStatus`/`setMsg`/data-array positions so future gaps fail the fast gate per FR-013/SC-002 (partial).
