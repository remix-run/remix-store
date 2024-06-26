/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,jsx,ts,tsx}'],
  theme: {
    colors: {
      cyan: '#3DEFE9',
      blue: '#3992FF',
      green: '#6BD968',
      yellow: '#FECC1B',
      magenta: '#D83BD2',
      red: '#F44250',
      'shop-pay': '#5A31F4',
      success: '#3992FF',
      error: '#F44250',
      warning: '#FECC1B',

      // Neutrals
      link: {
        light: '#000000',
        dark: '#FFFFFF'
      },
      text: {
        light: '#434343',
        dark: '#DADADA'
      },
      border: {
        light: '#80808026',
        dark: '#808080'
      },
      field: {
        light: '#0000000D',
        dark: '#00000033'
      },
      button: {
        light: '#F5F5EF',
        dark: '#59585C'
      },
      card: {
        light: '#EAEAE4',
        dark: '#343436'
      },
      background: {
        light: '#E3E2DD',
        dark: '#242426'
      },
    },
    extend: {},
  },
  plugins: [],
};
