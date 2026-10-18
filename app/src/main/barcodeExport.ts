import { existsSync } from 'fs'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { dirname, join, resolve } from 'path'
import { randomUUID } from 'crypto'

export async function writeBarcodeExport(dir: string, items: Array<{ name: string; dataUrl: string }>): Promise<{ count: number; warnings: string[] }> {
  const staging = join(dir, `.maxlabel-export-${randomUUID()}`)
  const committed: Array<{ target: string; backup?: string }> = []
  try {
    await mkdir(staging, { recursive: true })
    for (const item of items) await writeFile(join(staging, item.name), Buffer.from(item.dataUrl.split(',')[1], 'base64'))
    for (const item of items) {
      const target = resolve(dir, item.name)
      if (dirname(target) !== resolve(dir)) throw new Error('条码文件名超出所选目录')
      const backup = existsSync(target) ? `${target}.${randomUUID()}.bak` : undefined
      if (backup) await rename(target, backup)
      try {
        await rename(join(staging, item.name), target)
        committed.push({ target, backup })
      } catch (error) {
        if (backup) await rename(backup, target).catch(() => {})
        throw error
      }
    }
  } catch (error) {
    for (const entry of committed.reverse()) {
      await rm(entry.target, { force: true }).catch(() => {})
      if (entry.backup) await rename(entry.backup, entry.target).catch(() => {})
    }
    throw error
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
  }
  // Commit is complete. Backup housekeeping must never undo committed files.
  const warnings: string[] = []
  for (const entry of committed) {
    if (!entry.backup) continue
    try { await rm(entry.backup, { force: true }) }
    catch { warnings.push(entry.backup) }
  }
  return { count: committed.length, warnings }
}
