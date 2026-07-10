import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Dashboard } from './pages/Dashboard'
import { ChatModule } from './pages/ChatModule'
import { ABTestingModule } from './pages/ABTestingModule'
import { LoginModule } from './pages/LoginModule'
import { SettingsModule } from './pages/SettingsModule'
import { FinOpsModule } from './pages/FinOpsModule'

export default function App() {
  const { isAuthenticated, user } = useAuth()

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="*" element={<LoginModule />} />
      </Routes>
    )
  }

  const location = useLocation();
  const path = location.pathname;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div style={{ display: path === '/' ? 'block' : 'none', height: '100%' }}>
        <Dashboard />
      </div>
      <div style={{ display: path === '/chat' ? 'block' : 'none', height: '100%' }}>
        <ChatModule />
      </div>
      <div style={{ display: path === '/ab' ? 'block' : 'none', height: '100%' }}>
        <ABTestingModule />
      </div>
      <div style={{ display: path === '/finops' ? 'block' : 'none', height: '100%' }}>
        <FinOpsModule />
      </div>
      <div style={{ display: path === '/settings' ? 'block' : 'none', height: '100%' }}>
        <SettingsModule />
      </div>
      {/* Catch all redirect equivalent */}
      {['/', '/chat', '/ab', '/finops', '/settings'].indexOf(path) === -1 && (
        <Navigate to="/" replace />
      )}
    </div>
  )
}
