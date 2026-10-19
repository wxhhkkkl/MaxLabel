import { describe, expect, it } from 'vitest'
import type { PrintTransportResult } from '@shared/ipcContract'
import { localizeIpcMessage } from '@shared/i18n/translate'

describe('localized IPC errors', () => {
  it('keeps the optional message key fields backward-compatible', () => {
    const result: PrintTransportResult = {
      ok: false,
      status: 'failed',
      message: 'raw failure',
      messageKey: 'error.generic',
      messageParams: { operation: 'print' }
    }
    expect(result.message).toBe('raw failure')
    expect(result.messageKey).toBe('error.generic')
  })

  it('resolves a translated key, then the raw message, then an empty message', () => {
    expect(localizeIpcMessage('en-US', { message: 'raw failure', messageKey: 'error.generic' })).toBe('Operation failed')
    expect(localizeIpcMessage('en-US', { message: 'raw failure' })).toBe('raw failure')
    expect(localizeIpcMessage('en-US', { message: 'raw failure', messageKey: 'missing.key' })).toBe('raw failure')
    expect(localizeIpcMessage('en-US', { message: '', messageKey: 'error.generic' })).toBe('Operation failed')
  })
})
