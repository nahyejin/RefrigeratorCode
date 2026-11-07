/**
 * BrandMark 사용 예 3개(문서용 — 앱에 연결하지 않음).
 */
import * as React from 'react';
import BrandMark from './BrandMark';

/** 1) 스플래시/로그인 상단 — 큰 마크가 한 번 앉는다(검정 바탕, reverse) */
export const SplashExample: React.FC = () => (
  <div style={{ background: 'var(--ink-900, #1A1A1E)', minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
    <BrandMark size={120} tone="reverse" seated title="쿡매치" />
  </div>
);

/** 2) 빈 화면 — 레시피 목록 「조건에 맞는 레시피가 없어요」 (밝은 배경) */
export const EmptyExample: React.FC<{ onReset: () => void }> = ({ onReset }) => (
  <div style={{ textAlign: 'center', padding: '56px 24px' }}>
    <BrandMark size={88} tone="color" ingredient="tomato" />
    <div style={{ marginTop: 16, fontSize: 'var(--text-lg, 18px)', fontWeight: 800, color: 'var(--ink-900, #1A1A1E)' }}>
      맞는 레시피가 없어요
    </div>
    <div style={{ marginTop: 6, fontSize: 'var(--text-body, 15px)', color: 'var(--ink-500, #6A6A73)' }}>
      재료를 하나 줄여 보거나 다른 이름으로 찾아보세요
    </div>
    <button
      type="button"
      onClick={onReset}
      style={{
        marginTop: 20,
        minHeight: 'var(--tap-min, 44px)',
        padding: '0 24px',
        borderRadius: 9999,
        border: 0,
        background: 'var(--brand, #FFD600)',
        color: 'var(--ink-900, #1A1A1E)',
        fontWeight: 800,
      }}
    >
      조건 초기화
    </button>
  </div>
);

/** 3) 매칭 배지 — 내 재료 M/M 일 때만(「딱」). 16px, 앉는 모션은 처음 나타날 때 한 번 */
export const MatchBadgeExample: React.FC<{ have: number; total: number }> = ({ have, total }) => {
  const perfect = total > 0 && have === total;
  return (
    <b style={{ color: perfect ? 'var(--ink-900, #1A1A1E)' : 'var(--ink-700, #3A3A42)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      내 재료 {have}/{total}
      {perfect && <BrandMark size={16} tone="color" seated title="딱 맞아요" />}
    </b>
  );
};
