import * as React from 'react';

/**
 * `⋯` 버튼 하나 + 눌렀을 때 뜨는 작은 메뉴.
 *
 * 왜 만들었나(2026-11-06): 마이캘린더 카드마다 「완료 취소」「계획 취소」「완료일자 수정」「기록 취소」 같은 **글자 알약 버튼**이
 * 붙어 있었다. 카드마다 같은 말이 반복되고, 빨간 글자·테두리 알약이라 눈에 제일 먼저 들어오는데 정작 거의 안 누르는 기능이다
 * ("버튼 색이 매력적이지 않다"는 지적). 거의 안 누르는 기능은 `⋯` 뒤로 물리고, 카드에서는 제목·시간이 먼저 읽히게 한다.
 *
 * 메뉴는 `position: fixed` 로 띄운다 — 카드·달력 상자가 `overflow: hidden` 이라 안에서 `absolute` 로 펼치면 잘린다.
 * 바깥을 누르거나 스크롤하거나 Esc 를 누르면 닫힌다.
 */
export interface KebabItem {
  label: string;
  onClick: () => void;
  /** 되돌리기 어려운 동작(취소·삭제) — 글자를 붉게. */
  danger?: boolean;
}

const KebabMenu: React.FC<{ items: KebabItem[]; ariaLabel: string }> = ({ items, ariaLabel }) => {
  const [pos, setPos] = React.useState<{ top: number; right: number } | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const open = pos !== null;

  React.useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDown = (e: Event) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if ((t as HTMLElement).closest?.('[data-kebab-menu]')) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (items.length === 0) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (open) { setPos(null); return; }
          const r = btnRef.current?.getBoundingClientRect();
          if (r) setPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
        }}
        style={{
          flexShrink: 0, width: 32, height: 32, padding: 0, border: 'none', borderRadius: 8,
          background: open ? 'var(--surface-sub)' : 'transparent', cursor: 'pointer',
          color: 'var(--ink-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {open && pos && (
        <div
          data-kebab-menu
          role="menu"
          style={{
            position: 'fixed', top: pos.top, right: pos.right, zIndex: 'var(--z-modal)' as any,
            minWidth: 132, padding: 4, borderRadius: 12, background: 'var(--surface)',
            border: '1px solid var(--line-200)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}
        >
          {items.map(it => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              onClick={() => { setPos(null); it.onClick(); }}
              style={{
                display: 'block', width: '100%', height: 40, padding: '0 12px', border: 'none', borderRadius: 8,
                background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 14, fontWeight: 600, color: it.danger ? '#B03A28' : 'var(--ink-900)', whiteSpace: 'nowrap',
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default KebabMenu;
