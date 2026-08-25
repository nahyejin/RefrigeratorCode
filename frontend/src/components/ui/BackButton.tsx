import * as React from 'react';

interface BackButtonProps {
  onClick: () => void;
  /** 팝업 좌상단에 절대배치 (기본 true) */
  absolute?: boolean;
  label?: string;
  style?: React.CSSProperties;
}

/**
 * 뒤로가기 버튼 — `CloseButton` 과 **완전히 같은 규격**을 쓴다.
 *
 * 정리 전에는 뒤로가기 표현이 제각각이었다:
 *   PNG 이미지(`뒤로가기_GREY.png`, `뒤로가기.png`) / `←` 문자 /
 *   크기도 13px, 24px, padding 4px 등 서로 다름.
 * 닫기(X)는 둥근 사각형 버튼으로 통일해 놓고 뒤로가기만 다르면 짝이 맞지 않아
 * 같은 팝업 안에서 두 버튼이 다른 물건처럼 보인다.
 * → 36×36 둥근 사각형 + 20px SVG 로 X 와 동일하게 맞춘다.
 */
const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  absolute = true,
  label = '뒤로가기',
  style,
}) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    style={{
      ...(absolute ? { position: 'absolute', top: 10, left: 10 } : {}),
      width: 36,
      height: 36,
      padding: 0,
      boxSizing: 'border-box',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--surface-sub)',
      border: '1px solid var(--line-200)',
      borderRadius: 10,
      cursor: 'pointer',
      color: 'var(--ink-700)',
      flexShrink: 0,
      transition: 'background 0.15s ease, border-color 0.15s ease',
      ...style,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = '#ECECF0';
      e.currentTarget.style.borderColor = 'var(--line-300)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'var(--surface-sub)';
      e.currentTarget.style.borderColor = 'var(--line-200)';
    }}
  >
    {/* flex 안에서 SVG 가 0px 로 찌그러지지 않도록 크기 고정 */}
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ width: 20, height: 20, flexShrink: 0, display: 'block' }}
    >
      <path
        d="M15 5l-7 7 7 7"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
);

export default BackButton;
