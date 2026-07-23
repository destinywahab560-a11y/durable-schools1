/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFBF5',
          100: '#FAF5EB',
          200: '#F5EBD7',
          300: '#EFDDB8',
          400: '#E4CC95',
          500: '#D4B876'
        },
        brown: {
          50: '#F7F0E8',
          100: '#E8D5C0',
          200: '#D0AB87',
          300: '#B5885A',
          400: '#8B5E3C',
          500: '#6B4423',
          600: '#5C3A1E',
          700: '#4A2E18',
          800: '#3D2410',
          900: '#2A1808'
        },
        amber: {
          50: '#FFF8E7',
          100: '#FFEFC2',
          200: '#FFE08A',
          300: '#FFD24E',
          400: '#F5B324',
          500: '#D89400',
          600: '#B07400'
        },
        sage: {
          50: '#F0F5F0',
          100: '#D9E8D9',
          200: '#B3D1B3',
          300: '#7FAA7F',
          400: '#5C8A5C',
          500: '#3D6B3D'
        },
        error: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C'
        },
        warning: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706'
        },
        success: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          500: '#22C55E',
          600: '#16A34A'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
        display: ['Playfair Display', 'serif']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    }
  },
  plugins: []
}
