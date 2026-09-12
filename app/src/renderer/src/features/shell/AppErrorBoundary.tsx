import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Keep a renderer exception recoverable instead of leaving a blank window. */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('MaxLabel renderer error', error, info)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <main style={{ minHeight: '100vh', padding: 36, background: '#F4F3EE', color: '#1A1B1C', fontFamily: 'Arial, sans-serif' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>MaxLabel 暂时无法显示当前页面</h1>
        <p style={{ lineHeight: 1.6, color: '#5F6265' }}>当前操作发生异常，未保存的编辑内容可能需要重新打开。可以尝试重新加载应用。</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '8px 18px', border: '1px solid #2E6E93', borderRadius: 6, background: '#2E6E93', color: '#fff', cursor: 'pointer' }}>重新加载</button>
        <pre style={{ marginTop: 20, whiteSpace: 'pre-wrap', color: '#8A3131' }}>{this.state.error.message}</pre>
      </main>
    )
  }
}
