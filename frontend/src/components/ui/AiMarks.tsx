import * as React from 'react';

/**
 * 앱의 AI 아이콘(2026-11-06 시안 A 확정: **평평한 한 색 + 반짝임 ✦**). 광택·빛 번짐·검정 스티커는 쓰지 않는다.
 *
 *   - `PlateMark` — 「쿡 픽」(밖에 떠 있는 추천 챗봇). **접시 위에 ✦ 가 떠 있는** 그림. 노란 바탕 위에 검정으로 쓴다.
 *   - `HatMark` — 「쿡 코치」(요리 레시피 창 안의 요리 한 건 전용 도우미). 검정 바탕 위에 노랑으로 쓴다.
 *   - `CalendarMark` — 「식단 짜기」(달력 안에 ✦). 노란 버튼 위의 검정 동그라미 안에 노랑으로 쓴다.
 *
 * **반짝임(✦)이 붙은 곳 = AI가 하는 곳(크레딧이 나가는 곳).**
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

/** 네 꼭지 별(✦) 모양 길을 만든다. 중심 (cx, cy), 반지름 r. */
const sparkPath = (cx: number, cy: number, r: number) => {
  const p = (a: number, b: number) => `${(cx + a * r).toFixed(2)} ${(cy + b * r).toFixed(2)}`;
  return `M${p(0, -1)}C${p(0.078, -0.417)} ${p(0.417, -0.078)} ${p(1, 0)}C${p(0.417, 0.078)} ${p(0.078, 0.417)} ${p(0, 1)}`
    + `C${p(-0.078, 0.417)} ${p(-0.417, 0.078)} ${p(-1, 0)}C${p(-0.417, -0.078)} ${p(-0.078, -0.417)} ${p(0, -1)}Z`;
};

/**
 * 쿡 픽 — **접시 위에 ✦**(2026-11-06 「쿡 픽도 ✦ 만 있지 말고 접시에 ✦ 를 붙여 아이콘을 따로 만들어 달라」).
 * 위에서 내려다본 **식사 그림**: 둥근 접시(바깥 테두리 + 안쪽 면), 왼쪽 포크, 오른쪽 숟가락, 접시 한가운데 ✦ 하나.
 * 접시만 그렸더니 검은 고리로 읽혔다 — 포크와 숟가락이 있어야 한눈에 「밥상」으로 읽힌다. ✦ 가 AI 표시.
 * `color` 가 접시·식기·✦, `hole` 이 접시 안쪽 면(= 바탕색과 같게) — 노란 바탕 위에서는 (검정, 노랑).
 */
export const PlateMark: React.FC<MarkProps & { hole?: string }> = ({ size = 28, color = '#1A1A1E', hole = '#FFD600', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={base(size, { color, ...style })}>
    <circle cx="12" cy="12" r="6.2" fill="currentColor" />
    <circle cx="12" cy="12" r="4.7" fill={hole} />
    <path d={sparkPath(12, 12, 3.4)} fill="currentColor" />
    {/* 포크 */}
    <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.4 4.3v3a1.2 1.2 0 0 0 2.4 0v-3M3.6 4.3v6M3.6 8.5V19.8" />
      {/* 숟가락 자루 */}
      <path d="M20.4 10.2V19.8" />
    </g>
    {/* 숟가락 머리 */}
    <ellipse cx="20.4" cy="7.2" rx="1.75" ry="2.7" fill="currentColor" />
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

/**
 * 쿡 코치 — **통통하고 귀여운 요리사 모자**(2026-11-06). 선으로 그린 모자가 촌스럽다는 지적 → 꽉 찬 면으로 칠했고, 버튼 안에서 작아
 * 보인다는 지적 → 그림이 칸의 약 85% 를 채운다. 몸통에 **눈 둘과 작은 미소**를 얹어 귀엽게, **AI 표시(✦)는 모자 오른쪽 위에서 반짝**.
 * `color` 가 모자·반짝임, `hole` 이 눈·미소 — 검정 바탕 위에서는 (흰색, 검정), 흰 바탕 위에서는 (검정, 흰색).
 * (노랑을 아무 데나 쓰지 말라는 지적으로 기본색은 흰색이다.)
 */
export const HatMark: React.FC<MarkProps & { hole?: string }> = ({ size = 28, color = '#FFFFFF', hole = '#1A1A1E', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={base(size, { color, ...style })}>
    <g transform="translate(-1.4 1)" fill="currentColor">
      <circle cx="7.2" cy="10.2" r="4.4" />
      <circle cx="12" cy="7.6" r="5.2" />
      <circle cx="16.8" cy="10.2" r="4.4" />
      <rect x="6.2" y="10" width="11.6" height="7.4" rx="1.6" />
      <rect x="5.6" y="18.3" width="12.8" height="3.1" rx="1.55" />
    </g>
    <circle cx="8.9" cy="14.6" r="1" fill={hole} />
    <circle cx="12.3" cy="14.6" r="1" fill={hole} />
    <path d="M9.7 16.6Q10.6 17.5 11.5 16.6" stroke={hole} strokeWidth="1.1" strokeLinecap="round" fill="none" />
    <path d="M20.2 2.4C20.37 3.68 21.12 4.43 22.4 4.6C21.12 4.77 20.37 5.52 20.2 6.8C20.03 5.52 19.28 4.77 18 4.6C19.28 4.43 20.03 3.68 20.2 2.4Z" fill="currentColor" />
  </svg>
);
