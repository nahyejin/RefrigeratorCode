import * as React from 'react';
import { useEdgeSwipeBack } from '../../utils/edgeSwipeBack';

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
 * → 36×36 + 20px SVG 로 X 와 동일하게 맞춘다.
 *
 * 2026-11-06: 닫기(×)가 **회색 상자 없이 아이콘만**으로 바뀌었는데(`CloseButton`) 뒤로가기만 회색 상자에 테두리가
 * 남아 짝이 다시 어긋났다 — 같은 방식으로 맞춘다(상자·테두리 없이 화살표만, 마우스를 올리면 옅은 판).
 */
const BackButton: React.FC<BackButtonProps> = ({
  onClick,
  absolute = true,
  label = '뒤로가기',
  style,
}) => {
  // 아이폰: 이 버튼이 떠 있는 화면에서만 왼쪽 끝 스와이프 = 이 버튼 누르기(utils/edgeSwipeBack)
  useEdgeSwipeBack(onClick);
  return (
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
      background: 'transparent',
      border: '1px solid transparent',
      borderRadius: 10,
      cursor: 'pointer',
      color: 'var(--ink-500)',
      flexShrink: 0,
      transition: 'background 0.15s ease, border-color 0.15s ease',
      ...style,
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'var(--surface-sub)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'transparent';
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
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
  );
};

export default BackButton;
