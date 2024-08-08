import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config = {
  darkMode: "selector",
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  prefix: "",
  theme: {
    fontFamily: {
      body: ['"Inter"', ...defaultTheme.fontFamily.sans],
      heading: ['"Jersey 10"', ...defaultTheme.fontFamily.sans],
      mono: ['"Sometype Mono"', ...defaultTheme.fontFamily.mono],
    },
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1440px",
      "2xl": "1980px",
    },
    colors: {
      inherit: "inherit",
      current: "currentColor",
      transparent: "transparent",
      cyan: { brand: "#3DEFE9" },
      blue: { brand: "#3988F8", led: "#C8DFEA" },
      green: { brand: "#6BD968" },
      yellow: { brand: "#FECC1B" },
      magenta: { brand: "#D83BD2" },
      red: { brand: "#F44250" },
      "shop-pay": { brand: "#5A31F4" },
      success: { brand: "#3992FF" },
      error: { brand: "#F44250" },
      warning: { brand: "#FECC1B" },
      black: "#000000",
      white: "#FFFFFF",
      neutral: {
        50: "#F5F5EF",
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
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
