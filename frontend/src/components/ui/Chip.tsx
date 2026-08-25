import * as React from 'react';

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** 선택된 상태 (필터 칩 등) */
  selected?: boolean;
  /** 눌러서 동작하는 칩인지 (커서/터치 영역이 달라진다) */
  interactive?: boolean;
  size?: 'sm' | 'md';
}

/**
 * 태그 / 필터 칩.
 * 재료 pill 은 상태(보유·부족·대체)가 있어서 styles/ingredientPill.ts 를 따로 쓴다.
 * 이쪽은 상태가 없는 일반 태그·필터용.
 */
const Chip: React.FC<ChipProps> = ({
  selected,
  interactive,
  size = 'md',
  children,
  style,
  ...rest
}) => (
  <span
    {...rest}
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: size === 'sm' ? 30 : 36,
      padding: size === 'sm' ? '0 12px' : '0 14px',
      borderRadius: 9999,
      fontSize: size === 'sm' ? 13 : 15,
      fontWeight: selected ? 600 : 400,
      whiteSpace: 'nowrap',
      background: selected ? 'var(--ink-900)' : 'var(--surface)',
      color: selected ? '#FFFFFF' : 'var(--ink-700)',
      border: `1px solid ${selected ? 'var(--ink-900)' : 'var(--line-300)'}`,
      cursor: interactive ? 'pointer' : 'default',
      transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
      ...style,
    }}
  >
    {children}
  </span>
);

export default Chip;
