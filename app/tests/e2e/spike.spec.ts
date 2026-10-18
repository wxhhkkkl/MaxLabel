import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test, expect } from '@playwright/test'
import { _electron as electron, type ElectronApplication } from 'playwright'

const appRoot = resolve(__dirname, '../..')

function childEnv(appDataDir: string): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)
  )
  delete env.ELECTRON_RUN_AS_NODE
  env.APPDATA = appDataDir
  return env
}

test('@spike launches the built app with an isolated profile', async () => {
  test.setTimeout(60_000)
  const userDataRoot = await mkdtemp(join(tmpdir(), 'maxlabel-e2e-'))
  let electronApp: ElectronApplication | undefined

  try {
    electronApp = await electron.launch({
      cwd: appRoot,
      args: ['.', `--user-data-dir=${join(userDataRoot, 'chromium')}`],
      env: childEnv(userDataRoot),
      timeout: 30_000
    })

    const window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    const userData = await electronApp.evaluate(({ app }) => app.getPath('userData'))
    console.log(`[spike] userData=${userData}`)
    console.log(`[spike] title=${await window.title()}`)

    await window.screenshot({ path: test.info().outputPath('spike.png') })

    expect(userData.toLowerCase()).toContain('maxlabel-e2e-')
    expect(await window.title()).toBeTruthy()
    await electronApp.evaluate(({ app }) => app.exit(0))
  } finally {
    if (electronApp) {
      const child = electronApp.process()
      if (child && !child.killed) {
        await Promise.race([
          new Promise<void>((resolveExit) => child.once('exit', () => resolveExit())),
          new Promise<void>((resolveTimeout) => setTimeout(resolveTimeout, 3_000))
        ])
        if (!child.killed) child.kill()
      }
    }
    await rm(userDataRoot, { recursive: true, force: true }).catch(() => undefined)
  }
})
