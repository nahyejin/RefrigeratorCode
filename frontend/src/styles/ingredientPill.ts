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
  { bg: string; fg: string; border: string; label: string; borderStyle?: 'solid' | 'dashed'; dot?: string }
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
  // 2026-10-10: 연한 노랑(#FFF1B8)은 탁해서 촌스럽고, 샛노랑(#FFD600)은 카드마다 4~6개가 깔리면 너무 튄다는
  // 지적이라 **흰 바탕 + 앞에 노란 점 하나**로(후보 중 사용자가 고름). 보유 재료는 "당연한 정보"라 물러나 있어야
  // 하고, 눈에 띄어야 하는 건 부족(점선)·대체(검정)다. 노란색은 점으로만 남아 브랜드 느낌을 지킨다.
  owned: {
    bg: '#FFFFFF',
    fg: '#1A1A1E',
    border: '#E4E4E8',
    label: '보유 재료',
    dot: '#FFD600',
  },
};

/** 범례에 표시할 순서 (부족 → 대체 → 보유) */
export const LEGEND_ORDER: PillState[] = ['missing', 'substitutable', 'owned'];

/** 카드 안 재료 pill 공통 스타일 */
export function pillStyle(state: PillState): CSSProperties {
  const c = PILL_COLORS[state];
  return {
    // 점이 있는 상태(보유)는 배경 그림으로 점을 그린다 — 마크업을 건드리지 않고 모든 칩에 적용된다.
    background: c.dot ? `radial-gradient(circle at 12px 50%, ${c.dot} 0 3.5px, transparent 4px), ${c.bg}` : c.bg,
    color: c.fg,
    border: `1px ${c.borderStyle || 'solid'} ${c.border}`,
    borderRadius: 9999,
    padding: c.dot ? '0 11px 0 22px' : '0 11px',
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
    background: c.dot ? `radial-gradient(circle at 6px 50%, ${c.dot} 0 3px, transparent 3.5px), ${c.bg}` : c.bg,
    border: `1px ${c.borderStyle || 'solid'} ${c.border}`,
    display: 'inline-block',
    flexShrink: 0,
  };
}
