/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#075E54',
        secondary: '#128C7E',
        accent: '#25D366',
        background: '#111B21'
      }
    }
  },
  plugins: []
}
