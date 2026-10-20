/** Serial transport used by the scale reader; injectable for tests/simulation. */
export interface ScaleTransport {
  open(options: { port: string; baud: string }): Promise<void>
  onData(callback: (chunk: string | Buffer) => void): void
  close(): Promise<void>
}

export type ScaleTransportFactory = () => Promise<ScaleTransport>

/** Open a real serial port through the already-installed `serialport` package. */
export async function createSerialTransport(): Promise<ScaleTransport> {
  const { SerialPort } = await import('serialport')
  let port: InstanceType<typeof SerialPort> | null = null
  const listeners: Array<(chunk: string | Buffer) => void> = []
  return {
    async open(options) {
      port = new SerialPort({ path: options.port, baudRate: Number(options.baud), autoOpen: false })
      await new Promise<void>((resolve, reject) => {
        port!.open((error) => (error ? reject(error) : resolve()))
      })
      port.on('data', (chunk: Buffer) => {
        for (const listener of listeners) listener(chunk)
      })
    },
    onData(callback) {
      listeners.push(callback)
    },
    async close() {
      const current = port
      port = null
      if (!current?.isOpen) return
      await new Promise<void>((resolve) => current.close(() => resolve()))
    }
  }
}
