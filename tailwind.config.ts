import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        otwRed: '#B00017',
        otwRedDark: '#7F0010',
        otwGold: '#E6C36A',
        otwBlack: '#0C0C0C',
        otwOffWhite: '#F9F5EC'
      },
      boxShadow: {
        otwSoft: '0 10px 25px rgba(0,0,0,0.35)',
        otwGlow: '0 0 25px rgba(230,195,106,0.45)'
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem'
      }
    }
  },
  plugins: []
} satisfies Config
