import { ipcMain as electronIpcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/ipcContract'
import { cancelScaleRead, readScale, ScaleCanceledError, ScaleError, testScale } from '../scale/serialScale'
import { assertKnownIpcChannel, secureIpcHandler } from './senderGuard'
import { validateRequestId, validateScaleReadPayload, validateScaleTestPayload } from './validation'

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** `scale:read` / `scale:test` / `scale:cancel`: serial work stays in the main process. */
export function registerScaleIpc(getWindow: () => BrowserWindow | null): void {
  const secureHandle = (channel: string, handler: Parameters<typeof electronIpcMain.handle>[1]) => {
    assertKnownIpcChannel(channel)
    return electronIpcMain.handle(channel, secureIpcHandler(getWindow, handler as never) as never)
  }

  secureHandle(IPC_CHANNELS.scaleRead, async (_event, rawPayload: unknown) => {
    let payload: ReturnType<typeof validateScaleReadPayload>
    try {
      payload = validateScaleReadPayload(rawPayload)
    } catch (error) {
      return { ok: false, messageKey: 'error.invalidPayload', message: messageOf(error) }
    }
    try {
      const reading = await readScale(payload)
      return { ok: true, reading }
    } catch (error) {
      if (error instanceof ScaleCanceledError) return { ok: false, canceled: true, message: error.message }
      if (error instanceof ScaleError) return { ok: false, messageKey: error.messageKey, message: error.message }
      return { ok: false, messageKey: 'error.scalePort', message: messageOf(error) }
    }
  })

  secureHandle(IPC_CHANNELS.scaleTest, async (_event, rawPayload: unknown) => {
    let payload: ReturnType<typeof validateScaleTestPayload>
    try {
      payload = validateScaleTestPayload(rawPayload)
    } catch (error) {
      return { ok: false, portOpened: false, frames: [], stable: false, messageKey: 'error.invalidPayload', message: messageOf(error) }
    }
    try {
      return await testScale(payload)
    } catch (error) {
      if (error instanceof ScaleError) {
        return { ok: false, portOpened: false, frames: [], stable: false, messageKey: error.messageKey, message: error.message }
      }
      return { ok: false, portOpened: false, frames: [], stable: false, messageKey: 'error.scalePort', message: messageOf(error) }
    }
  })

  secureHandle(IPC_CHANNELS.scaleCancel, async (_event, rawRequestId: unknown) => {
    try {
      return cancelScaleRead(validateRequestId(rawRequestId))
    } catch (error) {
      return { ok: false, canceled: false, message: messageOf(error), messageKey: 'error.invalidPayload' }
    }
  })
}
