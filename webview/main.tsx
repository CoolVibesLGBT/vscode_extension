import React from 'react'
import ReactDOM from 'react-dom/client'
import AppRoot from '@/entry/AppRoot'
import '@/index.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Missing #root element for CoolVibes webview')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
)
