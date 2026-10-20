# Feature Specification: Bilingual UI (Chinese/English)

**Feature Branch**: `007-i18n`

**Created**: 2026-10-19

**Status**: Implemented (automated verification complete; manual bilingual validation T035 and owner terminology review pending, 2026-10-20)

**Input**: User description: "中英双语界面：为 MaxLabel 桌面端增加语言切换（中文/英文）。当前 UI 文案、菜单、对话框、帮助、状态栏、打印/导出提示均硬编码中文；需要可维护的文案资源、运行时语言切换、语言偏好持久化、日期/数字/重量单位格式随语言变化，并保证模板内容、打印输出和协议命令不因界面语言改变。目标用户为通用中小企业，owner 已确认中英双语是后续目标。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - English-speaking operator completes the core design/print journey (Priority: P1)

An operator who prefers English opens MaxLabel, switches the interface to English, creates a
label with text and a barcode, opens print preview and submits a print job. All menus,
dialogs, status messages, validation errors and print/export prompts are readable in
English; the label content and printer output are unchanged.

**Why this priority**: The core edit → preview → print path is the product's primary value.
If this journey is not fully usable in English, adding more translated screens has little
value.

**Independent Test**: Switch to English, complete a new-label → preview → print flow, and
verify that no Chinese-only user-facing text appears and the printed/protocol output is
identical to the Chinese run.

**Acceptance Scenarios**:

1. **Given** the application is running with the Chinese UI, **When** the user selects
   English, **Then** menus, toolbars, property panels, dialogs, status bar and
   validation/print/export messages update without restarting the application.
2. **Given** the English UI is active, **When** the user creates and prints a label,
   **Then** the primary journey is fully usable in English and no raw translation keys or
   untranslated Chinese UI labels are shown.
3. **Given** the same document is printed once in Chinese and once in English, **When**
   the two outputs are compared, **Then** the document content, resolved data, printer
   settings, protocol bytes and log snapshots are identical.

---

### User Story 2 - Operator switches languages per task and keeps preferences (Priority: P2)

An operator works with mixed Chinese/English colleagues or customers and switches the UI
language between sessions. The application remembers the choice, follows the operating
system language on first launch when no preference exists, and formats dates, numbers and
weight units according to the active locale without altering stored document values.

**Why this priority**: A language switch is only useful if it is discoverable, persistent
and does not corrupt data or change printed results.

**Independent Test**: Change the language, restart the application, and verify the
preference is restored and that locale-formatted values do not change the underlying
document or print output.

**Acceptance Scenarios**:

1. **Given** no saved language preference, **When** the application starts, **Then** it
   uses the operating system language when it is Chinese or English and otherwise falls
   back to Chinese.
2. **Given** the user selects English, **When** the application is restarted, **Then**
   the English UI is restored.
3. **Given** a document contains dates, numbers and weights, **When** the UI language
   changes, **Then** only their display formatting changes; stored values, template
   content and printed output remain unchanged.

---

### User Story 3 - Missing translation and layout quality are visible and safe (Priority: P3)

A reviewer checks both languages for missing strings and layout problems. Missing
translations fall back predictably instead of blanking controls, and longer English labels
do not overlap or truncate critical actions in the supported desktop window sizes.

**Why this priority**: Translation completeness and layout quality determine whether the
English UI is actually usable, but they can be hardened after the primary journey works.

**Independent Test**: Force a missing translation key, inspect the affected screen, and
resize the primary dialogs to the supported minimum size in both languages.

**Acceptance Scenarios**:

1. **Given** a translation key is missing in the active language, **When** the screen is
   rendered, **Then** a documented fallback language is shown and the missing key is
   logged/reported for translators; the control remains operable.
2. **Given** English is active, **When** the primary dialogs are shown at the supported
   minimum window size, **Then** labels, buttons and validation messages do not overlap
   or hide required actions.

---

### Edge Cases

- The user changes the language while a document has unsaved changes: the document,
  selection, undo/redo history, dirty state and printer settings must be preserved.
- The user changes the language while a print/preview/export operation is running: the
  in-flight operation must continue and report its final status in a consistent language.
- A template was saved under one UI language and opened under the other: template content
  and metadata must not be translated or rewritten.
- A translation key exists but is empty: treat it as missing and use the fallback rather
  than displaying a blank label.
- A user enters localized decimal separators or localized date text into a data source:
  stored/normalized values must remain unambiguous and print output must not change
  because of the UI language.
- Help content has no translation for the active language: the application must show a
  clear fallback or language-specific help, not an empty help window.
- The operating system language is neither Chinese nor English: the application falls back
  to Chinese as the documented default.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST offer a user-selectable interface language with Chinese
  and English as the supported values.
