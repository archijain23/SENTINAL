/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        cyber: {
          blue: '#00F5FF',
          dark: '#0B0F19',
          red: '#FF3D71',
          green: '#00FF88',
          gold: '#FFB700',
          purple: '#9B5DE5',
          'blue-dim': '#00C4CC',
          'surface': '#0D1117',
          'surface-2': '#111722',
          'surface-3': '#151C2A',
          'border': 'rgba(0,245,255,0.12)',
          'border-dim': 'rgba(0,245,255,0.06)',
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan': 'scan 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'radar': 'radar 3s linear infinite',
        'alert-pulse': 'alertPulse 1s ease-out infinite',
        'grid-shift': 'gridShift 20s linear infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0,245,255,0.3), 0 0 10px rgba(0,245,255,0.1)' },
          '100%': { boxShadow: '0 0 20px rgba(0,245,255,0.6), 0 0 40px rgba(0,245,255,0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        radar: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        alertPulse: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(2)', opacity: '0' },
        },
        gridShift: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
      },
      backgroundImage: {
        'cyber-grid': 'linear-gradient(rgba(0,245,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.04) 1px, transparent 1px)',
        'cyber-radial': 'radial-gradient(ellipse at center, rgba(0,245,255,0.08) 0%, transparent 70%)',
        'hero-gradient': 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,245,255,0.08) 0%, transparent 70%)',
        'threat-gradient': 'radial-gradient(circle at 30% 50%, rgba(255,61,113,0.08) 0%, transparent 60%)',
      },
    },
  },
  plugins: [],
}
