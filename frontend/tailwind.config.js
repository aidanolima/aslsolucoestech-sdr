/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#090d16', // Slate/Zinc Dark
        card: '#0f172a',
        primary: '#6366f1',   // Indigo Accent
      }
    },
  },
  plugins: [],
}