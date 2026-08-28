import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AppUpdate from './AppUpdate'
import './styles.css'
import { applyTheme, watchSystemTheme } from './theme'

applyTheme()
watchSystemTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AppUpdate /><App /></React.StrictMode>,
)
