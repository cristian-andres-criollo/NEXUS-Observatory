import React from 'react'
import { scoreColor, scoreLabel } from '../../lib/utils'

interface ScoreBarProps {
  label: string
  score: number
  showLabel?: boolean
  inverse?: boolean
}

export function ScoreBar({ label, score, showLabel = true, inverse = false }: ScoreBarProps) {
  const color = scoreColor(score, inverse)
  const pct = Math.round(score * 100)
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] text-nexus-dim tracking-wider uppercase font-semibold">{label}</span>
        {showLabel && (
          <span className="font-display text-xs font-bold" style={{ color, textShadow: `0 0 10px ${color}80` }}>
            {pct}% — {scoreLabel(score)}
          </span>
        )}
      </div>
      <div className="h-2 bg-black/40 backdrop-blur-sm border border-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out relative"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}60, ${color})` }}
        >
          <div className="absolute inset-0 bg-white/20 w-1/2 rounded-full blur-sm" />
        </div>
      </div>
    </div>
  )
}
