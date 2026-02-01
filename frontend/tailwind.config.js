/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          500: '#1976D2',
          600: '#1565C0',
          700: '#0D47A1',
        },
        success: '#2E7D32',
        warning: '#F57C00',
        critical: '#C62828',
        info: '#0288D1',
      },
    },
  },
  plugins: [],
}
