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
  /** 상단에 이미 닫기(×) 버튼이 있어 하단 나가기 버튼이 불필요할 때 끈다 */
  hideFooter?: boolean;
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
  hideFooter = false,
}) => {
  // 아래로 밀어서 닫기.
  // 아래에서 올라온 시트는 아래로 미는 게 자연스러운 닫기 동작인데 지원되지 않았음.
  const [dragY, setDragY] = React.useState(0);
  /**
   * 손을 떼는 순간의 이동량.
   * `dragY`(state)만 보면, 터치 이벤트가 한 프레임 안에 몰아쳐 들어올 때
   * 리렌더 전이라 `onDragEnd` 가 옛 값(0)을 읽어 **빠르게 쓸어내려도 안 닫히는** 일이 생긴다.
   * state 는 화면 표시용, ref 는 판정용으로 나눠 둔다.
   */
  const dragYRef = React.useRef(0);
  // 시트를 위로 끌면 더 넓게 펼쳐진다.
  // 내용이 많은 필터 같은 화면에서 기본 높이로는 선택지가 잘 안 보인다는 피드백 반영.
  const [expanded, setExpanded] = React.useState(false);
  const applyDragY = (v: number) => {
    dragYRef.current = v;
    setDragY(v);
  };
  const dragStartY = React.useRef<number | null>(null);
  /** 이번 제스처가 손잡이/헤더에서 시작됐는지. 본문에서 시작한 것과 규칙이 다르다 */
  const dragFromHandle = React.useRef(false);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const DISMISS_THRESHOLD = 90;
  const EXPAND_THRESHOLD = 50;
  /** 이만큼 움직이기 전에는 시트를 따라 움직이지 않는다 (손 떨림/스크롤 시작과 구분) */
  const DEAD_ZONE = 14;

  /**
   * 시트 전체에 터치 핸들러를 걸어 두면 **본문을 스크롤하려는 손짓까지 시트를 끄는 것으로
   * 읽힌다.** 필터처럼 내용이 긴 시트에서는 목록을 내리려다 시트가 통째로 닫히거나
   * 위로 붕 뜨는 일이 자주 생겼다.
   *
   * 그래서 두 갈래로 나눈다.
   *  - 손잡이·헤더에서 시작 → 언제나 끌기 (펼치기/닫기 모두)
   *  - 본문에서 시작 → **맨 위까지 스크롤된 상태에서 아래로 당길 때만** 끌기.
   *    그 외에는 본문 스크롤에 양보한다.
   */
  const onDragStart = (clientY: number, fromHandle: boolean) => {
    if (!fromHandle) {
      const el = bodyRef.current;
      // 본문이 이미 맨 위가 아니면 이 제스처는 스크롤이다 — 시트는 건드리지 않는다
      if (el && el.scrollTop > 0) {
        dragStartY.current = null;
        return;
      }
    }
    dragFromHandle.current = fromHandle;
    dragStartY.current = clientY;
  };

  const onDragMove = (clientY: number) => {
    if (dragStartY.current === null) return;
    const raw = clientY - dragStartY.current;

    // 본문에서 시작한 제스처는 아래로 당기는 것만 받는다.
    // 위로 올리는 건 "내용을 더 보겠다" 는 뜻이므로 스크롤에 넘긴다.
    if (!dragFromHandle.current && raw < 0) {
      dragStartY.current = null;
      applyDragY(0);
      return;
    }

    // 데드존만큼은 무시하고, 그 이후부터 손가락을 따라온다
    const delta = raw > 0 ? Math.max(0, raw - DEAD_ZONE) : Math.min(0, raw + DEAD_ZONE);
    // 이미 최대로 펼쳐졌으면 위로는 더 끌리지 않게 (고무줄처럼 조금만)
    applyDragY(expanded && delta < 0 ? delta / 4 : delta);
  };

  const onDragEnd = () => {
    if (dragStartY.current === null) return;
    dragStartY.current = null;
    const moved = dragYRef.current;
    if (moved <= -EXPAND_THRESHOLD && !expanded) {
      // 위로 끌었으면 펼치기
      setExpanded(true);
    } else if (moved > DISMISS_THRESHOLD) {
      // 펼친 상태에서 내리면 기본 높이로, 기본 높이에서 내리면 닫기
      if (expanded) setExpanded(false);
      else onClose();
    }
    applyDragY(0);
  };
  // 시트가 열려 있는 동안 뒤 페이지 스크롤 잠금
  React.useEffect(() => {
    if (!open) return;
    applyDragY(0);
    setExpanded(false);
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
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          margin: '0 auto',
          maxWidth: 460,
          maxHeight: expanded ? '95dvh' : maxHeight,
          height: expanded ? '95dvh' : undefined,
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
          transition:
            dragStartY.current === null
              ? 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), height 0.24s cubic-bezier(0.16, 1, 0.3, 1), max-height 0.24s cubic-bezier(0.16, 1, 0.3, 1)'
              : 'none',
        }}
      >
        {/* 손잡이와 헤더는 언제나 끌 수 있는 영역 */}
        <div
          onTouchStart={(e) => onDragStart(e.touches[0].clientY, true)}
          onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
          onTouchEnd={onDragEnd}
          onTouchCancel={onDragEnd}
          style={{ flexShrink: 0 }}
        >
        {/* 손잡이 — 끌어서 펼치거나 내릴 수 있고, 탭으로도 펼침/접힘 전환 */}
        <button
          type="button"
          aria-label={expanded ? '시트 접기' : '시트 펼치기'}
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            height: 26,
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <span style={{ width: 40, height: 4, borderRadius: 9999, background: 'var(--line-300)' }} />
        </button>
        {/* 상단 바는 팝업 공통 규격(높이 52 / 제목 17px)을 따른다 */}
        <PopupHeader title={title ?? ''} onClose={onClose} />
        </div>

        {/* 본문. 예전에는 paddingTop 이 0 이라 헤더 아래 구분선에 첫 항목이 바짝 붙었다 */}
        <div
          ref={bodyRef}
          onTouchStart={(e) => onDragStart(e.touches[0].clientY, false)}
          onTouchMove={(e) => onDragMove(e.touches[0].clientY)}
          onTouchEnd={onDragEnd}
          onTouchCancel={onDragEnd}
          style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 20px 16px' }}
          className="ai-chat-scroll"
        >
          {children}
        </div>

        {/* 하단에는 보통 나갈 수 있는 버튼을 둔다 — 단, 상단에 이미 닫기(×)가
            있고 다른 액션도 없는 시트는 hideFooter로 이 영역 자체를 없앤다 */}
        {!hideFooter && (
          <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--line-200)' }}>
            {footer || (
              <Button variant="outline" size="lg" block onClick={onClose}>
                {dismissLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </Portal>
  );
};

export default Sheet;
