/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-[#FFD600]',
    'bg-[#555]',
    'bg-[#D1D1D1]'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'sans-serif'],
      },
      colors: {
        text: {
          DEFAULT: '#404040',
        },
        customYellow: '#FFD600',
        customGray: '#D1D1D1',
        customDarkGray: '#555',
      },
    },
  },
  plugins: [],
}

