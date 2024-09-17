import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config = {
  darkMode: "selector",
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  prefix: "",
  theme: {
    fontFamily: {
      sans: ['"Inter"', ...defaultTheme.fontFamily.sans],
      mono: ['"Source Code Pro"', ...defaultTheme.fontFamily.mono],
    },
    screens: {
      sm: "430px",
      md: "800px",
      lg: "1200px",
      xl: "1600px",
      "2xl": "1920px",
    },
    colors: {
      inherit: "inherit",
      current: "currentColor",
      transparent: "transparent",
      cyan: { brand: "#3DEFE9" },
      blue: { brand: "#3992FF", led: "#C8DFEA" },
      green: { brand: "#6BD968" },
      yellow: { brand: "#FECC1B" },
      magenta: { brand: "#D83BD2" },
      red: { brand: "#F44250" },
      black: "#000000",
      white: "#FFFFFF",
      neutral: {
        50: "#F1F1EC",
        100: "#EAEAE4",
        200: "#E3E2DD",
        300: "#DADADA",
        400: "#808080",
        500: "#59585C",
        600: "#434343",
        700: "#343436",
        800: "#242426",
        900: "#1D1D1E",
      },
      "shop-pay": "#5A31F4",
    },
    fontSize: {
      ...defaultTheme.fontSize,
      base: ["1rem", { lineHeight: "1.4rem" }],
      "6xl": ["4rem", { lineHeight: "1" }],
      "7xl": ["4.5rem", { lineHeight: "1" }],
      "8xl": ["5.25rem", { lineHeight: "1" }],
      "9xl": ["8rem", { lineHeight: "1" }],
    },
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      borderRadius: {
        input: "14px",
      },
      letterSpacing: {
        tightest: " -1.92px",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      // There may be a better way to do this with tailwind plugins
      // The defaults for --yamaha-shadow-color are set in tailwind.css
      boxShadow: {
        "yamaha-primary":
          "0px 2px 1px 0px rgba(255, 255, 255, 0.10) inset, 0px 4px 20px 8px rgba(248, 248, 248, 0.10) inset, 0px 6px 2px 0px rgba(0, 0, 0, 0.15), 0px 4px 0px 0px var(--yamaha-shadow-color)",
        "yamaha-secondary":
          "0px 2px 2px 0px rgba(255, 255, 255, 0.10) inset, 0px 4px 20px 8px rgba(248, 248, 248, 0.10) inset, 0px 6px 2px 0px rgba(0, 0, 0, 0.10), 0px 4px 0px 0px var(--yamaha-shadow-color)",
        "dropdown-menu":
          "0px 2px 5px 0px rgba(0, 0, 0, 0.10), 0px 24px 32px 0px rgba(0, 0, 0, 0.15)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
