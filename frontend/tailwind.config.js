/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {

      // ─── Brand colours ───────────────────────────────────────────────────
      colors: {
        cyber: {
          // Primary accents
          blue:       '#00F5FF',
          'blue-dim': '#00C4CC',
          green:      '#00FF88',
          red:        '#FF3D71',
          yellow:     '#FFB800',
          purple:     '#A259FF',
          orange:     '#FF6B35',

          // Surfaces (dark → deep)
          dark:        '#0B0F19',
          surface:     '#111827',
          'surface-2': '#0D1117',
          'surface-3': '#151C2A',
          'surface-4': '#1A2235',

          // Borders
          border:      'rgba(0,245,255,0.12)',
          'border-dim':'rgba(0,245,255,0.06)',
          'border-md': 'rgba(0,245,255,0.20)',
          'border-hi': 'rgba(0,245,255,0.35)',

          // Text
          'text':      '#E2E8F0',
          'text-muted':'#6B7894',
          'text-faint':'#3D4663',
        },
      },

      // ─── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        display: ['"Orbitron"', '"Share Tech Mono"', 'monospace'],
        mono:    ['"Share Tech Mono"', '"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },

      // ─── Font sizes (fluid clamp scale) ──────────────────────────────────
      fontSize: {
        'cyber-xs':   'clamp(0.75rem,  0.7rem  + 0.25vw, 0.875rem)',
        'cyber-sm':   'clamp(0.875rem, 0.8rem  + 0.35vw, 1rem)',
        'cyber-base': 'clamp(1rem,     0.95rem + 0.25vw, 1.125rem)',
        'cyber-lg':   'clamp(1.125rem, 1rem    + 0.75vw, 1.5rem)',
        'cyber-xl':   'clamp(1.5rem,   1.2rem  + 1.25vw, 2.25rem)',
        'cyber-2xl':  'clamp(2rem,     1.2rem  + 2.5vw,  3.5rem)',
        'cyber-3xl':  'clamp(2.5rem,   1rem    + 4vw,    5rem)',
        'cyber-hero': 'clamp(3rem,     0.5rem  + 7vw,    8rem)',
      },

      // ─── Spacing ──────────────────────────────────────────────────────────
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
        '34': '8.5rem',
      },

      // ─── Box shadows ──────────────────────────────────────────────────────
      boxShadow: {
        'cyber-sm':  '0 0 8px rgba(0,245,255,0.20)',
        'cyber-md':  '0 0 20px rgba(0,245,255,0.35)',
        'cyber-lg':  '0 0 40px rgba(0,245,255,0.45)',
        'cyber-xl':  '0 0 60px rgba(0,245,255,0.55)',
        'threat-sm': '0 0 8px rgba(255,61,113,0.25)',
        'threat-md': '0 0 20px rgba(255,61,113,0.40)',
        'green-sm':  '0 0 8px rgba(0,255,136,0.25)',
        'green-md':  '0 0 20px rgba(0,255,136,0.40)',
        'panel':     '0 4px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(0,245,255,0.08)',
        'panel-lg':  '0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(0,245,255,0.10)',
      },

      // ─── Border radius ────────────────────────────────────────────────────
      borderRadius: {
        'cyber': '4px',
        'cyber-md': '8px',
        'cyber-lg': '12px',
        'cyber-xl': '16px',
      },

      // ─── Backgrounds ──────────────────────────────────────────────────────
      backgroundImage: {
        'cyber-grid':
          'linear-gradient(rgba(0,245,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.04) 1px, transparent 1px)',
        'cyber-radial':
          'radial-gradient(ellipse at center, rgba(0,245,255,0.08) 0%, transparent 70%)',
        'hero-gradient':
          'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,245,255,0.08) 0%, transparent 70%)',
        'threat-gradient':
          'radial-gradient(circle at 30% 50%, rgba(255,61,113,0.08) 0%, transparent 60%)',
        'surface-gradient':
          'linear-gradient(180deg, rgba(0,245,255,0.03) 0%, transparent 100%)',
        'card-shine':
          'linear-gradient(135deg, rgba(0,245,255,0.05) 0%, transparent 50%, rgba(0,245,255,0.02) 100%)',
      },

      backgroundSize: {
        'cyber-grid': '40px 40px',
      },

      // ─── Animations ───────────────────────────────────────────────────────
      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'scan':         'scan 2s linear infinite',
        'glow':         'glow 2s ease-in-out infinite alternate',
        'float':        'float 6s ease-in-out infinite',
        'radar':        'radar 3s linear infinite',
        'alert-pulse':  'alertPulse 1s ease-out infinite',
        'grid-shift':   'gridShift 20s linear infinite',
        'live-dot':     'livePulse 2s ease-in-out infinite',
        'threat-dot':   'livePulse 1.2s ease-in-out infinite',
        'fade-in-up':   'fadeInUp 0.6s ease-out forwards',
        'shimmer':      'shimmer 1.5s ease-in-out infinite',
        'border-flow':  'borderFlow 3s linear infinite',
      },

      keyframes: {
        scan: {
          '0%':   { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glow: {
          '0%':   { boxShadow: '0 0 5px rgba(0,245,255,0.3), 0 0 10px rgba(0,245,255,0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(0,245,255,0.6), 0 0 40px rgba(0,245,255,0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-12px)' },
        },
        radar: {
          '0%':   { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        alertPulse: {
          '0%':   { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        gridShift: {
          '0%':   { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1',   transform: 'scale(1)' },
          '50%':      { opacity: '0.5', transform: 'scale(0.85)' },
        },
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        borderFlow: {
          '0%':   { backgroundPosition: '0% 50%' },
          '50%':  { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
      },

      // ─── Transitions ──────────────────────────────────────────────────────
      transitionTimingFunction: {
        'cyber': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        '180': '180ms',
        '250': '250ms',
      },
    },
  },
  plugins: [],
}
