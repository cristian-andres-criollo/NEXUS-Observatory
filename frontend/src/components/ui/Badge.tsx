import React from 'react'

interface BadgeProps {
  label: string
  color?: 'blue' | 'cyan' | 'green' | 'orange' | 'red' | 'accent'
  size?: 'sm' | 'md'
}

const colors = {
  blue:   { bg: 'rgba(14,74,255,0.2)',   border: 'rgba(14,74,255,0.6)',   text: '#a8d8ff' },
  cyan:   { bg: 'rgba(0,212,255,0.15)',  border: 'rgba(0,212,255,0.5)',   text: '#00d4ff' },
  green:  { bg: 'rgba(0,230,118,0.15)',  border: 'rgba(0,230,118,0.5)',   text: '#00e676' },
  orange: { bg: 'rgba(255,107,53,0.15)', border: 'rgba(255,107,53,0.5)',  text: '#ff6b35' },
  red:    { bg: 'rgba(255,45,85,0.15)',  border: 'rgba(255,45,85,0.5)',   text: '#ff2d55' },
  accent: { bg: 'rgba(0,255,204,0.15)',  border: 'rgba(0,255,204,0.5)',   text: '#00ffcc' },
}

export function Badge({ label, color = 'blue', size = 'sm' }: BadgeProps) {
  const c = colors[color]
  return (
    <span
      className={`inline-flex items-center font-display font-semibold uppercase tracking-wider rounded-md backdrop-blur-sm ${size === 'sm' ? 'text-[9px] px-2 py-0.5' : 'text-[11px] px-3 py-1'}`}
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text, boxShadow: `0 2px 8px ${c.bg}` }}
    >
      {label}
    </span>
  )
}
