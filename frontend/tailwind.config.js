/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nexus: {
          black:   '#02040a',
          darker:  '#040a19',
          dark:    '#081226',
          navy:    '#0b1836',
          blue:    'rgba(var(--nexus-blue-rgb), <alpha-value>)',
          cyan:    'rgba(var(--nexus-cyan-rgb), <alpha-value>)',
          ice:     'rgba(var(--nexus-ice-rgb), <alpha-value>)',
          glow:    '#1a6bff',
          accent:  '#00ffcc',
          warn:    '#ff6b35',
          danger:  '#ff2d55',
          success: '#00e676',
          muted:   '#2a3f5f',
          text:    '#c8deff',
          dim:     '#5a7a9f',
        }
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        body: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        display: ['var(--font-display)'],
      },
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'glow-line':    'glowLine 2s ease-in-out infinite alternate',
        'scan':         'scan 4s linear infinite',
        'flicker':      'flicker 5s linear infinite',
        'float':        'float 6s ease-in-out infinite',
        'data-stream':  'dataStream 8s linear infinite',
      },
      keyframes: {
        glowLine:   { '0%': { opacity: '0.4' }, '100%': { opacity: '1' } },
        scan:       { '0%': { transform: 'translateY(-100%)' }, '100%': { transform: 'translateY(100vh)' } },
        flicker:    { '0%,95%,100%': { opacity:'1' }, '96%': { opacity:'0.4' }, '97%': { opacity:'1' }, '98%': { opacity:'0.3' } },
        float:      { '0%,100%': { transform:'translateY(0px)' }, '50%': { transform:'translateY(-8px)' } },
        dataStream: { '0%': { transform:'translateY(-100%)' }, '100%': { transform:'translateY(100vh)' } },
      },
      boxShadow: {
        'nexus':      '0 0 20px rgba(14,74,255,0.3), 0 0 60px rgba(14,74,255,0.1)',
        'nexus-cyan': '0 0 20px rgba(0,212,255,0.4), 0 0 60px rgba(0,212,255,0.1)',
        'nexus-sm':   '0 0 8px rgba(14,74,255,0.5)',
        'inner-glow': 'inset 0 0 30px rgba(14,74,255,0.15)',
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(14,74,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(14,74,255,0.07) 1px, transparent 1px)',
        'hex-pattern':  'radial-gradient(circle at 1px 1px, rgba(0,212,255,0.12) 1px, transparent 0)',
      },
      backgroundSize: {
        'grid': '40px 40px',
        'hex':  '20px 20px',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
