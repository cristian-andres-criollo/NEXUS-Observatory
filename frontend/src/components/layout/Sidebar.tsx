import React from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard, MessageSquare, FileText, Code2, GitBranch,
  Activity, Eye, Hexagon, ClipboardList, GitCommit, Sparkles, X, Settings
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { path: '/',          icon: LayoutDashboard, label: 'DASHBOARD',   sub: 'Métricas de uso', plans: ['community', 'team', 'enterprise'] },
  { path: '/chat',      icon: MessageSquare,   label: 'ASISTENTE',   sub: 'Chat Demo', plans: ['community', 'team', 'enterprise'] },
  { path: '/ab',        icon: Sparkles,        label: 'A/B TESTING', sub: 'Comparación LLM', plans: ['team', 'enterprise'] },
]

const toolLinks = [
  { to: '/?tab=langsmith', label: 'LangSmith',    color: '#00e676', plans: ['team', 'enterprise'] },
  { to: '/?tab=helicone',  label: 'Helicone',     color: '#00d4ff', plans: ['team', 'enterprise'] },
  { to: '/?tab=weave',     label: 'W&B Weave',    color: '#ff6b35', plans: ['team', 'enterprise'] },
  { to: '/?tab=phoenix',   label: 'Arize Phoenix',color: '#0e4aff', plans: ['team', 'enterprise'] },
]

interface SidebarProps {
  onClose?: () => void
  isMobile?: boolean
}

export function Sidebar({ onClose, isMobile = false }: SidebarProps) {
  const { user } = useAuth()

  return (
    <aside className="w-full h-full bg-nexus-black/40 backdrop-blur-[32px] rounded-3xl border border-white/10 flex flex-col flex-shrink-0 overflow-y-auto nexus-scrollbar relative shadow-[0_16px_60px_-15px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.05)]">
      {/* Decorative inner glow */}
      <div className="absolute inset-0 rounded-3xl pointer-events-none" style={{ boxShadow: 'inset 0 0 40px rgba(14,74,255,0.05)' }} />

      {/* Logo Section */}
      <div className="px-5 py-6 border-b border-white/5 relative z-10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 w-full">
            <div className="relative group flex items-center w-40 h-auto">
              <img 
                src="/img/logo web.png" 
                alt="Nexus Logo" 
                className="w-full h-auto object-contain drop-shadow-[0_0_8px_rgba(0,212,255,0.5)] transition-transform duration-500 group-hover:scale-105" 
              />
            </div>
          </div>
          {/* Close button (Mobile Drawer) */}
          {isMobile && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-nexus-dim hover:text-white hover:bg-nexus-danger/20 hover:border-nexus-danger/50 transition-all active:scale-90"
              aria-label="Cerrar menú"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 bg-black/40 border border-white/5 rounded-full px-3 py-1.5 w-max">
          <span className="status-dot online" />
          <span className="font-mono text-[9px] text-nexus-success tracking-widest uppercase">Sistemas Operacionales</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 flex flex-col gap-1.5 relative z-10">
        <div className="font-display font-semibold text-[10px] text-nexus-dim tracking-widest px-2 mb-3 uppercase flex items-center gap-2">
          Módulos
          <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
        </div>
        
        {navItems.filter(item => item.plans.includes(user?.plan || 'community') || user?.role === 'admin').map(({ path, icon: Icon, label, sub }, index) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={isMobile ? onClose : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-3 py-3 rounded-2xl transition-all duration-300 group relative overflow-hidden animate-fade-in-up animate-fade-in-up-delay-${(index % 3) + 1} ${
                isActive
                  ? 'bg-gradient-to-r from-nexus-blue/20 to-nexus-cyan/5 border border-nexus-cyan/30 text-white shadow-[0_4px_20px_rgba(0,212,255,0.15)]'
                  : 'text-nexus-dim hover:bg-white/5 hover:text-white border border-transparent hover:border-white/10'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-nexus-cyan to-nexus-blue shadow-[0_0_12px_#00d4ff]" />
                )}
                {/* Active Hover Background sweep */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />

                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? 'bg-nexus-cyan/20 text-nexus-cyan shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)]' : 'bg-black/30 group-hover:bg-white/10'}`}>
                  <Icon
                    size={16}
                    className={isActive ? 'text-nexus-cyan drop-shadow-[0_0_8px_rgba(0,212,255,0.8)]' : 'text-nexus-dim group-hover:text-white transition-colors'}
                  />
                </div>
                <div className="min-w-0 flex-1 transition-transform duration-300 group-hover:translate-x-1">
                  <div className={`font-display text-[11px] font-bold tracking-widest uppercase truncate ${isActive ? 'text-white' : ''}`}>{label}</div>
                  <div className="font-body text-[10px] font-medium text-nexus-dim leading-tight truncate">{sub}</div>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* External tool links */}
      {(user?.role === 'admin' || user?.plan === 'team' || user?.plan === 'enterprise') && (
        <div className="px-4 pb-4 border-t border-white/5 pt-5 relative z-10">
          <div className="font-display font-semibold text-[10px] text-nexus-dim tracking-widest px-2 mb-3 uppercase flex items-center gap-2">
            Telemetría
            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {toolLinks.filter(t => t.plans.includes(user?.plan || 'community') || user?.role === 'admin').map(({ to, label, color }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-black/20 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 group"
              >
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-150" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                <span className="font-body font-semibold text-[10px] text-nexus-dim group-hover:text-white transition-colors truncate">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-white/5 relative z-10 flex-shrink-0 space-y-2">
        <Link
          to="/settings"
          onClick={isMobile ? onClose : undefined}
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-black/30 border border-white/5 text-nexus-dim hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 group"
        >
          <Settings size={16} className="group-hover:text-nexus-cyan transition-colors group-hover:rotate-90 duration-500" />
          <span className="font-display text-[11px] font-bold tracking-widest uppercase">Ajustes</span>
        </Link>
        <LogoutButton />
      </div>
    </aside>
  )
}

function LogoutButton() {
  const { user, logout } = useAuth()
  if (!user) return null
  return (
    <button
      onClick={logout}
      className="w-full flex items-center justify-center px-4 py-3 rounded-xl font-display text-[10px] font-bold tracking-widest uppercase transition-all duration-300 border border-nexus-danger/30 text-nexus-danger bg-nexus-danger/10 hover:bg-nexus-danger hover:text-white hover:shadow-[0_4px_15px_rgba(255,45,85,0.4)] active:scale-95"
    >
      Cerrar Sesión
    </button>
  )
}
