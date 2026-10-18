# MaxLabel tests

This tree is the new test architecture. It is being built feature by feature; see
`specs/002-test-architecture/tasks.md`.

- `unit/` — pure domain, print and renderer logic (Node).
- `contracts/` — IPC, template format, LSDX import and protocol goldens.
- `integration/` — main-process boundaries and renderer workflows with controlled mocks.
- `e2e/` — Playwright Electron journeys.
- `helpers/` — temp directories, factories and Electron mocks.

Commands:

```bash
npm test                 # typecheck + typecheck:test + Vitest unit/contracts/integration
npm run test:unit
npm run test:integration
npm run test:coverage
npm run test:e2e         # builds the app first
npm run test:legacy      # old oracle suite during the transition
```

Notes:

- Electron-based tests require `ELECTRON_RUN_AS_NODE` to be unset.
- Protocol goldens in `app/fixtures/protocol/**` are byte-exact.
- Do not add new tests to `app/scripts`; it is the legacy oracle.
- The fast gate must not import `electron`, `net`, `child_process`, `app/scripts`,
  `parity/` or `app/docs`. Integration tests that need OS/network boundaries use helpers.
- Mutation check: temporarily break a covered branch, confirm the test fails, then revert.
  A test that cannot fail is not protecting anything.
