import type {Config} from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';
import plugin from 'tailwindcss/plugin';

const config = {
  darkMode: ['class'],
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  prefix: '',
  theme: {
    fontFamily: {
      body: ['"Inter"', ...defaultTheme.fontFamily.sans],
      heading: ['Founders Grotesk', ...defaultTheme.fontFamily.sans],
    },
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1440px',
      '2xl': '1980px',
    },
    colors: {
      gray: '#343436',
      lightGray: '#E3E2DD',
      black: '#000000',
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
      white: '#FFFFFF',
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
    extend: {
      borderRadius: {
        input: '14px',
      },
      letterSpacing: {
        tightest: ' -1.92px',
      },
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
      boxShadow: {
        'yamaha-grey':
          '0px 2px 2px 0px rgba(255, 255, 255, 0.10) inset, 0px 4px 20px 8px rgba(248, 248, 248, 0.10) inset, 0px 6px 2px 0px rgba(0, 0, 0, 0.10), 0px 4px 0px 0px var(--Button, #59585C)',
        'yamaha-grey-light':
          '0px 2px 2px 0px rgba(255, 255, 255, 0.10) inset, 0px 4px 20px 8px rgba(248, 248, 248, 0.10) inset, 0px 6px 2px 0px rgba(0, 0, 0, 0.10), 0px 4px 0px 0px var(--Button, #F5F5EF)',
        'yamaha-blue':
          '0px 2px 1px 0px rgba(255, 255, 255, 0.10) inset, 0px 4px 20px 8px rgba(248, 248, 248, 0.10) inset, 0px 6px 2px 0px rgba(0, 0, 0, 0.15), 0px 4px 0px 0px var(--Success, #3992FF)',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    plugin(function ({addUtilities, theme}) {
      addUtilities({
        '.card-shadow-light': {
          boxShadow:
            '0px 2px 2px 0px rgba(255, 255, 255, 0.10) inset, 0px 4px 20px 8px rgba(248, 248, 248, 0.10) inset, 0px 6px 2px 0px rgba(0, 0, 0, 0.10), 0px 4px 0px 0px #F5F5EF',
        },
        '.card-shadow-dark': {
          boxShadow:
            '0px 2px 2px 0px rgba(255, 255, 255, 0.10) inset, 0px 4px 20px 8px rgba(248, 248, 248, 0.10) inset, 0px 6px 2px 0px rgba(0, 0, 0, 0.10), 0px 4px 0px 0px #59585C;',
        },
      });
    }),
  ],
} satisfies Config;

export default config;
