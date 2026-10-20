/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'SF Mono', 'monospace'],
      },
      colors: {
        // Apple system blue accent
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#b3d7ff',
          300: '#80bdff',
          400: '#409cff',
          500: '#0a84ff',
          600: '#0071e3',
          700: '#0058b0',
          800: '#00428a',
          900: '#002f63',
          950: '#001a38',
        },
        // Risk band colors — ordinal severity ramp (mirrored in lib/riskBands.ts)
        risk: {
          low: '#4f8a5f',
          moderate: '#a3841a',
          elevated: '#c46a1c',
          high: '#d1432b',
          critical: '#b81d45',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 8px 30px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
