/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT:'#C9A84C', light:'#E8C97A', dark:'#8B6E30' },
        dark: { DEFAULT:'#0A0A0A', 2:'#111111', 3:'#1A1A1A', 4:'#222222' }
      },
      fontFamily: { cairo: ['Cairo','sans-serif'] }
    }
  },
  plugins: []
}
