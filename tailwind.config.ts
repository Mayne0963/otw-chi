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
        otw: {
          primary: '#0A84FF',
          accent: '#34C759',
          dark: '#0B0B0D',
          light: '#F7F7F8'
        }
      }
    }
  },
  plugins: []
} satisfies Config
