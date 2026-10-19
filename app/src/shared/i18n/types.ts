export type Language = 'zh-CN' | 'en-US'

export type MessageParams = Record<string, string | number>

export type MessageCatalog = Record<string, string>

/** Optional additive fields on IPC results so the renderer can localize main-process errors. */
export interface IpcErrorFields {
  messageKey?: string
  messageParams?: MessageParams
}

export interface LocalizedIpcErrorLike extends IpcErrorFields {
  message: string
}
