import * as React from 'react';
import { LEGEND_ORDER, PILL_COLORS, legendSwatchStyle } from '../styles/ingredientPill';

interface IngredientLegendProps {
  /** 오른쪽에 "총 N건"으로 표시할 값. 넘기지 않으면 건수를 숨긴다. */
  total?: number;
  style?: React.CSSProperties;
}

const formatCount = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * 재료 pill 색상 범례.
 * 예전엔 이 마크업이 6개 파일에 그대로 복붙되어 있었고, pill 색을 바꿔도
 * 범례는 따라오지 않는 상태였다. 색은 styles/ingredientPill.ts 한 곳에서만 정의한다.
 */
const IngredientLegend: React.FC<IngredientLegendProps> = ({ total, style }) => (
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
      {LEGEND_ORDER.map((state) => (
        <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={legendSwatchStyle(state)} />
          <span style={{ color: '#3A3A42', fontSize: 12, whiteSpace: 'nowrap' }}>
            {PILL_COLORS[state].label}
          </span>
        </div>
      ))}
    </div>
    {typeof total === 'number' && (
      <span style={{ color: '#6A6A73', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
        총 {formatCount(total)}건
      </span>
    )}
  </div>
);

export default IngredientLegend;
