/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#E91E63', // Pink from the screenshot
        secondary: '#00BCD4', // Cyan/Blue from the screenshot
        dark: '#1a1a1a',
        light: '#f5f5f5',
      }
    },
  },
  plugins: [],
}
