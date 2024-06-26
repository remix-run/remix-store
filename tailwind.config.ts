/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  theme: {
    colors: {
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
      black: '#000000',

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
    extend: {},
  },
  plugins: [],
};
