/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#e6f3fb",
          100: "#b3d9f5",
          200: "#80bfee",
          300: "#4da5e8",
          400: "#2691df",
          500: "#0078d2",
          600: "#0078d2",
          700: "#0066b3",
          800: "#004275",
          900: "#003056",
          blue:   "#0078d2",
          cyan:   "#5ab4d2",
          green:  "#78b41e",
          amber:  "#f0b400",
          orange: "#f0963c",
          gray:   "#5a5a5a",
        },
        trust: {
          low:    "#ef4444",
          medium: "#f0b400",
          high:   "#78b41e",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.10)",
      },
    },
  },
  plugins: [],
};
