import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f3f6f8',
          100: '#e4ebf0',
          200: '#c9d6e0',
          300: '#a3b7c7',
          400: '#7593aa',
          500: '#557690',
          600: '#435f77',
          700: '#384e61',
          800: '#314351',
          900: '#2c3945',
          950: '#1a2229',
        },
        accent: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        heat: {
          500: '#e11d48',
          600: '#be123c',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Segoe UI', 'Tahoma', 'sans-serif'],
        sans: ['var(--font-sans)', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(26,34,41,0.04), 0 8px 24px rgba(26,34,41,0.06)',
        lift: '0 12px 40px rgba(26,34,41,0.12)',
      },
      backgroundImage: {
        'app-glow':
          'radial-gradient(1200px 500px at 10% -10%, rgba(20,184,166,0.14), transparent 55%), radial-gradient(900px 420px at 100% 0%, rgba(85,118,144,0.10), transparent 50%)',
        'app-glow-dark':
          'radial-gradient(1000px 480px at 0% -20%, rgba(20,184,166,0.16), transparent 50%), radial-gradient(800px 400px at 100% 0%, rgba(45,70,90,0.35), transparent 45%)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'nav-in': {
          '0%': { opacity: '0', transform: 'translateX(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'nav-in': 'nav-in 0.25s ease-out both',
      },
    },
  },
  plugins: [],
}

export default config
