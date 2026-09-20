/** Shared resource limits used by renderer and main-process IPC validation. */
export const MAX_PREVIEW_PAGES = 200
export const MAX_PREVIEW_DATA_BYTES = 128 * 1024 * 1024
export const MAX_DRIVER_DATA_BYTES = 128 * 1024 * 1024
/** 防止异常 DPI/尺寸组合在浏览器中分配失控的画布。 */
export const MAX_RENDER_PIXELS = 40_000_000
export const MAX_IMAGE_DECOMPRESSED_BYTES = 32 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 40_000_000
/** 打印机「工具」页「发送文件到打印机」允许的单文件上限（指令/固件文件都很小）。 */
export const MAX_COMMAND_FILE_BYTES = 16 * 1024 * 1024
