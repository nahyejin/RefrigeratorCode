import type { CSSProperties } from 'react';

/**
 * 재료 pill의 3가지 상태에 대한 단일 소스.
 *
 * 예전에는 pill 색과 범례 색이 6개 파일에 각각 하드코딩되어 있어서
 * 한쪽만 바뀌면 범례와 실제 pill 색이 어긋났다. 여기서만 바꾸면 전부 따라온다.
 *
 * 색 선택 의도:
 *  - 보유 재료가 카드마다 4~6개씩 나오는데 원색 노랑(#FFD600)으로 꽉 채우면
 *    화면이 노란 덩어리가 되고 브랜드 컬러가 "데이터 상태" 표시에 소모된다.
 *    → 연한 노랑 배경 + 진한 노랑 글자로 낮춤.
 *  - 부족 재료는 물러나야 하는 정보라 가장 옅게.
 *  - 대체 가능은 드물게 나오므로 진한 색을 그대로 유지해 눈에 띄게 둔다.
 */
export type PillState = 'owned' | 'substitutable' | 'missing';

export const PILL_COLORS: Record<
  PillState,
  { bg: string; fg: string; border: string; label: string; borderStyle?: 'solid' | 'dashed' }
> = {
  // 부족 재료는 "채워야 할 빈 칸"으로 읽히도록 흰 배경 + 점선 테두리.
  // 예전엔 가장 옅은 회색 채움이라 배경으로 물러나 있었는데,
  // 냉털이 판단에서 실제로 행동을 부르는 건 부족한 쪽이라 눈에 띄어야 한다.
  missing: {
    bg: '#FFFFFF',
    fg: '#5A5A63',
    border: '#A9A9B3',
    borderStyle: 'dashed',
    label: '부족 재료',
  },
  substitutable: {
    bg: '#3A3A42',
    fg: '#FFFFFF',
    border: '#3A3A42',
    label: '대체 가능',
  },
  owned: {
    bg: '#FFF1B8',
    fg: '#6B5200',
    border: '#F5DE86',
    label: '보유 재료',
  },
};

/** 범례에 표시할 순서 (부족 → 대체 → 보유) */
export const LEGEND_ORDER: PillState[] = ['missing', 'substitutable', 'owned'];

/** 카드 안 재료 pill 공통 스타일 */
export function pillStyle(state: PillState): CSSProperties {
  const c = PILL_COLORS[state];
  return {
    background: c.bg,
    color: c.fg,
    border: `1px ${c.borderStyle || 'solid'} ${c.border}`,
    borderRadius: 9999,
    padding: '0 11px',
    fontSize: 13,
    lineHeight: 1.3,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    height: 26,
    display: 'inline-flex',
    alignItems: 'center',
    flex: '0 0 auto',
  };
}

/** 범례의 색 견본(알약 모양) 스타일 */
export function legendSwatchStyle(state: PillState): CSSProperties {
  const c = PILL_COLORS[state];
  return {
    width: 22,
    height: 13,
    borderRadius: 9999,
    background: c.bg,
    border: `1px ${c.borderStyle || 'solid'} ${c.border}`,
    display: 'inline-block',
    flexShrink: 0,
  };
}
