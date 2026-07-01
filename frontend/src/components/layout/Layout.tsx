import React, { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Menu } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
  title: string
  subtitle?: string
  noPadding?: boolean
}

export function Layout({ children, title, subtitle, noPadding }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <div className="flex w-screen h-screen bg-nexus-black overflow-hidden relative">
      {/* ─── Aurora Mesh Background (Dinámico) ─────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-nexus-blue/20 blur-[120px] mix-blend-screen animate-float opacity-70" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-nexus-cyan/15 blur-[150px] mix-blend-screen animate-float opacity-60" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[40%] left-[60%] w-[40%] h-[40%] rounded-full bg-nexus-blue/10 blur-[100px] mix-blend-screen animate-float opacity-50" style={{ animationDelay: '4s' }} />
      </div>

      {/* ─── Drawer Sidebar (rendered when open on any screen size) ──────────── */}
      {isMenuOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
            onClick={() => setIsMenuOpen(false)}
          />
          {/* Drawer panel */}
          <div className="fixed inset-y-0 left-0 z-50 w-[85%] sm:w-80 p-2 sm:p-4 drawer-left">
            <Sidebar onClose={() => setIsMenuOpen(false)} isMobile={true} />
          </div>
        </>
      )}

      {/* ─── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10 min-w-0 w-full">
        {/* Top bar */}
        <header className="h-14 md:h-16 border-b border-white/5 bg-nexus-black/40 backdrop-blur-2xl flex items-center justify-between px-3 md:px-6 flex-shrink-0 gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Hamburger — visible everywhere */}
            <button
              onClick={() => setIsMenuOpen(true)}
              className="p-1.5 sm:p-2 -ml-1 text-nexus-dim hover:text-white transition-colors flex-shrink-0"
              aria-label="Abrir menú"
            >
              <Menu size={18} className="sm:w-5 sm:h-5" />
            </button>
            {/* Accent line */}
            <div className="h-3 sm:h-4 w-0.5 bg-nexus-cyan rounded-full hidden sm:block flex-shrink-0" style={{ boxShadow: '0 0 8px #00d4ff' }} />
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-xs sm:text-sm md:text-base font-bold text-white tracking-widest truncate">{title}</h1>
              {subtitle && (
                <p className="font-mono text-[7px] sm:text-[8px] md:text-[9px] text-nexus-dim tracking-wider hidden sm:block truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <LiveClock />
        </header>

        {noPadding ? (
          <div className="flex-1 flex flex-col overflow-hidden relative animate-fade-in-up">
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid-bg p-2 sm:p-3 md:p-4 lg:p-6">
            <div className="w-full h-full max-w-[1600px] mx-auto animate-fade-in-up">
              {children}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function LiveClock() {
  const [t, setT] = React.useState(new Date())
  React.useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 text-nexus-dim flex-shrink-0">
      <div className="flex items-center gap-1">
        <span className="status-dot online" />
        <span className="font-mono text-[8px] sm:text-[9px] md:text-[10px] text-nexus-success whitespace-nowrap">ONLINE</span>
      </div>
      <span className="font-mono text-[8px] sm:text-[9px] md:text-[10px] tracking-wider text-nexus-dim hidden sm:block whitespace-nowrap">
        {t.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </span>
    </div>
  )
}
