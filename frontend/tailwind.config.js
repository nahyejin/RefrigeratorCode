/** @type {import('tailwindcss').Config} */
// 색상 팔레트는 src/index.css 의 :root 토큰과 같은 값을 유지할 것.
// (인라인 style 에서는 var(--ink-500) 형태로, 클래스에서는 text-ink-500 형태로 쓴다)
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    'bg-[#FFD600]',
    'bg-[#6A6A73]',
    'bg-[#D2D2D8]',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Pretendard', 'sans-serif'],
      },
      // 타이포 스케일 — src/index.css 의 --text-* 토큰과 같은 값 유지.
      // 기존 Tailwind 기본값(xs 12 / sm 14 / base 16)보다 한 단계씩 키움:
      // 실측 시 본문의 65%가 13px 미만이라 전체적으로 작아 보였기 때문.
      fontSize: {
        caption: ['12px', { lineHeight: '1.45' }],
        xs: ['13px', { lineHeight: '1.45' }],
        sm: ['15px', { lineHeight: '1.5' }],
        base: ['16px', { lineHeight: '1.5' }],
        lg: ['18px', { lineHeight: '1.4' }],
        xl: ['22px', { lineHeight: '1.35' }],
        '2xl': ['26px', { lineHeight: '1.3' }],
      },
      colors: {
        ink: {
          900: '#1A1A1E',
          700: '#3A3A42',
          500: '#6A6A73',
          400: '#9A9AA2',
          300: '#B8B8C0',
        },
        line: {
          200: '#E6E6EA',
          300: '#D2D2D8',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          sub: '#F5F5F7',
        },
        brand: {
          DEFAULT: '#FFD600',
          light: '#FFE45C',
          strong: '#F2C200',
          soft: '#FFF6C2',
          onSoft: '#6B5200',
        },
        text: {
          DEFAULT: '#3A3A42',
        },
        // 기존 코드 호환용 별칭 (신규 코드에서는 위 토큰을 쓸 것)
        customYellow: '#FFD600',
        customGray: '#D2D2D8',
        customDarkGray: '#6A6A73',
      },
    },
  },
  plugins: [],
}
