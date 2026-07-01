import React, { useState, useEffect } from 'react'
import { Bell, Wifi, Clock, Cpu } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'


export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const [time, setTime] = useState(new Date())
  const { token } = useAuth()

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])


  return (
    <>
      <header className="h-14 border-b border-nexus-blue/20 bg-nexus-darker/80 backdrop-blur flex items-center justify-between px-3 sm:px-4 md:px-6 flex-shrink-0 gap-3 overflow-x-auto">
        <div className="flex items-center gap-3">
          <div className="h-4 w-0.5 bg-nexus-cyan rounded-full shadow-nexus-cyan" />
          <div>
            <h1 className="font-display text-sm font-bold text-white tracking-widest">{title}</h1>
            {subtitle && <p className="font-mono text-[9px] text-nexus-dim tracking-wider">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4 text-nexus-dim flex-shrink-0 text-nowrap overflow-x-auto">
          <div className="flex items-center gap-1.5 text-nexus-dim">
            <Wifi size={12} className="text-nexus-success" />
            <span className="font-mono text-[10px] text-nexus-success">CONECTADO</span>
          </div>
          <div className="flex items-center gap-1.5 text-nexus-dim">
            <Clock size={11} />
            <span className="font-mono text-[10px] tracking-wider">
              {time.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu size={11} className="text-nexus-blue" />
            <span className="font-mono text-[10px] text-nexus-dim">LLM ACTIVO</span>
          </div>

          <button className="text-nexus-dim hover:text-nexus-cyan transition-colors relative">
            <Bell size={14} />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-nexus-cyan rounded-full" />
          </button>
        </div>
      </header>
    </>
  )
}
