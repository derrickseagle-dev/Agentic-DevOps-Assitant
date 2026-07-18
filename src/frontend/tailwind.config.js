/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/frontend/src/**/*.{js,ts,jsx,tsx}",
    "./src/frontend/index.html",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#636cff",
          hover: "#5558e6",
          light: "#8185ff",
        },
        surface: {
          DEFAULT: "#131320",
          hover: "#1a1a2e",
          elevated: "#1c1c30",
        },
        border: {
          DEFAULT: "#252540",
          light: "#333355",
        },
        muted: "#8888a0",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
