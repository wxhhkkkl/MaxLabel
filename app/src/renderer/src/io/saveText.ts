/** 「另存为」载荷：正文按字符串原样传给主进程（UTF-8 写盘）。 */
export interface TextFilePayload {
  name: string
  content: string
}

export function textFilePayload(name: string, content: string): TextFilePayload {
  return { name, content }
}
