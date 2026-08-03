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
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </AuthProvider>
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 4000,
          className: 'backdrop-blur-md',
          style: {
            background: 'rgba(255, 255, 255, 0.9)',
            color: '#1e293b',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            fontFamily: '"Plus Jakarta Sans", sans-serif',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            padding: '16px 24px',
            borderRadius: '16px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
            style: {
              background: 'rgba(236, 253, 245, 0.9)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: '#065f46',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
            style: {
              background: 'rgba(254, 242, 242, 0.9)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: '#991b1b',
            },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
)
