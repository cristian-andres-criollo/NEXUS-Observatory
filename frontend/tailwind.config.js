/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        nexus: {
          black:   '#0a0a0b',
          darker:  '#121214',
          dark:    '#18181b',
          navy:    '#27272a',
          blue:    '#3b82f6',
          cyan:    '#0ea5e9',
          ice:     '#e0f2fe',
          glow:    '#6366f1',
          accent:  '#8b5cf6',
          warn:    '#f59e0b',
          danger:  '#ef4444',
          success: '#10b981',
          muted:   '#3f3f46',
          text:    '#fafafa',
          dim:     '#a1a1aa',
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
        'fade-in':      'fadeIn 0.3s ease-out',
        'fade-in-up':   'fadeInUp 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      boxShadow: {
        'nexus':      '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'nexus-cyan': '0 0 15px rgba(14, 165, 233, 0.2)',
        'nexus-sm':   '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'inner-glow': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
      },
      backgroundImage: {
        'grid-pattern': 'none',
        'hex-pattern':  'none',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
