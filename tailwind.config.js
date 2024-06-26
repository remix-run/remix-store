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

      // Default theme
      link: '#000000',
      text: '#434343',
      border: '#80808026',
      field: '#0000000D',
      button: '#F5F5EF',
      card: '#EAEAE4',
      background: '#E3E2DD',

      // Dark theme
      'link-dark': '#FFFFFF',
      'text-dark': '#DADADA',
      'border-dark': '#808080',
      'field-dark': '#00000033',
      'button-dark': '#59585C',
      'card-dark': '#343436',
      'background-dark': '#242426',
    },
    extend: {},
  },
  plugins: [],
};
