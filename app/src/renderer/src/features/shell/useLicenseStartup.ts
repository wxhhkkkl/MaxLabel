import { useEffect } from 'react'

/** Runs the cached-license recheck without coupling startup policy to the editor shell. */
export function useLicenseStartup(serverUrlKey: string): void {
  useEffect(() => {
    let disposed = false
    void window.maxlabel.license.status().then((result) => {
      if (disposed || !result?.state?.active || !result.state.key) return
      const serverUrl = localStorage.getItem(serverUrlKey)?.trim()
      if (serverUrl) void window.maxlabel.license.check(serverUrl)
    }).catch(() => {})
    return () => { disposed = true }
  }, [serverUrlKey])
}