- **FR-002**: Language changes MUST apply at runtime without restarting the application.
- **FR-003**: The application MUST persist the language preference per user profile and
  apply it at the next launch; with no saved preference it MUST use the OS language when
  it is Chinese or English and otherwise fall back to Chinese.
- **FR-004**: All user-facing strings in menus, toolbars, property panels, dialogs, status
  bar, validation errors, print/export prompts and help navigation MUST come from a
  maintainable translation catalog; no user-facing string may be hard-coded in a screen.
- **FR-005**: Missing or empty translations MUST fall back to a documented language and
  MUST be reported/logged for translator follow-up; controls MUST remain operable.
- **FR-006**: Date, time, number and weight-unit display in the UI MUST follow the active
  language's locale conventions, while stored values and print output remain canonical.
- **FR-007**: UI language MUST NOT change template content, resolved data, barcode data,
  printer commands, print logs or exported file names/content.
- **FR-008**: Changing the language MUST NOT modify the document, selection, undo/redo
  history, dirty state or printer settings.
- **FR-009**: The English UI MUST remain usable at the current supported desktop window
  sizes; critical actions and validation messages MUST NOT overlap, truncate or disappear
  because English text is longer.
- **FR-010**: Main-process errors surfaced to the user MUST be localizable (translated at
  the UI boundary or mapped from stable message codes); users MUST NOT see raw internal
  keys or untranslated main-process errors.
- **FR-011**: The in-app HelpDialog and help navigation MUST be available in the active
  language; if a help surface has no translation, the UI MUST show a clear fallback or
  link to the available language rather than an empty window. The detailed LabelShop help
  article corpus is out of scope for this feature.
- **FR-012**: The language preference MUST be stored outside templates so templates remain
  portable between users and languages.
- **FR-013**: A translation-completeness check MUST be runnable before release and MUST
  report missing keys and untranslated placeholders.

### Key Entities *(include if feature involves data)*

- **Language Preference**: The selected interface language per user profile, with a
  documented default and persistence across restarts.
- **Translation Catalog**: The set of user-facing message keys and their Chinese/English
  values, including fallback metadata.
- **Localized Message**: A stable key plus parameters that is rendered in the active
  language at the UI boundary; used for both renderer and main-process errors.
- **Locale Formatting Rules**: Display conventions for dates, times, numbers and weight
  units; these affect presentation only, not stored or printed values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can switch to English and complete the primary new-label → preview →
  print journey without restarting and without seeing untranslated UI text.
- **SC-002**: 100% of user-facing strings in the primary flows (editor, print, export,
  printer settings, license/help navigation) and all eight in-app HelpDialog sections
  have Chinese and English values, verified by the translation-completeness check.
- **SC-003**: Printing the same document under Chinese and English produces byte-identical
  protocol output and identical resolved-data snapshots.
- **SC-004**: Switching language preserves the document, selection, history, dirty state
  and printer settings in 100% of tested cases.
- **SC-005**: The primary dialogs show no overlapping or hidden critical actions at the
  supported minimum window size in either language.
- **SC-006**: The selected language is restored after restart in 100% of tested cases.

## Assumptions

- Chinese and English are the only supported languages in this feature; other languages
  and right-to-left layouts are out of scope.
- English translations are produced by the implementation agent (Claude) and reviewed by
  the owner for product terminology; they are stored as first-class catalog entries, not
  generated at runtime.
- Help scope is limited to the in-app HelpDialog (eight sections: quick start, object
  design, data sources, database, printing, printer installation, shortcuts and FAQ) and
  help navigation. The detailed LabelShop help corpus is not part of this feature.
- At the start of this feature the UI was Chinese-only; this feature does not translate
  user-authored template content, barcode data or printer commands.
- Help article content may be delivered as language-specific documents; the application is
  responsible for selecting the active language and showing a fallback when an article is
  unavailable.
- The language preference is per user profile/application installation, not per template.
- The existing label geometry, data-source values and print pipeline remain unchanged;
  this is a presentation-layer feature.

## Current Help Inventory (2026-10-19)

- The in-app HelpDialog contains eight hard-coded Chinese sections (quick start, object
  design, data sources, database, printing, printer installation, shortcuts, FAQ). These
  are in scope.
- The detailed LabelShop help corpus exists only on the `parity` branch: 156 HTML
  articles, 230 PNG images, 4 GIF images and 1 help index file. It is not present in
  `main` and is not packaged; `help:open` falls back to the external website when it is
  absent. Translating this corpus is explicitly out of scope for 007 and can be a
  separate content feature if needed.
