import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { authAPI } from '../lib/api'

export type ThemeColor = 'default' | 'matrix' | 'amber' | 'purple'

interface ThemeContextType {
  theme: ThemeColor
  setTheme: (theme: ThemeColor) => Promise<void>
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth()
  const [theme, setThemeState] = useState<ThemeColor>('default')

  // Aplicar tema inicial desde el usuario o localstorage
  useEffect(() => {
    let initialTheme: ThemeColor = 'default'
    if (user?.theme_color) {
      initialTheme = user.theme_color as ThemeColor
    } else {
      const localTheme = localStorage.getItem('nexus_theme')
      if (localTheme) initialTheme = localTheme as ThemeColor
    }
    
    setThemeState(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [user?.theme_color])

  const setTheme = async (newTheme: ThemeColor) => {
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('nexus_theme', newTheme)
    
    if (user) {
      updateUser({ theme_color: newTheme })
      try {
        await authAPI.updateTheme(newTheme)
      } catch (err) {
        console.error("No se pudo guardar el tema en el backend", err)
      }
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
