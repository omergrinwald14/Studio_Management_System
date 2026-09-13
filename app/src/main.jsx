import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { readTheme, applyTheme } from './lib/theme'

// Before the first render, so a chosen light theme never flashes dark first.
applyTheme(readTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
