import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AppUpdate from './AppUpdate'
import './styles.css'
import { applyTheme, watchSystemTheme } from './theme'
import AuthGate from './AuthGate'
import AppErrorBoundary from './AppErrorBoundary'
import SessionStorageNotice from './SessionStorageNotice'
import { captureClientError, installClientErrorLogging } from './clientErrorLogging'

applyTheme()
watchSystemTheme()
installClientErrorLogging()

ReactDOM.createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => captureClientError('react-error', error, { componentStack: errorInfo.componentStack || '' }),
  onUncaughtError: (error, errorInfo) => captureClientError('react-error', error, { componentStack: errorInfo.componentStack || '' }),
  onRecoverableError: (error, errorInfo) => captureClientError('react-error', error, { componentStack: errorInfo.componentStack || '' }),
}).render(
  <React.StrictMode><AppErrorBoundary><AppUpdate /><AuthGate><App /><SessionStorageNotice /></AuthGate></AppErrorBoundary></React.StrictMode>,
)
