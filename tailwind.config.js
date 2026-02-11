/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Glass Aurora Theme Colors - Dark Mode (Default)
        'bg-main': '#05070A',
        'bg-secondary': '#0A0E14',
        'bg-tertiary': '#0F1419',
        'glass-bg': 'rgba(255, 255, 255, 0.05)',
        'glass-border': 'rgba(255, 255, 255, 0.1)',
        'text-primary': '#F5F7FA',
        'text-secondary': '#A0A6B0',
        'text-muted': '#6B7280',
        'text-disabled': '#4B5563',
        
        // Accent Colors
        'accent': {
          'cyan': '#4efcff',
          'purple': '#7b5cff',
          'pink': '#b44cff',
          'blue': '#3B82F6',
          'green': '#10B981',
          'yellow': '#F59E0B',
          'red': '#EF4444',
        },
        
        // Light Theme Colors
        'bg-main-light': '#FFFFFF',
        'bg-secondary-light': '#F8FAFC',
        'bg-tertiary-light': '#F1F5F9',
        'glass-bg-light': 'rgba(0, 0, 0, 0.05)',
        'glass-border-light': 'rgba(0, 0, 0, 0.1)',
        'text-primary-light': '#1A1A1A',
        'text-secondary-light': '#374151',
        'text-muted-light': '#6B7280',
        'text-disabled-light': '#9CA3AF',
        
        // Semantic Colors
        'success': '#10B981',
        'warning': '#F59E0B',
        'error': '#EF4444',
        'info': '#3B82F6',
        
        // Interactive States
        'hover-overlay': 'rgba(255, 255, 255, 0.05)',
        'active-overlay': 'rgba(255, 255, 255, 0.1)',
        'focus-ring': '#4efcff',
        
        // Quality Badge Colors
        'quality': {
          '480p': '#6B7280',
          '720p': '#F59E0B',
          '1080p': '#10B981',
          '4k': '#8B5CF6',
        },
      },
      
      fontFamily: {
        'inter': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['JetBrains Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
      
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      
      backgroundImage: {
        'accent-gradient': 'linear-gradient(135deg, #4efcff, #7b5cff, #b44cff)',
        'accent-gradient-hover': 'linear-gradient(135deg, #5ffcff, #8b6cff, #c45cff)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
        'hero-gradient': 'linear-gradient(to top, #05070A 0%, rgba(5,7,10,0.8) 50%, transparent 100%)',
        'hero-gradient-light': 'linear-gradient(to top, #FFFFFF 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
      },
      
      backdropBlur: {
        'glass': '16px',
        'modal': '24px',
      },
      
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.12)',
        'glass-lg': '0 16px 64px rgba(0, 0, 0, 0.16)',
        'glow': '0 0 20px rgba(78, 252, 255, 0.3)',
        'glow-purple': '0 0 20px rgba(123, 92, 255, 0.3)',
        'glow-pink': '0 0 20px rgba(180, 76, 255, 0.3)',
      },
      
      aspectRatio: {
        'poster': '2/3',
        'video': '16/9',
        'square': '1/1',
      },
      
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'fade-out': 'fadeOut 0.3s ease-in',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.3s ease-out',
        'scale-out': 'scaleOut 0.2s ease-in',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-subtle': 'bounceSubtle 1s ease-in-out infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        scaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.9)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(78, 252, 255, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(78, 252, 255, 0.5)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
      },
      
      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
      },
      
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      
      zIndex: {
        'dropdown': '1000',
        'modal': '2000',
        'toast': '3000',
        'tooltip': '4000',
      },
    },
  },
  plugins: [],
};