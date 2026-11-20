const MAX_SNAPSHOT_ROWS = 100000
const MAX_SNAPSHOT_ROW_LENGTH = 1024 * 1024
const MAX_SNAPSHOT_BYTES = 16 * 1024 * 1024
const encoder = new TextEncoder()

/** Retain a bounded prefix and preserve the job summary even if its data does not fit. */
export class PrintLogSnapshot {
  readonly rows: string[] = []
  truncated = false
  private bytes = 2 // JSON array brackets

  append(rows: Iterable<unknown>): void {
    for (const row of rows) {
      if (this.truncated) break
      if (typeof row !== 'string') throw new Error('打印日志快照无效')
      if (this.rows.length >= MAX_SNAPSHOT_ROWS || row.length > MAX_SNAPSHOT_ROW_LENGTH) {
        this.truncated = true
        break
      }
      const bytes = encoder.encode(JSON.stringify(row)).byteLength + (this.rows.length > 0 ? 1 : 0)
      if (this.bytes + bytes > MAX_SNAPSHOT_BYTES) {
        this.truncated = true
        break
      }
      this.rows.push(row)
      this.bytes += bytes
    }
  }
}
