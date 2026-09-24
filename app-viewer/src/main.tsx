/**
 * ============================================================================
 * Desktop Viewer React DOM Entry Point
 * ============================================================================
 * Enterprise Architecture Strategy: Strict Mode Virtual DOM Mounting.
 * Mounts the root React component into the DOM tree with StrictMode checks enabled.
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
