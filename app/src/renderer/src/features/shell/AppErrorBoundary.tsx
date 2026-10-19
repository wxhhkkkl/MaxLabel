import { Component, type ErrorInfo, type ReactNode } from 'react'
import { translate } from '../../../../shared/i18n/translate'
import { loadOptions } from '../../dialogs/OptionsDialog'

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
    const language = loadOptions().language
    return (
      <main style={{ minHeight: '100vh', padding: 36, background: '#F4F3EE', color: '#1A1B1C', fontFamily: 'Arial, sans-serif' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>{translate(language, 'errorBoundary.title')}</h1>
        <p style={{ lineHeight: 1.6, color: '#5F6265' }}>{translate(language, 'errorBoundary.body')}</p>
        <button type="button" onClick={() => window.location.reload()} style={{ padding: '8px 18px', border: '1px solid #2E6E93', borderRadius: 6, background: '#2E6E93', color: '#fff', cursor: 'pointer' }}>{translate(language, 'errorBoundary.reload')}</button>
        <pre style={{ marginTop: 20, whiteSpace: 'pre-wrap', color: '#8A3131' }}>{this.state.error.message}</pre>
      </main>
    )
  }
}
