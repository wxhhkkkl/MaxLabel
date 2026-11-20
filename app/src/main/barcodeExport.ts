import { existsSync } from 'fs'
import { mkdir, rename, rm, writeFile } from 'fs/promises'
import { basename, dirname, extname, join, resolve } from 'path'
import { randomUUID } from 'crypto'

export async function writeBarcodeExport(dir: string, items: Array<{ name: string; dataUrl: string }>): Promise<{ count: number; warnings: string[] }> {
  const staging = join(dir, `.maxlabel-export-${randomUUID()}`)
  const outputDir = resolve(dir)
  const reserved = new Set(items.map(({ name }) => name.toLowerCase()))
  const committed: Array<{ target: string; backup?: string }> = []
  try {
    await mkdir(staging, { recursive: true })
    const staged: Array<{ source: string; target: string }> = []
    for (const item of items) {
      const requested = resolve(outputDir, item.name)
      if (dirname(requested) !== outputDir) throw new Error('条码文件名超出所选目录')
      const bytes = Buffer.from(item.dataUrl.split(',')[1], 'base64')
      let name = basename(requested)
      const extension = extname(name)
      const stem = name.slice(0, name.length - extension.length)
      let suffix = 2
      for (;;) {
        const source = join(staging, name)
        try {
          // Use the selected filesystem's own filename rules, including case folding.
          await writeFile(source, bytes, { flag: 'wx' })
          staged.push({ source, target: join(outputDir, name) })
          break
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
          do {
            const number = ` (${suffix++})`
            const ext = extension.slice(0, 254 - number.length)
            name = `${stem.slice(0, 255 - number.length - ext.length)}${number}${ext}`
          } while (reserved.has(name.toLowerCase()) || existsSync(join(outputDir, name)))
          reserved.add(name.toLowerCase())
        }
      }
    }
    for (const { source, target } of staged) {
      const backup = existsSync(target) ? `${target}.${randomUUID()}.bak` : undefined
      if (backup) await rename(target, backup)
      try {
        await rename(source, target)
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
