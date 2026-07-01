import React from 'react'

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin">
      <circle cx="12" cy="12" r="10" stroke="rgba(14,74,255,0.2)" strokeWidth="2"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="#00d4ff" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function LoadingBar() {
  return <div className="loading-bar w-full rounded-full" style={{height: 2}} />
}
