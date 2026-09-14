import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

export interface AppConfig {
  skipNewWizard: boolean
}

const defaultConfig: AppConfig = { skipNewWizard: false }

function configPath(): string {
  return join(app.getPath('userData'), 'app-config.json')
}

export async function readAppConfig(): Promise<AppConfig> {
  try {
    const parsed = JSON.parse(await readFile(configPath(), 'utf8')) as Partial<AppConfig>
    return { skipNewWizard: parsed.skipNewWizard === true }
  } catch {
    return { ...defaultConfig }
  }
}

export async function saveAppConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await readAppConfig()
  const next: AppConfig = {
    ...current,
    ...(patch.skipNewWizard === undefined ? {} : { skipNewWizard: patch.skipNewWizard === true })
  }
  const target = configPath()
  const temporary = `${target}.${randomUUID()}.tmp`
  await mkdir(dirname(target), { recursive: true })
  try {
    await writeFile(temporary, JSON.stringify(next, null, 2), 'utf8')
    await rename(temporary, target)
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined)
  }
  return next
}
