import * as React from 'react';

/**
 * 앱의 AI 아이콘(2026-11-06 시안 A 확정: **평평한 한 색 + 반짝임 ✦**). 광택·빛 번짐·검정 스티커는 쓰지 않는다.
 *
 *   - `SparkMark` — 「쿡 픽」(밖에 떠 있는 추천 챗봇)과 AI 조건 칸·AI 버튼. 노란 바탕 위에 검정으로 쓴다.
 *   - `HatMark` — 「쿡 코치」(요리 레시피 창 안의 요리 한 건 전용 도우미). 검정 바탕 위에 노랑으로 쓴다.
 *   - `CalendarMark` — 「식단 짜기」(달력 안에 ✦). 노란 버튼 위의 검정 동그라미 안에 노랑으로 쓴다.
 *
 * **반짝임(✦)이 붙은 곳 = AI가 하는 곳(크레딧이 나가는 곳).** 선 굵기는 모두 1.9로 맞췄다.
 * 색은 `currentColor` 라 부모의 `color` 를 따른다 — 기본값은 각자 바탕 위에서 쓰는 색.
 */
interface MarkProps {
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

const base = (size: number, style?: React.CSSProperties): React.CSSProperties => ({
  width: size, height: size, flexShrink: 0, display: 'block', ...style,
});

export const SparkMark: React.FC<MarkProps> = ({ size = 28, color = '#1A1A1E', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={base(size, { color, ...style })}>
    <path d="M11 5C11.5 9.6 14.4 12.5 19 13C14.4 13.5 11.5 16.4 11 21C10.5 16.4 7.6 13.5 3 13C7.6 12.5 10.5 9.6 11 5Z" fill="currentColor" />
    <path d="M19 1.8C19.2 3.6 20.4 4.8 22.2 5C20.4 5.2 19.2 6.4 19 8.2C18.8 6.4 17.6 5.2 15.8 5C17.6 4.8 18.8 3.6 19 1.8Z" fill="currentColor" />
  </svg>
);

export const CalendarMark: React.FC<MarkProps> = ({ size = 28, color = '#FFD600', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={base(size, { color, ...style })}>
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 9.8h17M8 3v4M16 3v4" />
    </g>
    <path d="M12 11C12.28 13.1 13.5 14.32 15.6 14.6C13.5 14.88 12.28 16.1 12 18.2C11.72 16.1 10.5 14.88 8.4 14.6C10.5 14.32 11.72 13.1 12 11Z" fill="currentColor" />
  </svg>
);

export const HatMark: React.FC<MarkProps> = ({ size = 28, color = '#FFD600', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={base(size, { color, ...style })}>
    <g transform="translate(0 .45)" fill="none" stroke="currentColor" strokeWidth="1.9"
       strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c1.918 0 3.52 1.35 3.91 3.151a4 4 0 0 1 2.09 7.723l0 7.126h-12v-7.126a4 4 0 1 1 2.092-7.723a4 4 0 0 1 3.908-3.151z" />
      <path d="M6.161 17.009l11.839-.009" />
    </g>
    <path d="M12 8.4C12.28 10.5 13.5 11.72 15.6 12C13.5 12.28 12.28 13.5 12 15.6C11.72 13.5 10.5 12.28 8.4 12C10.5 11.72 11.72 10.5 12 8.4Z"
          fill="currentColor" />
  </svg>
);
