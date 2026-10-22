import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULTS, FIXED_MALL_ORIGIN, FIXED_SERVER_URL, loadOptions, normalizeAppOptions, saveOptions } from '@/dialogs/OptionsDialog'
import { installMemoryStorage } from '../../helpers/storage'

let restore: (() => void) | null = null
afterEach(() => { restore?.(); restore = null })

describe('AppOptions normalisation and persistence', () => {
  it('returns defaults for missing values', () => {
    expect(normalizeAppOptions(undefined)).toEqual(DEFAULTS)
  })

  it('keeps valid enums, booleans and colours', () => {
    const options = normalizeAppOptions({
      language: 'en-US',
      unit: 'inch',
      printNonPrintable: false,
      deselectNonPrintable: true,
      allowScript: true,
      workspaceBg: '#ABCDEF',
      serverUrl: ' https://cloud.example.com ',
      labelShape: 'ellipse',
      defaultPrintMode: 'command',
      defaultCommandSet: 'zpl',
      defaultDpi: 300,
      useMultipleDatabaseConnections: true,
      startWithWizard: true,
      showRulers: false,
      showGrid: true,
      autoRotateOutput: true,
      autoOpenObjectProps: true,
      tableKeepSizeOnResize: true
    })
    expect(options).toMatchObject({
      language: 'en-US',
      unit: 'inch',
      printNonPrintable: false,
      deselectNonPrintable: true,
      allowScript: true,
      workspaceBg: '#ABCDEF',
      serverUrl: FIXED_SERVER_URL,
      labelShape: 'ellipse',
      defaultPrintMode: 'command',
      defaultCommandSet: 'zpl',
      defaultDpi: 300,
      useMultipleDatabaseConnections: true,
      startWithWizard: true,
      showRulers: false,
      showGrid: true,
      autoRotateOutput: true,
      autoOpenObjectProps: true,
      tableKeepSizeOnResize: true
    })
  })

  it('clamps numeric ranges and rejects invalid enum/colour values', () => {
    const options = normalizeAppOptions({
      language: 'fr-FR',
      unit: 'cm',
      workspaceBg: 'red',
      defaultLabelW: 0,
      defaultLabelH: 99999,
      labelRows: 0.9,
      labelCols: 250,
      rowGapMm: -5,
      colGapMm: 5000,
      labelShape: 'disc',
      defaultPrintMode: 'other',
      defaultCommandSet: 'other',
      defaultDpi: 600
    })
    expect(options.language).toBe('zh-CN')
    expect(options.unit).toBe('mm')
    expect(options.workspaceBg).toBe(DEFAULTS.workspaceBg)
    expect(options.defaultLabelW).toBe(1)
    expect(options.defaultLabelH).toBe(10000)
    expect(options.labelRows).toBe(1)
    expect(options.labelCols).toBe(100)
    expect(options.rowGapMm).toBe(0)
    expect(options.colGapMm).toBe(1000)
    expect(options.labelShape).toBe('rect')
    expect(options.defaultPrintMode).toBe('driver')
    expect(options.defaultCommandSet).toBe('tspl')
    expect(options.defaultDpi).toBe(600)
  })

  it('normalises toolbar groups and layout', () => {
    const options = normalizeAppOptions({
      toolbarGroups: { file: false, unknown: false },
      toolbarLayout: { order: ['help'], hidden: ['save'], keys: { print: 'Ctrl+Shift+P' } }
    })
    expect(options.toolbarGroups.file).toBe(false)
    expect(options.toolbarGroups.edit).toBe(true)
    expect(options.toolbarLayout.order[0]).toBe('help')
    expect(options.toolbarLayout.hidden).toEqual(['save'])
    expect(options.toolbarLayout.keys).toEqual({ print: 'Ctrl+Shift+P' })
  })

  it('round-trips through localStorage and mirrors the server URL', () => {
    const installed = installMemoryStorage()
    restore = installed.restore
    saveOptions({ ...DEFAULTS, language: 'en-US', unit: 'inch', serverUrl: 'https://cloud.example.com', mallBaseUrl: 'https://custom.example.com' })

    expect(JSON.parse(installed.storage.map.get('maxlabel.options')!).language).toBe('en-US')
    expect(installed.storage.map.get('maxlabel_server_url')).toBe(FIXED_SERVER_URL)

    const loaded = loadOptions()
    expect(loaded.language).toBe('en-US')
    expect(loaded.unit).toBe('inch')
    expect(loaded.serverUrl).toBe(FIXED_SERVER_URL)
    expect(loaded.mallBaseUrl).toBe(FIXED_MALL_ORIGIN)
  })

  it('falls back to defaults for corrupt stored JSON', () => {
    const installed = installMemoryStorage({ 'maxlabel.options': '{not json' })
    restore = installed.restore
    expect(loadOptions()).toEqual(DEFAULTS)
  })
})
