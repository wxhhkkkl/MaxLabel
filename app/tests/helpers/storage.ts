export interface MemoryStorage extends Storage {
  readonly map: Map<string, string>
}

export function createMemoryStorage(initial: Record<string, string> = {}): MemoryStorage {
  const map = new Map(Object.entries(initial))
  return {
    map,
    get length() { return map.size },
    clear: () => map.clear(),
    getItem: (key) => map.has(key) ? map.get(key)! : null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => { map.delete(key) },
    setItem: (key, value) => { map.set(key, String(value)) }
  }
}

export function installMemoryStorage(initial: Record<string, string> = {}): { storage: MemoryStorage; restore: () => void } {
  const storage = createMemoryStorage(initial)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  return {
    storage,
    restore: () => {
      if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor)
      else delete (globalThis as { localStorage?: Storage }).localStorage
    }
  }
}
