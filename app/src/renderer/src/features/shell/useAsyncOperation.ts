import { useCallback, useEffect, useRef } from 'react'

export interface AsyncOperation {
  id: number
  isCurrent: () => boolean
  cancel: () => void
}

/** Prevents stale preview/export/database results from mutating a newer tab state. */
export function useAsyncOperation(): () => AsyncOperation {
  const current = useRef(0)
  useEffect(() => () => { current.current += 1 }, [])
  return useCallback(() => {
    const id = ++current.current
    return {
      id,
      isCurrent: () => current.current === id,
      cancel: () => { if (current.current === id) current.current += 1 }
    }
  }, [])
}
