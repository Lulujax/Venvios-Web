/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F8F9FA',
        bone: '#F1EDE5',
        ink: '#111318',
        navy: {
          DEFAULT: '#0B1C3C',
          800: '#081529',
          700: '#132A54',
        },
        gold: {
          DEFAULT: '#EAB308',
          soft: '#F5D45C',
        },
        red: {
          DEFAULT: '#D32F2F',
          dark: '#A92323',
        },
        line: '#D8DCE1',
        muted: '#5C636E',
      },
      fontFamily: {
        display: ['"Cabinet Grotesk"', 'Satoshi', 'sans-serif'],
        sans: ['Satoshi', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '2px',
        sm: '2px',
        md: '4px',
        lg: '4px',
        xl: '4px',
        '2xl': '4px',
        '3xl': '4px',
      },
      borderColor: {
        DEFAULT: '#D8DCE1',
      },
      maxWidth: {
        shell: '1320px',
        prose: '65ch',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
        swift: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      letterSpacing: {
        tightest: '-0.045em',
        label: '0.2em',
      },
      screens: {
        xs: '480px',
      },
    },
  },
  plugins: [],
};
