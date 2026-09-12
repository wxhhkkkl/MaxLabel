import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import AppErrorBoundary from './features/shell/AppErrorBoundary'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </React.StrictMode>
)
