import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AppUpdate from './AppUpdate'
import './styles.css'
import { applyTheme, watchSystemTheme } from './theme'
import AuthGate from './AuthGate'
import { captureClientError, installClientErrorLogging } from './clientErrorLogging'

applyTheme()
watchSystemTheme()
installClientErrorLogging()

ReactDOM.createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => captureClientError('react-error', error, { componentStack: errorInfo.componentStack || '' }),
  onUncaughtError: (error, errorInfo) => captureClientError('react-error', error, { componentStack: errorInfo.componentStack || '' }),
  onRecoverableError: (error, errorInfo) => captureClientError('react-error', error, { componentStack: errorInfo.componentStack || '' }),
}).render(
  <React.StrictMode><AppUpdate /><AuthGate><App /></AuthGate></React.StrictMode>,
)
