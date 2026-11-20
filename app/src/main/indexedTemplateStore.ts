import { rm } from 'fs/promises'

interface BlobChange {
  added?: string
  retired?: string
}

/** Serialize index access and keep a body readable until its index reference is replaced. */
export function createIndexedTemplateStore<Store>(load: () => Promise<Store>, save: (store: Store) => Promise<void>) {
  let queue = Promise.resolve()
  const pendingRemovals = new Set<string>()

  async function discard(path: string | undefined): Promise<void> {
    if (!path) return
    try {
      await rm(path, { force: true })
      pendingRemovals.delete(path)
    } catch {
      pendingRemovals.add(path)
    }
  }

  function read<Result>(work: (store: Store) => Result | Promise<Result>): Promise<Result> {
    const task = queue.then(async () => {
      await Promise.all([...pendingRemovals].map(discard))
      return work(await load())
    })
    queue = task.then(() => {}, () => {})
    return task
  }

  function mutate<Result>(work: (store: Store, change: BlobChange) => Result | Promise<Result>): Promise<Result> {
    return read(async (store) => {
      const change: BlobChange = {}
      let result: Result
      try {
        result = await work(store, change)
        await save(store)
      } catch (error) {
        await discard(change.added)
        throw error
      }
      await discard(change.retired)
      return result
    })
  }

  return { read, mutate }
}
