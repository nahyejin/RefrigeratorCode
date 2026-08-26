import * as React from 'react';

interface FilterGroupProps {
  /** 그룹 번호 (1, 2, 3…) */
  index?: number;
  title: string;
  /** 제목 옆 보조 설명 */
  hint?: string;
  children: React.ReactNode;
}

/**
 * 필터 시트의 조건 그룹.
 *
 * 정리 전에는 `■ 채널선택` 처럼 네모 문자를 붙인 제목과 얇은 구분선만 있어서
 *  - 각 묶음이 어디서 시작해 어디서 끝나는지 알기 어렵고
 *  - 구분선이 내용에 바짝 붙어 답답했으며
 *  - 무엇보다 **조건들이 AND 로 결합된다는 사실이 전혀 드러나지 않았다.**
 * 여기서는 번호 + 제목으로 묶음을 명확히 하고, 그룹 사이에 "그리고" 를 글자로 표시한다.
 */
export const FilterGroup: React.FC<FilterGroupProps> = ({ index, title, hint, children }) => (
  <section style={{ paddingTop: 4 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
      {index !== undefined && (
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: 6,
            background: 'var(--ink-900)',
            color: '#FFFFFF',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
            alignSelf: 'center',
          }}
        >
          {index}
        </span>
      )}
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-900)' }}>{title}</span>
      {hint && <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>{hint}</span>}
    </div>
    {children}
  </section>
);

/**
 * 그룹 사이의 "그리고(AND)" 구분.
 * 조건이 AND 로 묶인다는 것은 시각적 구분선만으로는 전달되지 않아 글자로 명시한다.
 */
export const AndDivider: React.FC = () => (
  <div
    aria-hidden
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '18px 0',
    }}
  >
    <span style={{ flex: 1, height: 1, background: 'var(--line-200)' }} />
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.4px',
        color: 'var(--ink-400)',
        whiteSpace: 'nowrap',
      }}
    >
      그리고
    </span>
    <span style={{ flex: 1, height: 1, background: 'var(--line-200)' }} />
  </div>
);

export default FilterGroup;
