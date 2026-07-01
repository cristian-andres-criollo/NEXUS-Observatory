import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0a1628',
            color: '#c8deff',
            border: '1px solid rgba(14,74,255,0.4)',
            fontFamily: '"Rajdhani", sans-serif',
            fontSize: '14px',
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
