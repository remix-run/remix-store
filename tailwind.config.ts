import type {Config} from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config = {
  darkMode: ['class'],
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  prefix: '',
  theme: {
    fontFamily: {
      body: ['"Inter"', ...defaultTheme.fontFamily.sans],
      heading: ['Founders Grotesk', ...defaultTheme.fontFamily.sans],
    },
    colors: {
      gray: '#343436',
      lightGray: '#E3E2DD',
      black: '#242426',
      cyan: {brand: '#3DEFE9'},
      blue: {brand: '#3992FF'},
      green: {brand: '#6BD968'},
      yellow: {brand: '#FECC1B'},
      magenta: {brand: '#D83BD2'},
      red: {brand: '#F44250'},
      'shop-pay': {brand: '#5A31F4'},
      success: {brand: '#3992FF'},
      error: {brand: '#F44250'},
      warning: {brand: '#FECC1B'},
      white: '#DADADA',
      neutral: {
        50: '#F5F5EF',
        100: '#EAEAE4',
        200: '#E3E2DD',
        300: '#DADADA',
        400: '#808080',
        500: '#59585C',
        600: '#434343',
        700: '#343436',
        800: '#242426',
      },
    },
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    letterSpacing: {
      tightest: ' -1.92px',
    },
    extend: {
      keyframes: {
        'accordion-down': {
          from: {height: '0'},
          to: {height: 'var(--radix-accordion-content-height)'},
        },
        'accordion-up': {
          from: {height: 'var(--radix-accordion-content-height)'},
          to: {height: '0'},
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;

export default config;
