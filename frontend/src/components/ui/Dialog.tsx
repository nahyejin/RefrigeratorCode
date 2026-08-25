import * as React from 'react';
import Portal from '../Portal';
import Button from './Button';

export interface DialogAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** 본문. 문자열이면 가운데 정렬 안내문으로, 노드면 그대로 렌더 */
  children?: React.ReactNode;
  /** 하단 버튼. 2개면 좌(보조)/우(주요) 로 나란히 */
  actions?: DialogAction[];
  /** 우상단 닫기(×) 버튼 표시 */
  showClose?: boolean;
  /** 배경 클릭으로 닫기 (기본 true) */
  closeOnBackdrop?: boolean;
  width?: number;
}

/**
 * 앱 공통 확인/안내 팝업.
 *
 * 예전에는 팝업마다 수치가 전부 달랐다 —
 *   딤 30% / 35% / 40%, 모서리 rounded-lg / xl / 2xl,
 *   폭 320px / 가변 / 370px, 여백 p-6 / px-5 py-4 / p-8,
 *   닫기 버튼은 `×` 텍스트가 있는 곳과 아예 없는 곳이 섞여 있었다.
 * 같은 앱의 팝업이 서로 다른 규격이면 "제각각 만든 것" 처럼 보인다.
 * 새 팝업은 반드시 이 컴포넌트를 쓸 것.
 */
const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  children,
  actions = [],
  showClose = true,
  closeOnBackdrop = true,
  width = 340,
}) => {
  // ESC 로 닫기 + 뒤 페이지 스크롤 잠금
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Portal>
      <div
        onClick={closeOnBackdrop ? onClose : undefined}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 'var(--z-overlay)' as unknown as number,
          animation: 'sheet-fade 0.16s ease-out',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `min(${width}px, calc(100vw - 40px))`,
          maxHeight: 'calc(100dvh - 80px)',
          overflowY: 'auto',
          background: 'var(--surface)',
          borderRadius: 20,
          padding: '24px 20px 20px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.22)',
          zIndex: 'var(--z-modal)' as unknown as number,
          animation: 'dialog-pop 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {showClose && (
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 40,
              height: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: 9999,
              cursor: 'pointer',
              color: 'var(--ink-400)',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {title && (
          <div
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: 'var(--ink-900)',
              textAlign: 'center',
              marginBottom: children ? 10 : 18,
              paddingRight: showClose ? 24 : 0,
              paddingLeft: showClose ? 24 : 0,
            }}
          >
            {title}
          </div>
        )}

        {children && (
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.6,
              color: 'var(--ink-700)',
              textAlign: 'center',
              wordBreak: 'keep-all',
              marginBottom: actions.length ? 20 : 0,
            }}
          >
            {children}
          </div>
        )}

        {actions.length > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            {actions.map((a, i) => (
              <Button
                key={a.label}
                variant={a.variant || (i === actions.length - 1 ? 'primary' : 'outline')}
                size="md"
                block
                onClick={a.onClick}
              >
                {a.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Portal>
  );
};

export default Dialog;
