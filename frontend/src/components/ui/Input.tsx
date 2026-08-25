import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** 오른쪽에 붙는 요소 (검색 아이콘, 비밀번호 보기 등) */
  trailing?: React.ReactNode;
  block?: boolean;
}

/**
 * 앱 공통 입력창.
 * 테두리와 포커스 링을 명시해 "입력할 수 있는 곳"이 한눈에 보이도록 한다.
 * (예전 챗 입력창처럼 흰 배경에 연회색이면 입력 영역인지 구분이 안 됨)
 * 높이는 44px 고정 — iOS 에서 16px 미만이면 포커스 시 화면이 확대되므로 글자도 16px.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ trailing, block = true, style, disabled, ...rest }, ref) => (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: block ? '100%' : undefined,
      }}
    >
      <input
        {...rest}
        ref={ref}
        disabled={disabled}
        className={`ui-input ${rest.className || ''}`}
        style={{
          width: '100%',
          height: 44,
          padding: trailing ? '0 44px 0 14px' : '0 14px',
          borderRadius: 10,
          border: '1px solid var(--line-300)',
          background: disabled ? 'var(--surface-sub)' : 'var(--surface)',
          color: 'var(--ink-900)',
          fontSize: 16,
          outline: 'none',
          ...style,
        }}
      />
      {trailing && (
        <span
          style={{
            position: 'absolute',
            right: 10,
            display: 'inline-flex',
            alignItems: 'center',
            color: 'var(--ink-400)',
          }}
        >
          {trailing}
        </span>
      )}
    </div>
  )
);

Input.displayName = 'Input';

export default Input;
