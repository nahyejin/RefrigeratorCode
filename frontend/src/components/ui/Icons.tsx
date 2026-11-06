import * as React from 'react';

/**
 * 앱의 선 아이콘 한 세트(2026-11-06).
 *
 * 예전엔 쿡 픽·쿡 코치·식단 짜기·카메라 아이콘을 직접 그렸는데 모양과 두께가 제각각이고 스티커·눈·구멍 같은 장식이 붙어 「촌스럽다」는
 * 지적을 받았다. 이제 **잘 만든 오픈소스 선 아이콘 Lucide**(https://lucide.dev, ISC 라이선스 — 상업 이용 가능, 저작권 문구 유지)에서
 * 필요한 것만 옮겨 쓴다. 두께·모서리가 모두 같다. 색은 `currentColor`(부모 글자색)를 따른다.
 *
 * 아이콘을 더 쓸 때는 직접 그리지 말고 Lucide 에서 같은 방식으로 옮긴다.
 */
interface IconProps {
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
}

const Svg: React.FC<IconProps & { children: React.ReactNode }> = ({ size = 24, strokeWidth = 2, style, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    style={{ flexShrink: 0, display: 'block', ...style }}
  >
    {children}
  </svg>
);

/** 포크·나이프(utensils) — 쿡 픽 */
export const UtensilsIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
    <path d="M7 2v20" />
    <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
  </Svg>
);

/** 요리사 모자(chef-hat) — 쿡 코치 */
export const ChefHatIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.457.316-.844.727-1.041a4 4 0 0 0-2.134-7.589 5 5 0 0 0-9.186 0 4 4 0 0 0-2.134 7.588c.411.198.727.585.727 1.041V20a1 1 0 0 0 1 1Z" />
    <path d="M6 17h12" />
  </Svg>
);

/** 달력 체크(calendar-check) — 식단 짜기 */
export const CalendarCheckIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
    <path d="m9 16 2 2 4-4" />
  </Svg>
);

/** 카메라(camera) — 사진으로 재료 담기 */
export const CameraIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
    <circle cx="12" cy="13" r="3" />
  </Svg>
);

/** 반짝임(sparkles) — AI 가 하는 일 */
export const SparklesIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  </Svg>
);
