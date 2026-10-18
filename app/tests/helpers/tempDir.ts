import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Create an OS temp directory; tests must remove it in a finally/afterEach. */
export async function makeTempDir(prefix = 'maxlabel-test-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

/** Best-effort cleanup; safe to call on an already-removed directory. */
export async function removeTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true })
}
