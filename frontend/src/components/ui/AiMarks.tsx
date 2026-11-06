import * as React from 'react';

/**
 * 앱의 두 AI 도우미 아이콘(2026-11-06 시안 확정). 둘 다 **반짝임(✦)이 몸통 한가운데**에 들어간 선 아이콘이다.
 *
 *   - `PotMark` — 「뭐 먹지」(밖에 떠 있는 추천 챗봇). 노란 바탕 위에 검정으로 쓴다.
 *   - `HatMark` — 「쿡 코치」(요리 드로어 안의 요리 한 건 전용 도우미). 검정 바탕 위에 노랑으로 쓴다.
 *
 * 같은 가족으로 보이되 색을 뒤집어 한눈에 가른다. 선 굵기는 둘 다 1.9로 맞췄다.
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

export const PotMark: React.FC<MarkProps> = ({ size = 28, color = '#1A1A1E', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={base(size, { color, ...style })}>
    <g transform="translate(0 -1.3)">
      <path d="M4.5 9h15v8.5a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3z" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M3 9h18M1.8 12H4.5M19.5 12h2.7M10 6.2h4" fill="none" stroke="currentColor"
            strokeWidth="1.9" strokeLinecap="round" />
      <path d="M12 11.2C12.25 13.1 13.5 14.35 15.4 14.6C13.5 14.85 12.25 16.1 12 18C11.75 16.1 10.5 14.85 8.6 14.6C10.5 14.35 11.75 13.1 12 11.2Z"
            fill="currentColor" />
    </g>
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
