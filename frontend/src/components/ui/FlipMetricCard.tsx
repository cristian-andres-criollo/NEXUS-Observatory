import React, { useState } from 'react'

interface FlipMetricCardProps {
  labelFront: string
  valueFront: string | number
  subFront?: string
  labelBack: string
  valueBack: string | number
  subBack?: string
  color?: string
  icon?: React.ReactNode
}

export function FlipMetricCard({
  labelFront, valueFront, subFront,
  labelBack, valueBack, subBack,
  color = '#00d4ff', icon
}: FlipMetricCardProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  return (
    <div 
      className="relative w-full h-full min-h-[140px] cursor-pointer group/flip"
      style={{ perspective: '1000px' }}
      onClick={() => setIsFlipped(!isFlipped)}
      title="Clic para cambiar moneda"
    >
      <div 
        className={`w-full h-full transition-transform duration-500`}
        style={{ 
          transformStyle: 'preserve-3d', 
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' 
        }}
      >
        {/* Frente (COP) */}
        <div 
          className="absolute inset-0 nexus-panel p-3 sm:p-4 md:p-5 flex flex-col gap-3 group bg-[#0a0f18] hover:border-nexus-cyan/30 shadow-lg"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-nexus-dim uppercase">{labelFront}</span>
            {icon && <span className="opacity-50 group-hover:opacity-100 transition-opacity text-nexus-cyan">{icon}</span>}
          </div>
          <div
            className="font-display text-3xl font-bold tracking-tight"
            style={{ color, textShadow: `0 4px 20px ${color}40` }}
          >
            {String(valueFront)}
          </div>
          {subFront && <div className="font-body text-[11px] text-nexus-muted leading-tight">{subFront}</div>}
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-white/20 group-hover/flip:text-nexus-cyan/40 transition-colors uppercase">
            Click para USD
          </div>
        </div>

        {/* Dorso (USD) */}
        <div 
          className="absolute inset-0 nexus-panel p-3 sm:p-4 md:p-5 flex flex-col gap-3 group bg-[#0f172a] border-nexus-warn/30 hover:border-nexus-warn/60 shadow-lg"
          style={{ 
            backfaceVisibility: 'hidden', 
            transform: 'rotateY(180deg)' 
          }}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold tracking-[0.2em] text-nexus-warn/70 uppercase">{labelBack}</span>
            {icon && <span className="opacity-50 group-hover:opacity-100 transition-opacity text-nexus-warn">{icon}</span>}
          </div>
          <div
            className="font-display text-3xl font-bold tracking-tight text-white"
            style={{ textShadow: `0 4px 20px rgba(255,255,255,0.2)` }}
          >
            {String(valueBack)}
          </div>
          {subBack && <div className="font-body text-[11px] text-nexus-muted leading-tight">{subBack}</div>}
          <div className="absolute bottom-2 right-3 text-[9px] font-mono text-white/20 group-hover/flip:text-nexus-warn/40 transition-colors uppercase">
            Click para COP
          </div>
        </div>
      </div>
    </div>
  )
}
