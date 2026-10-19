import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8')) as {
  dependencies: Record<string, string>
  build: {
    mac?: { target?: string[] }
    linux?: { target?: string[] }
    asarUnpack?: string[]
  }
}

describe('cross-platform build targets', () => {
  it('declares macOS dmg/zip and Linux AppImage/deb targets', () => {
    expect(pkg.build.mac?.target).toEqual(expect.arrayContaining(['dmg', 'zip']))
    expect(pkg.build.linux?.target).toEqual(expect.arrayContaining(['AppImage', 'deb']))
  })

  it('declares native serial/USB dependencies and unpacks them from asar', () => {
    expect(pkg.dependencies.serialport).toBeTruthy()
    expect(pkg.dependencies.usb).toBeTruthy()
    expect(pkg.build.asarUnpack?.join(' ')).toMatch(/serialport|usb/)
  })
})
