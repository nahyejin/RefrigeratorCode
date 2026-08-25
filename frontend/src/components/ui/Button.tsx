import * as React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** 가로 전체를 채운다 */
  block?: boolean;
  /** 텍스트 앞에 붙는 아이콘 */
  icon?: React.ReactNode;
}

/**
 * 앱 공통 버튼.
 *
 * 예전에는 버튼 스타일이 페이지마다 인라인으로 각각 작성돼 있어서
 * (MyPage 18개, RecipeSortBar 10개 …) 높이·색·radius가 제각각이었고,
 * 높이 28~30px 짜리가 많아 터치가 어려웠다.
 * 여기서 정의한 크기만 쓰면 md/lg 는 항상 44px 이상을 보장한다.
 */
const SIZES: Record<ButtonSize, React.CSSProperties> = {
  // sm 은 보조 동작 전용. 단독 터치 대상이면 md 이상을 쓸 것
  sm: { height: 36, padding: '0 12px', fontSize: 13, borderRadius: 8 },
  md: { height: 44, padding: '0 16px', fontSize: 15, borderRadius: 10 },
  lg: { height: 52, padding: '0 20px', fontSize: 16, borderRadius: 12 },
};

const VARIANTS: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--brand)', color: 'var(--ink-900)', border: '1px solid transparent' },
  secondary: { background: 'var(--ink-900)', color: '#FFFFFF', border: '1px solid transparent' },
  outline: { background: 'var(--surface)', color: 'var(--ink-700)', border: '1px solid var(--line-300)' },
  ghost: { background: 'transparent', color: 'var(--ink-700)', border: '1px solid transparent' },
  danger: { background: 'var(--danger)', color: '#FFFFFF', border: '1px solid transparent' },
};

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  block,
  icon,
  children,
  style,
  disabled,
  ...rest
}) => (
  <button
    {...rest}
    disabled={disabled}
    style={{
      ...SIZES[size],
      ...VARIANTS[variant],
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      width: block ? '100%' : undefined,
      fontWeight: 600,
      lineHeight: 1,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transition: 'filter 0.15s ease, transform 0.1s ease',
      whiteSpace: 'nowrap',
      ...style,
    }}
    onMouseDown={(e) => {
      if (!disabled) e.currentTarget.style.transform = 'scale(0.97)';
      rest.onMouseDown?.(e);
    }}
    onMouseUp={(e) => {
      e.currentTarget.style.transform = 'scale(1)';
      rest.onMouseUp?.(e);
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'scale(1)';
      rest.onMouseLeave?.(e);
    }}
  >
    {icon}
    {children}
  </button>
);

export default Button;
