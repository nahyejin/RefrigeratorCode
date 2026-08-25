import * as React from 'react';

interface LoadingIndicatorProps {
  /** 문구를 숨기고 점만 표시 */
  dotsOnly?: boolean;
  /** 화면 전체를 채우는 위치로 배치 (초기 진입 등) */
  fullscreen?: boolean;
  style?: React.CSSProperties;
}

/**
 * 앱 공통 로딩 표시.
 *
 * 예전에는 화면마다 표현이 달랐다 —
 *  - MyFridge: 점 3개 + 한글 "로딩 중..."
 *  - Popular / 완료목록: 점 3개만 (문구 없음)
 *  - RecipeList / IngredientDetail: 링 스피너 + "Loading..."
 * 같은 앱인데 탭을 옮길 때마다 다른 로딩이 뜨면 완성도가 떨어져 보인다.
 * 여기 하나로 통일하고, 점이 순서대로 튀는 형태로 맞춘다.
 */
const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ dotsOnly, fullscreen, style }) => (
  <div
    role="status"
    aria-live="polite"
    aria-label="불러오는 중"
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      ...(fullscreen
        ? { minHeight: '50vh', width: '100%' }
        : { padding: '14px 0 18px', width: '100%' }),
      ...style,
    }}
  >
    <span className="loading-dots" aria-hidden>
      <span />
      <span />
      <span />
    </span>
    {!dotsOnly && (
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--ink-500)',
          letterSpacing: '0.3px',
        }}
      >
        Loading...
      </span>
    )}
  </div>
);

export default LoadingIndicator;
