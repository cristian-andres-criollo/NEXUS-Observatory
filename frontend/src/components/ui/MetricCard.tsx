import React from 'react'

interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  animate?: boolean
}

export function MetricCard({ label, value, sub, color = '#00d4ff', icon, animate }: MetricCardProps) {
  return (
    <div className="nexus-panel p-3 sm:p-4 md:p-5 flex flex-col gap-3 group">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-nexus-dim uppercase">{label}</span>
        {icon && <span className="opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:scale-110 duration-300">{icon}</span>}
      </div>
      <div
        className={`font-display text-3xl font-bold tracking-tight ${animate ? 'animate-pulse-slow' : ''}`}
        style={{ color, textShadow: `0 4px 20px ${color}40` }}
      >
        {String(value)}
      </div>
      {sub && <div className="font-body text-[11px] text-nexus-muted leading-tight">{sub}</div>}
    </div>
  )
}
