import { expect, it, vi } from 'vitest'

vi.mock('electron', async () => (await import('../../helpers/electronMock')).createElectronMock())

import { safeStorage } from 'electron'
import { decryptSecureText, encryptSecureText } from '@main/secureJsonStore'

it('requires a Linux keyring even when basic_text reports encryption available', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')!
  Object.defineProperty(process, 'platform', { ...platform, value: 'linux' })
  try {
    vi.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true)
    vi.mocked((safeStorage as unknown as { getSelectedStorageBackend: ReturnType<typeof vi.fn> }).getSelectedStorageBackend).mockReturnValue('basic_text')
    expect(() => encryptSecureText('secret')).toThrow('系统密钥环')
    expect(() => decryptSecureText(Buffer.from('data').toString('base64'))).toThrow('系统密钥环')
    expect(safeStorage.encryptString).not.toHaveBeenCalled()
    expect(safeStorage.decryptString).not.toHaveBeenCalled()

    vi.mocked((safeStorage as unknown as { getSelectedStorageBackend: ReturnType<typeof vi.fn> }).getSelectedStorageBackend).mockReturnValue('gnome_libsecret')
    expect(decryptSecureText(encryptSecureText('secret'))).toBe('secret')
  } finally {
    Object.defineProperty(process, 'platform', platform)
  }
})
