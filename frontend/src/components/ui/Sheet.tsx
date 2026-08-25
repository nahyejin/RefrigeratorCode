import * as React from 'react';
import Portal from '../Portal';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** 하단에 고정되는 액션 영역 (적용 버튼 등) */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** 화면 높이 대비 최대 높이 (기본 88%) */
  maxHeight?: string;
}

/**
 * 바텀시트.
 *
 * 모바일에서 화면 가운데 뜨는 모달은 한 손 조작 시 손가락이 닿기 어렵고,
 * 내용이 길어지면 상하가 잘린다. 시트는 아래에서 올라와 엄지 근처에 액션이 오고
 * 내용 길이에 따라 자연스럽게 늘어난다.
 *
 * Portal 로 body 직속 렌더 — sticky/transform 조상 안에서 호출돼도 층위에 갇히지 않는다.
 */
const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  footer,
  children,
  maxHeight = '88dvh',
}) => {
  // 시트가 열려 있는 동안 뒤 페이지 스크롤 잠금
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <Portal>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 'var(--z-overlay)' as unknown as number,
          animation: 'sheet-fade 0.18s ease-out',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          margin: '0 auto',
          maxWidth: 460,
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          boxShadow: '0 -8px 32px rgba(0,0,0,0.18)',
          zIndex: 'var(--z-modal)' as unknown as number,
          animation: 'sheet-up 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* 손잡이 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <span style={{ width: 40, height: 4, borderRadius: 9999, background: 'var(--line-300)' }} />
        </div>

        {title && (
          <div
            style={{
              padding: '6px 20px 14px',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--ink-900)',
              textAlign: 'center',
            }}
          >
            {title}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 20px 16px' }} className="ai-chat-scroll">
          {children}
        </div>

        {footer && (
          <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--line-200)' }}>{footer}</div>
        )}
      </div>
    </Portal>
  );
};

export default Sheet;
