import type { MaxLabelAPI } from '../shared/ipcContract'

export type { MaxLabelAPI } from '../shared/ipcContract'

declare global {
  interface Window {
    maxlabel: MaxLabelAPI
  }
}
