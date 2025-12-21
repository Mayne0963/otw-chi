import type { Config } from 'tailwindcss';

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
          bg: '#0B0B0B',
          panel: '#141414',
          panelHover: '#1A1A1A',
          primary: '#C1272D',
          primaryHover: '#A02025',
          accent: '#FFD700',
          text: '#F5F5F5',
          textMuted: '#A3A3A3',
          border: '#2A2A2A',
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
        }
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      backgroundImage: {
        'otw-gradient': 'linear-gradient(to bottom, #0B0B0B, #141414)',
      }
    }
  },
  plugins: []
} satisfies Config;
