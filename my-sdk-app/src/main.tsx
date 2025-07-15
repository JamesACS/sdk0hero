import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@xterm/xterm/css/xterm.css'
import App from './App.tsx'

// Add global error handling for WebSocket/DataView errors
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  
  // Check if it's a DataView error from CodeSandbox SDK
  if (event.reason?.message?.includes('DataView') || 
      event.reason?.message?.includes('Offset is outside the bounds')) {
    console.warn('CodeSandbox SDK WebSocket error detected. This may be a transient issue.')
    
    // Prevent the error from crashing the app
    event.preventDefault()
    
    // You could dispatch a custom event here to notify components
    window.dispatchEvent(new CustomEvent('codesandbox-connection-error', {
      detail: { error: event.reason }
    }))
  }
})

// Add global error handling for regular errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
  
  // Check if it's a DataView error from CodeSandbox SDK
  if (event.error?.message?.includes('DataView') || 
      event.error?.message?.includes('Offset is outside the bounds')) {
    console.warn('CodeSandbox SDK WebSocket error detected. This may be a transient issue.')
    
    // Prevent the error from crashing the app
    event.preventDefault()
    
    // You could dispatch a custom event here to notify components
    window.dispatchEvent(new CustomEvent('codesandbox-connection-error', {
      detail: { error: event.error }
    }))
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
