/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:           '#0B0F17',
        surface:      '#111827',
        elevated:     '#1F2937',
        'border-dim': '#1F2937',
        'border-mid': '#374151',
        blue:         '#3B82F6',
        indigo:       '#6366F1',
        violet:       '#8B5CF6',
        'text-primary':   '#E5E7EB',
        'text-secondary': '#9CA3AF',
        'text-muted':     '#6B7280',
        success:  '#22C55E',
        warning:  '#F59E0B',
        danger:   '#EF4444',
        info:     '#38BDF8',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease-out',
        'slide-in':   'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #3B82F6, #6366F1)',
      },
    },
  },
  plugins: [],
}