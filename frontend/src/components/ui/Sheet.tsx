import * as React from 'react';
import Portal from '../Portal';
import Button from './Button';
import PopupHeader from './PopupHeader';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  /** 하단에 고정되는 액션 영역 (적용 버튼 등) */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** 화면 높이 대비 최대 높이 (기본 88%) */
  maxHeight?: string;
  /** footer 가 없을 때 하단에 자동으로 넣는 나가기 버튼 문구 */
  dismissLabel?: string;
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
  dismissLabel = '닫기',
}) => {
  // 아래로 밀어서 닫기.
  // 아래에서 올라온 시트는 아래로 미는 게 자연스러운 닫기 동작인데 지원되지 않았음.
  const [dragY, setDragY] = React.useState(0);
  const dragStartY = React.useRef<number | null>(null);
  const DISMISS_THRESHOLD = 90;

  const onDragStart = (clientY: number) => {
    dragStartY.current = clientY;
  };
  const onDragMove = (clientY: number) => {
    if (dragStartY.current === null) return;
    // 위로는 끌리지 않게 (아래로만)
    setDragY(Math.max(0, clientY - dragStartY.current));
  };
  const onDragEnd = () => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    if (dragY > DISMISS_THRESHOLD) {
      onClose();
    }
    setDragY(0);
  };
  // 시트가 열려 있는 동안 뒤 페이지 스크롤 잠금
  React.useEffect(() => {
    if (!open) return;
    setDragY(0);
    dragStartY.current = null;
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
          background: `rgba(0,0,0,${Math.max(0.12, 0.4 - dragY / 500)})`,
          zIndex: 'var(--z-overlay)' as unknown as number,
          animation: 'sheet-fade 0.18s ease-out',
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => onDragStart(e.touches[0].clientY)}
        onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
        onTouchEnd={onDragEnd}
        onTouchCancel={onDragEnd}
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
          animation: dragY ? undefined : 'sheet-up 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          // 손을 떼면 원위치로 스르르 돌아가고, 끄는 동안엔 손가락을 그대로 따라오게
          transition: dragStartY.current === null ? 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
        }}
      >
        {/* 손잡이 */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 2px', flexShrink: 0 }}>
          <span style={{ width: 40, height: 4, borderRadius: 9999, background: 'var(--line-300)' }} />
        </div>
        {/* 상단 바는 팝업 공통 규격(높이 52 / 제목 17px)을 따른다 */}
        <PopupHeader title={title ?? ''} onClose={onClose} />

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '0 20px 16px' }} className="ai-chat-scroll">
          {children}
        </div>

        {/* 하단에는 항상 나갈 수 있는 버튼을 둔다 */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--line-200)' }}>
          {footer || (
            <Button variant="outline" size="lg" block onClick={onClose}>
              {dismissLabel}
            </Button>
          )}
        </div>
      </div>
    </Portal>
  );
};

export default Sheet;
