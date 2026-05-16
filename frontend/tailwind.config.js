/** @type {import('tailwindcss').Config} */
export default {
  content:["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'serif'],
        sans: ['"Inter"', 'sans-serif'],
      },
      colors: {
        nobel: { gold: '#C5A059', dark: '#1a1a1a', cream: '#F9F8F4' }
      }
    },
  },
  plugins:[],
}