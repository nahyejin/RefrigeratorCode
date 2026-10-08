import * as React from 'react';

/**
 * 두 칸(또는 세 칸) 중 하나를 고르는 **알약형 고르개.**
 * 마이캘린더의 `내 요리만 / 우리 식구 전체` 가 이 모양이고, 같은 성격의
 * 고르개는 앱 어디서나 이것을 쓴다(2026-10-08 — 마이페이지의 같은 고르개가
 * 밑줄 탭이라 "탭처럼 안 보인다" 는 지적을 받았다).
 *
 * 설계상 지켜야 하는 것 둘:
 *  - **칸 폭을 같게**(`1fr 1fr`). 폭이 글자 길이를 따르면 50% 폭으로 미끄러지는
 *    검은 판이 글자와 어긋나 깨져 보인다(2026-09-15 실사용 지적).
 *  - 고른 칸은 **검은 판 + 흰 글자.** 색만 바꾸면(회색 글자 → 진한 글자) 어느
 *    쪽이 켜진 것인지 한눈에 안 들어온다.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

function SegmentedToggle<T extends string>({
  value, options, onChange, height = 28, style,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  height?: number;
  style?: React.CSSProperties;
}) {
  const index = Math.max(0, options.findIndex(o => o.value === value));
  const pct = 100 / options.length;

  return (
    <div
      style={{
        position: 'relative', display: 'inline-grid', flexShrink: 0,
        gridTemplateColumns: options.map(() => '1fr').join(' '),
        padding: 3, borderRadius: 10, background: 'var(--surface-sub)',
        border: '1px solid var(--line-200)',
        ...style,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute', top: 3, bottom: 3, left: 3,
          width: `calc(${pct}% - 3px)`,
          borderRadius: 8, background: 'var(--ink-900)',
          transform: `translateX(${index * 100}%)`,
          transition: 'transform .2s cubic-bezier(.4,0,.2,1)',
        }}
      />
      {options.map(({ value: key, label }) => {
        const on = key === value;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(key)}
            style={{
              position: 'relative', zIndex: 1, height, padding: '0 12px',
              border: 'none', background: 'transparent', borderRadius: 8, cursor: 'pointer',
              color: on ? '#FFFFFF' : 'var(--ink-500)',
              fontSize: 12.5, fontWeight: on ? 700 : 500,
              whiteSpace: 'nowrap', transition: 'color .2s ease',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedToggle;
