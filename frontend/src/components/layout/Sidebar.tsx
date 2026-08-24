import React from 'react'
import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard,
  Activity, Eye, Hexagon, ClipboardList, GitCommit, X, Settings
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navItems = [
  { path: '/',       icon: LayoutDashboard, label: 'DASHBOARD', sub: 'Métricas de uso' },
  { path: '/finops', icon: Activity,        label: 'FINOPS',    sub: 'Costos y Tokens' },
]

const toolLinks = [
  { to: '/?tab=langsmith', label: 'LangSmith',    color: '#00e676' },
  { to: '/?tab=helicone',  label: 'Helicone',     color: '#00d4ff' },
  { to: '/?tab=weave',     label: 'W&B Weave',    color: '#ff6b35' },
  { to: '/?tab=phoenix',   label: 'Arize Phoenix', color: '#0e4aff' },
]

interface SidebarProps {
  onClose?: () => void
  isMobile?: boolean
}

export function Sidebar({ onClose, isMobile = false }: SidebarProps) {

  return (
    <aside className="w-full h-full bg-nexus-black border-r border-nexus-navy flex flex-col flex-shrink-0 overflow-y-auto nexus-scrollbar relative">
      {/* Decorative inner glow removed for SaaS clean look */}

      {/* Logo Section */}
      <div className="px-5 py-6 border-b border-nexus-navy relative z-10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1 w-full">
            <h1 className="font-display font-bold text-lg text-white tracking-wide">
              NEXUS
            </h1>
            <span className="font-mono text-[10px] text-nexus-dim uppercase tracking-widest">
              by Shirokage Devs
            </span>
          </div>
          {/* Close button (Mobile Drawer) */}
          {isMobile && (
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-nexus-navy text-nexus-dim hover:text-white hover:bg-nexus-danger/20 transition-all active:scale-90"
              aria-label="Cerrar menú"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="mt-4 flex items-center gap-2 bg-nexus-navy rounded-md px-3 py-1.5 w-max">
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
        
        {navItems.map(({ path, icon: Icon, label, sub }, index) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={isMobile ? onClose : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-3 py-3 rounded-lg transition-all duration-200 group relative overflow-hidden ${
                isActive
                  ? 'bg-nexus-blue/10 border-l-2 border-nexus-blue text-white'
                  : 'text-nexus-dim hover:bg-nexus-navy hover:text-white border-l-2 border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-md transition-all duration-300 ${isActive ? 'bg-nexus-blue/20 text-nexus-blue' : 'group-hover:bg-nexus-darker text-nexus-dim group-hover:text-white'}`}>
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`font-display text-[11px] font-bold tracking-widest uppercase truncate ${isActive ? 'text-white' : ''}`}>{label}</div>
                  <div className="font-body text-[10px] font-medium text-nexus-dim leading-tight truncate">{sub}</div>
                </div>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* External tool links */}
      <div className="px-4 pb-4 border-t border-white/5 pt-5 relative z-10">
          <div className="font-display font-semibold text-[10px] text-nexus-dim tracking-widest px-2 mb-3 uppercase flex items-center gap-2">
            Telemetría
            <div className="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {toolLinks.map(({ to, label, color }) => (
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
