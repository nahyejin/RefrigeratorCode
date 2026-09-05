import * as React from 'react';
import { LEGEND_ORDER, PILL_COLORS, legendSwatchStyle } from '../styles/ingredientPill';

interface IngredientLegendProps {
  /** 오른쪽에 "총 N건"으로 표시할 값. 넘기지 않으면 건수를 숨긴다. */
  total?: number;
  style?: React.CSSProperties;
  /**
   * 색 설명을 감춘다 (건수만 남긴다).
   *
   * 요즘인기는 재료 칩을 **접어 두므로**, 색 범례가 안 보이는 것을 설명하는
   * 꼴이 된다. 게다가 섹션마다 반복돼서 화면 전체가 범례로 덮였다.
   * 칩을 펴면 칩 자체가 색을 보여 준다 — 그때 굳이 설명이 필요하지 않다.
   */
  swatchesHidden?: boolean;
}

const formatCount = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * 재료 pill 색상 범례.
 * 예전엔 이 마크업이 6개 파일에 그대로 복붙되어 있었고, pill 색을 바꿔도
 * 범례는 따라오지 않는 상태였다. 색은 styles/ingredientPill.ts 한 곳에서만 정의한다.
 */
const IngredientLegend: React.FC<IngredientLegendProps> = ({ total, style, swatchesHidden }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      ...style,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      {!swatchesHidden && LEGEND_ORDER.map((state) => (
        <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={legendSwatchStyle(state)} />
          <span style={{ color: '#3A3A42', fontSize: 13, whiteSpace: 'nowrap' }}>
            {PILL_COLORS[state].label}
          </span>
        </div>
      ))}
    </div>
    {typeof total === 'number' && (
      <span style={{ color: '#6A6A73', fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0 }}>
        총 {formatCount(total)}건
      </span>
    )}
  </div>
);

export default IngredientLegend;
