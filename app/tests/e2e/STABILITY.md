# E2E Stability Sample

**Date**: 2026-10-18
**Command**:

```bash
env -u ELECTRON_RUN_AS_NODE npx playwright test \
  tests/e2e/app-launch.spec.ts \
  tests/e2e/offline-license.spec.ts \
  tests/e2e/print-preview.spec.ts \
  tests/e2e/template-roundtrip.spec.ts \
  --repeat-each=20 --reporter=line
```

**Result**: 80/80 passed in 6.4 minutes, 0 failures, 0 retries, 1 worker, Windows 11.
The separate `spike.spec.ts` is a launch/teardown probe and is not part of the stability
sample.
