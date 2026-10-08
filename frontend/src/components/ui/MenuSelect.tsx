import React, { useEffect, useRef, useState } from 'react';

/**
 * 앱 공통 모양의 드롭다운 — 냉장고요리 정렬(`RecipeSortBar` 의 「재료매칭순 ∨」)과 같은 버튼·펼친 목록.
 *
 * 기본 `<select>` 는 폰마다 시스템 선택창(아이폰 휠·안드로이드 대화상자)이 떠서 앱 다른 드롭다운과
 * 모양이 달랐다(2026-10-08 마이캘린더 기간 고르기 지적). 같은 생김새를 쓰려고 꺼냈다.
 */
export interface MenuSelectOption<T extends string> {
  value: T;
  label: string;
}

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
  value, options, onChange, align = 'left', ariaLabel, height = 32,
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
          position: 'relative', height, padding: '0 24px 0 10px',
          border: '1px solid #D2D2D8', borderRadius: 6, background: '#FFFFFF',
          fontSize: 13, fontWeight: 600, color: '#1A1A1E', textAlign: 'left',
          whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        {current.label}
        <span aria-hidden style={{
          position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
          fontSize: 15, color: '#9A9AA2', pointerEvents: 'none',
        }}>∨</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          style={{
            position: 'absolute', top: '100%', marginTop: 4,
            ...(align === 'right' ? { right: 0 } : { left: 0 }),
            minWidth: '100%', backgroundColor: '#FFFFFF',
            border: '1px solid #D2D2D8', borderRadius: '0.5rem', overflow: 'hidden',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
            zIndex: 30,
          }}
        >
          {options.map((o, i) => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => { onChange(o.value); setOpen(false); }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.backgroundColor = '#F5F5F7'; }}
                onMouseLeave={e => { if (!on) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
                style={{
                  display: 'block', width: '100%', padding: '8px 12px', textAlign: 'left',
                  fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer',
                  fontFamily: 'inherit', border: 'none',
                  borderTop: i > 0 ? '1px solid #F5F5F7' : 'none',
                  color: on ? '#2563EB' : '#1A1A1E',
                  backgroundColor: on ? '#EFF6FF' : '#FFFFFF',
                }}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MenuSelect;
