import * as React from 'react';

interface CloseButtonProps {
  onClick: () => void;
  /** 팝업 우상단에 절대배치 (기본 true) */
  absolute?: boolean;
  style?: React.CSSProperties;
  /**
   * 어두운 배경(예: HomeInstallPrompt의 짙은 카드) 위에 놓일 때 true.
   * 기본(연한 회색 배경 + 어두운 아이콘) 조합은 밝은 카드 전제라, 어두운
   * 카드 위에서는 이 버튼만 하얗게 튀어 보인다는 지적을 받아 추가했다.
   */
  dark?: boolean;
  /**
   * `down` — × 대신 ⌄. **닫는 게 아니라 내리는** 시트(대화가 남아 있는 쿡 코치 시트)에 쓴다.
   * ×는 「닫으면 없어진다」로 읽히기 때문이다(2026-11-06).
   */
  kind?: 'x' | 'down';
}

/**
 * 팝업 공통 닫기 버튼.
 *
 * 예전에는 `×` 문자를 그대로 쓰는 곳이 많았는데, 글자라서 폰트에 따라 크기·두께가
 * 달라지고 얇아서 잘 보이지 않았다. 위치도 팝업마다 제각각이었다.
 * → 44px 터치 영역 + 연한 회색 원형 배경 + 굵은 SVG 선으로 통일한다.
 */
const CloseButton: React.FC<CloseButtonProps> = ({ onClick, absolute = true, style, dark = false, kind = 'x' }) => {
  // 밝은 바탕에서는 **상자 없이 × 만**(2026-11-06). 제목 옆에 회색 상자가 붙어 있으면 제목 줄이 무겁고,
  // 닫기는 늘 거기 있는 것이라 눈에 띌 필요가 없다. 마우스를 올렸을 때만 옅은 판이 보인다.
  const baseBg = dark ? 'rgba(255,255,255,0.12)' : 'transparent';
  const baseBorder = dark ? 'rgba(255,255,255,0.16)' : 'transparent';
  const hoverBg = dark ? 'rgba(255,255,255,0.2)' : 'var(--surface-sub)';
  const hoverBorder = dark ? 'rgba(255,255,255,0.28)' : 'transparent';
  return (
    <button
      type="button"
      aria-label={kind === 'down' ? '내리기' : '닫기'}
      onClick={onClick}
      style={{
        ...(absolute ? { position: 'absolute', top: 10, right: 10 } : {}),
        width: 36,
        height: 36,
        // 전역 `button { padding: 0.6em 1.2em }` 규칙 때문에 실제 폭이 커지고 있었음
        padding: 0,
        boxSizing: 'border-box',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 동그란 배경은 투박해 보여서 둥근 모서리 사각형으로 (앱의 다른 버튼들과 같은 계열)
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        borderRadius: 10,
        cursor: 'pointer',
        color: dark ? 'rgba(255,255,255,0.85)' : 'var(--ink-500)',
        flexShrink: 0,
        transition: 'background 0.15s ease, border-color 0.15s ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = hoverBg;
        e.currentTarget.style.borderColor = hoverBorder;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = baseBg;
        e.currentTarget.style.borderColor = baseBorder;
      }}
    >
    {/* flex 컨테이너 안에서 SVG 가 0px 로 찌그러지는 경우가 있어 크기를 명시적으로 고정 */}
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ width: 20, height: 20, flexShrink: 0, display: 'block' }}
    >
      {kind === 'down'
        ? <path d="M6 9.5l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        : <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />}
    </svg>
    </button>
  );
};

export default CloseButton;
