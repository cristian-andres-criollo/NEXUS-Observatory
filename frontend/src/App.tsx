import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuth } from './context/AuthContext'
import { Dashboard } from './pages/Dashboard'
import { LoginModule } from './pages/LoginModule'
import { SettingsModule } from './pages/SettingsModule'
import { FinOpsModule } from './pages/FinOpsModule'
import { Layout } from './components/Layout'

export default function App() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" />
        <Routes>
          <Route path="*" element={<LoginModule />} />
        </Routes>
      </>
    )
  }

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/finops" element={<FinOpsModule />} />
          <Route path="/settings" element={<SettingsModule />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  )
}
