import React, { useEffect, useRef, useState } from 'react';

/**
 * 앱 공통 모양의 드롭다운 — **작은 알약 버튼 + 펼친 목록**.
 *
 * 기본 `<select>` 는 폰마다 시스템 선택창(아이폰 휠·안드로이드 대화상자)이 떠서 앱 다른 드롭다운과
 * 모양이 달랐다(2026-10-08 마이캘린더 기간 고르기 지적). 같은 생김새를 쓰려고 꺼냈다.
 *
 * 2026-11-06 다시 그렸다: 글자 13px 에 `∨` 글자 화살표를 달아 둔 사각 버튼이 「글씨가 크고 화살표가 이상하다」는 지적.
 * 이제 글자 12.5px · 선으로 그린 작은 화살표(`stroke`, 열리면 뒤집힘) · 알약 모양이고, 고른 항목은 파란색이 아니라
 * 앱의 다른 곳처럼 **굵은 글자 + 옅은 회색 바탕 + 체크**로 표시한다.
 */
export interface MenuSelectOption<T extends string> {
  value: T;
  label: string;
  /** 닫혀 있을 때(고른 값을 다시 읽는 자리)만 쓰는 짧은 글자. 펼친 목록에는 `label` 이 그대로 나온다. */
  short?: string;
}

/**
 * 드롭다운 공용 조각(2026-11-06) — 앱의 드롭다운이 셋(`MenuSelect`·`SortDropdown`·`RecipeSortBar` 안의 정렬)이라 모양이 제각각이었다
 * (둘은 글자 `∨` 화살표 + 파란 선택 표시). 화살표·펼친 목록 모양은 여기 하나만 쓴다.
 */
export const MenuChevron: React.FC<{ open?: boolean }> = ({ open }) => (
  <svg
    aria-hidden width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--ink-500)"
    strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease' }}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const MenuCheck: React.FC = () => (
  <svg aria-hidden width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

/** 펼친 목록 상자 */
export const menuPanelStyle: React.CSSProperties = {
  background: 'var(--surface)', padding: 4,
  border: '1px solid var(--line-200)', borderRadius: 12,
  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
};

/** 펼친 목록의 한 줄 — 고른 항목은 굵은 글자 + 옅은 회색 바탕(+ 체크는 `MenuCheck`). */
export const menuItemStyle = (on: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  width: '100%', height: 38, padding: '0 10px', borderRadius: 8, textAlign: 'left',
  fontSize: 13.5, fontWeight: on ? 700 : 500, whiteSpace: 'nowrap', cursor: 'pointer',
  fontFamily: 'inherit', border: 'none', color: 'var(--ink-900)',
  background: on ? 'var(--surface-sub)' : 'transparent',
});

interface MenuSelectProps<T extends string> {
  value: T;
  options: MenuSelectOption<T>[];
  onChange: (value: T) => void;
  /** 화면 오른쪽 끝에 놓일 때는 'right' — 목록이 화면 밖으로 나가지 않게 오른쪽에 맞춘다. */
  align?: 'left' | 'right';
  ariaLabel?: string;
  height?: number;
}

function MenuSelect<T extends string>({
  value, options, onChange, align = 'left', ariaLabel, height = 28,
}: MenuSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const current = options.find(o => o.value === value) || options[0];

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}: ${current.label}` : undefined}
        onClick={() => setOpen(o => !o)}
        style={{
          height, padding: '0 10px 0 12px', display: 'inline-flex', alignItems: 'center', gap: 4,
          border: '1px solid var(--line-300)', borderRadius: 9999, background: 'var(--surface)',
          fontSize: 12.5, fontWeight: 600, color: 'var(--ink-900)',
          whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {current.short ?? current.label}
        <MenuChevron open={open} />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute', top: '100%', marginTop: 4,
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            minWidth: '100%', ...menuPanelStyle,
            zIndex: 30,
          }}
        >
          {options.map(o => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={menuItemStyle(on)}
              >
                {o.label}
                {on && <MenuCheck />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MenuSelect;
