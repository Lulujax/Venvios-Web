/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        papel: '#FAF8F3',
        linea: '#E6E0D2',
        tinta: '#141A33',
        suave: '#5B6178',
        marino: { DEFAULT: '#14286B', 900: '#0C1A4A', 700: '#1B3590', 100: '#E3E8F7', 50: '#F0F3FB' },
        oro: { DEFAULT: '#F2B01E', 600: '#D99A0B', 100: '#FDF0CC', 50: '#FEF8E7' },
        rojo: { DEFAULT: '#D4262C', 700: '#B01C21', 100: '#FBE4E4' },
        verde: { DEFAULT: '#1E8A5A', 100: '#DDF3E8' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Figtree', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { tarjeta: '20px', boton: '14px' },
      boxShadow: {
        tarjeta: '0 1px 0 rgba(20,26,51,.04), 0 8px 24px -12px rgba(20,26,51,.18)',
        elevada: '0 18px 40px -18px rgba(20,40,107,.35)',
      },
      keyframes: {
        entrar: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulso: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.45' } },
      },
      animation: { entrar: 'entrar .35s cubic-bezier(.22,1,.36,1) both', pulso: 'pulso 1.4s ease-in-out infinite' },
    },
  },
  plugins: [],
};
