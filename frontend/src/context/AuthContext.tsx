import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'

interface UserData {
  email: string
  role: string
  plan?: string    // "free" | "enterprise"
  viewed_context_tabs?: string
  theme_color?: string
  full_name?: string
  name?: string
  profile_picture?: string
  custom_ai_instructions?: string
  language?: string
  currency?: string
  budget_alert_threshold?: number
  email_alerts?: boolean
  hardware_specs?: string
  two_factor_enabled?: boolean
}

interface AuthContextType {
  user: UserData | null
  token: string | null
  login: (token: string, user: UserData) => void
  updateUser: (data: Partial<UserData>) => void
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/** Lee el token de forma síncrona al inicializar — sin estado de "loading" */
function readStoredToken(): string | null {
  try {
    return localStorage.getItem('nexus_token')
  } catch {
    return null
  }
}

/** Lee el usuario de forma síncrona al inicializar */
function readStoredUser(): UserData | null {
  try {
    const raw = localStorage.getItem('nexus_user')
    return raw ? (JSON.parse(raw) as UserData) : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Lazy initializers: se ejecutan UNA vez de forma síncrona → sin flash de pantalla blanca
  const [token, setToken] = useState<string | null>(readStoredToken)
  const [user, setUser] = useState<UserData | null>(readStoredUser)

  const login = useCallback((newToken: string, userData: UserData) => {
    try {
      localStorage.setItem('nexus_token', newToken)
      localStorage.setItem('nexus_user', JSON.stringify(userData))
    } catch {
      console.warn('[AuthContext] No se pudo persistir sesión en localStorage')
    }
    setToken(newToken)
    setUser(userData)
  }, [])

  const updateUser = useCallback((data: Partial<UserData>) => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, ...data }
      try {
        localStorage.setItem('nexus_user', JSON.stringify(updated))
      } catch {}
      return updated
    })
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem('nexus_token')
      localStorage.removeItem('nexus_user')
    } catch {
      console.warn('[AuthContext] Error limpiando localStorage')
    }
    setToken(null)
    setUser(null)
  }, [])

  // Apply theme class to document
  useEffect(() => {
    if (user?.theme_color === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.theme_color]);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
