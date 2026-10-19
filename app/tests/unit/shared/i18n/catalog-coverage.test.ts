import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MENU_EN_US } from '@shared/i18n/menu.en-US'
import { PROPERTY_EN_US } from '@shared/i18n/property.en-US'
import { TOOLBAR_EN_US } from '@shared/i18n/toolbar.en-US'

const APP_ROOT = resolve(__dirname, '../../../..')
const CJK = '一-鿿'

function read(relative: string): string {
  return readFileSync(resolve(APP_ROOT, relative), 'utf8')
}

function literalCapture(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)]
    .map((match) => match[1].replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\\\/g, '\\'))
    .filter((value) => new RegExp(`[${CJK}]`).test(value))
}

/** Every user-facing string referenced through a lookup helper must exist in its catalog. */
function missingFrom(source: string, keys: Record<string, string>): string[] {
  const refs = [
    ...literalCapture(source, new RegExp(`<LText text="([^"]*[${CJK}][^"]*)"`, 'g')),
    ...literalCapture(source, new RegExp(`<MCaption text="([^"]*[${CJK}][^"]*)"`, 'g')),
    ...literalCapture(source, new RegExp(`L\\('([^']*[${CJK}][^']*)'\\)`, 'g')),
    ...literalCapture(source, new RegExp(`localizePropertyLabel\\('([^']*[${CJK}][^']*)'`, 'g')),
    ...literalCapture(source, new RegExp(`(?:label|hint)="([^"]*[${CJK}][^"]*)"`, 'g'))
  ]
  return [...new Set(refs.filter((reference) => !Object.prototype.hasOwnProperty.call(keys, reference)))]
}

function rendererSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return rendererSources(full)
    return entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') ? [full] : []
  })
}

describe('lookup catalog coverage', () => {
  it('covers every lookup reference in the renderer', () => {
    const catalogs = { ...TOOLBAR_EN_US, ...PROPERTY_EN_US }
    const files = rendererSources(resolve(APP_ROOT, 'src/renderer/src')).filter((file) => !file.endsWith('LText.tsx'))
    const missing = files.flatMap((file) => missingFrom(readFileSync(file, 'utf8'), catalogs).map((key) => `${file}: ${key}`))
    expect(missing).toEqual([])
  })

  it('covers every referenced string in the primary dialogs', () => {
    const files = [
      'src/renderer/src/dialogs/ObjectPropsDialog.tsx',
      'src/renderer/src/dialogs/DataSourceEditor.tsx',
      'src/renderer/src/editor/PropertyPanel.tsx',
      'src/renderer/src/dialogs/PrinterSettings.tsx',
      'src/renderer/src/dialogs/ExportModal.tsx'
    ]
    const missing = files.flatMap((file) => missingFrom(read(file), PROPERTY_EN_US).map((key) => `${file}: ${key}`))
    expect(missing).toEqual([])
  })

  it('covers every static menu label', () => {
    const source = read('src/renderer/src/features/commands/labelShopMenus.ts')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '')
    const labels = literalCapture(source, /'([^']*)'/g)
    const missing = [...new Set(labels.filter((label) => !Object.prototype.hasOwnProperty.call(MENU_EN_US, label)))]
    expect(missing).toEqual([])
  })

  it('covers every toolbar button and group label', () => {
    const layout = read('src/renderer/src/editor/toolbarLayout.ts')
    const toolbar = read('src/renderer/src/editor/Toolbar.tsx')
    const labels = [
      ...literalCapture(layout, /label:\s*'([^']*)'/g),
      ...literalCapture(toolbar, /title="([^"]*[一-鿿][^"]*)"/g)
    ]
    const missing = [...new Set(labels.filter((label) => !Object.prototype.hasOwnProperty.call(TOOLBAR_EN_US, label)))]
    expect(missing).toEqual([])
  })
})
